---
title: Cifrado y configuración
description: 'Cómo Seal.kt abre lo que el mod selló con /narsil movil clave, byte a byte como lo sella hooks/seal.ts, qué guarda la app y dónde, cómo rotar la clave y el tema, y el modelo de amenazas.'
route: android
order: 7
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Seal.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/SealTest.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Settings.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/SettingsActivity.kt
  - repo: android
    path: app/src/main/res/xml/shortcuts.xml
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Qué hace

Tu tema de ntfy.sh es público en un sentido: cualquiera que conozca su nombre puede leerlo. `/narsil movil clave` en el mod de Narsil arregla la parte de la lectura. Crea una clave, y desde ese momento el mod sella todo lo que publica, tanto los avisos como los estados. Quien lea el tema ve "Narsil" y un texto ilegible que empieza por `narsil1:`. Tú escribes la misma clave en la configuración de la app, y la app abre cada mensaje antes de mostrarlo.

Cuando la clave es incorrecta o falta:

- **Un aviso** dice "🔒 Aviso cifrado: pon la clave en los ajustes de la app."
- **El bloque del menú lateral** dice "🔒 Toca y pon la clave", si no tiene un estado anterior que mostrar.

La pantalla de configuración guarda dos cosas, el tema y la clave, y solo las conserva en el móvil. Se abre desde tres sitios: un toque en Narsil (o en un aviso) en el bloque del menú lateral, un toque en la notificación silenciosa "Narsil escucha tus avisos", y una pulsación larga en el icono de la app, y después **Ajustes**, en los launchers que muestran accesos directos.

> **Experimental.** La app se apoya en la estructura de la página de `claude.ai` y en sus peticiones internas, no en una API pública, así que una actualización de Claude puede romper la franja y los colores. El cifrado que se describe aquí es un esquema construido a mano para Narsil, no el formato de una biblioteca revisada. Se comprueba contra la salida del propio mod, pero nadie lo ha auditado; tómalo como una protección frente a lectores casuales de tu tema, y lee el modelo de amenazas del final.

## Cómo funciona por dentro

### Lo que sella el mod, y lo que no

El mod decide lo que va dentro. De `hooks/phone.ts` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

<!-- prettier-ignore -->
```ts
export function sealedMessage<M extends { title?: string; message: string }>(m: M, sealed: string): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}

// What goes inside the seal.
export function sealedPayload(m: { title?: string; message: string }): string {
  return JSON.stringify(m.title ? { title: m.title, message: m.message } : { message: m.message })
}
```

En un aviso, el título y el texto van dentro, como JSON, y el título de fuera pasa a ser solo `Narsil`. Todo lo demás del mensaje queda legible: la prioridad, las etiquetas, la dirección del dibujo y el botón. En un estado de `-estado`, que no tiene título, va dentro todo el estado en JSON.

### El formato: `narsil1:` y tres partes

Un mensaje sellado es el prefijo `narsil1:` seguido de una cadena base64url, que se decodifica en tres partes seguidas:

| Parte      | Tamaño       | Qué es                                                                   |
| ---------- | ------------ | ------------------------------------------------------------------------ |
| Nonce      | 16 bytes     | Aleatorio en cada mensaje, para que el mismo texto nunca se selle igual. |
| Ciphertext | El del texto | El texto UTF-8, combinado con XOR con un flujo de clave.                 |
| Etiqueta   | 32 bytes     | La prueba de que el nonce y el ciphertext se hicieron con esta clave.    |

La clave en sí son 32 bytes aleatorios, que el mod muestra en base64url (43 caracteres). El esquema usa una sola primitiva, HMAC-SHA256, para todo. El comentario del mod explica por qué: "The hooks module's crypto has SHA-256 alone" (el crypto del módulo de hooks solo tiene SHA-256), así que el HMAC se construye a mano sobre él. [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) recorre paso a paso el lado que sella.

### `Seal.kt`: abrirlo

De `Seal.kt` en narsil-android (MIT):

```kotlin
    // The text inside, or IllegalArgumentException when the key is not the one that sealed it.
    fun open(key: String, text: String): String {
        val bytes = bytesOf(text.removePrefix(PREFIX))
        val shared = bytesOf(key)
        require(bytes.size >= NONCE + TAG && shared.isNotEmpty()) { WRONG_KEY }
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val body = bytes.copyOfRange(0, bytes.size - TAG)
        val given = bytes.copyOfRange(bytes.size - TAG, bytes.size)
        require(MessageDigest.isEqual(hmac(macKey, body), given)) { WRONG_KEY }
        val nonce = body.copyOfRange(0, NONCE)
        val cipher = body.copyOfRange(NONCE, body.size)
        val plain = ByteArray(cipher.size)
        var block = 0
        while (block * 32 < cipher.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(NONCE + 4).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i >= cipher.size) break
                plain[i] = (cipher[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        return String(plain, Charsets.UTF_8)
    }
```

En orden:

1. **Decodifica** el mensaje y la clave desde base64. `bytesOf` acepta el alfabeto estándar y el seguro para URL, con relleno o sin él, y devuelve un array vacío para cualquier cosa que no sea base64.
2. **Rechaza lo que no puede estar bien**: un mensaje más corto que un nonce más una etiqueta, o una clave vacía. Los dos lanzan un error con el mensaje "La clave no es la de este aviso".
3. **Deriva dos claves** de la tuya: `encKey = HMAC(key, "enc")` para el flujo de clave y `macKey = HMAC(key, "mac")` para la etiqueta. Usar la misma clave para los dos trabajos es un error clásico; derivar dos lo evita.
4. **Comprueba primero la etiqueta.** Calcula `HMAC(macKey, nonce ‖ ciphertext)` y la compara con la etiqueta recibida. Si es distinta, es otra clave o un byte cambiado, y el código se detiene ahí, antes de descifrar nada. Este orden se llama encrypt-then-MAC (cifrar y después MAC).
5. **Descifra** de 32 en 32 bytes. El bloque `i` del flujo de clave es `HMAC(encKey, nonce ‖ i)`, con `i` en cuatro bytes, big-endian (el orden por defecto de `ByteBuffer`). Se combina con XOR con el ciphertext. Es el modo contador (CTR), con HMAC en lugar de un cifrado por bloques.

La comparación usa `MessageDigest.isEqual`, que tarda lo mismo coincidan los bytes que coincidan, así que el tiempo que tarda no revela nada sobre la etiqueta correcta.

### Byte a byte con `hooks/seal.ts`

El comentario de la clase dice que la app abre lo que sella el mod "byte for byte as it seals it" (byte a byte como lo sella). Lado a lado con `hooks/seal.ts` de narsil-pet:

| Paso                    | Mod (`hooks/seal.ts`)                                    | App (`Seal.kt`)                                   |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Prefijo                 | `narsil1:`                                               | `narsil1:`                                        |
| HMAC                    | Construido a mano desde SHA-256 (`crypto.subtle.digest`) | `javax.crypto.Mac` con `HmacSHA256`               |
| Dos claves              | `hmac(k, 'enc')`, `hmac(k, 'mac')`                       | `hmac(shared, "enc")`, `hmac(shared, "mac")`      |
| Contador                | `DataView.setUint32(0, i)`: 4 bytes, big-endian          | `ByteBuffer.putInt(block)`: 4 bytes, big-endian   |
| Etiqueta sobre          | `nonce ‖ ciphertext`                                     | `nonce ‖ ciphertext`                              |
| Comparación de etiqueta | `tag.some((b, i) => b !== given[i])`                     | `MessageDigest.isEqual`                           |
| Base64                  | Seguro para URL, sin relleno                             | Cualquiera de los dos alfabetos, relleno opcional |
| Demasiado corto         | Devuelve `null`                                          | Lanza un error                                    |
| Clave vacía             | No se comprueba                                          | Lanza un error                                    |
| Clave incorrecta        | Devuelve `null`                                          | Lanza `IllegalArgumentException`                  |

Un HMAC construido a mano y uno de biblioteca dan los mismos bytes cuando los dos siguen la construcción estándar, algo que el comentario del mod afirma para WebCrypto: "gives the same bytes" (da los mismos bytes). La prueba aquí es el test. `SealTest.kt` lleva una clave y un mensaje sellado cuyo comentario dice "The vector was sealed by a JavaScript port of the mod's hooks/seal.ts" (el vector lo selló un port en JavaScript de hooks/seal.ts del mod); el commit `9051a31` dice que el vector salió del propio código de la extensión anterior. El texto de dentro es largo a propósito, "texto largo para cruzar varios bloques de 32 bytes", y tiene tildes y un `✓`, así que se ejercitan tanto el contador como UTF-8. Las pruebas comprueban que el vector se abre exactamente en ese texto, que otra clave lanza un error con el mensaje en español, qué textos cuentan como sellados, y los tres casos de `unseal` de abajo.

### `unseal`: lo que pasa de verdad con cada mensaje

`Seal.open` se usa a través de `unseal`, que recibe un mensaje de ntfy y devuelve uno con su título y su texto de vuelta en su sitio. De `Seal.kt` (MIT):

```kotlin
    // An ntfy message with its title and text back in place: unchanged when not sealed; with `sealed: true` and no
    // text when the key cannot open it.
    fun unseal(key: String?, m: JSONObject): JSONObject {
        if (!isSealed(m.optString("message"))) return m
        val out = JSONObject(m.toString())
        try {
            val inside = JSONObject(open(key.orEmpty(), m.getString("message")))
            if (inside.has("title")) out.put("title", inside.get("title"))
            out.put("message", inside.optString("message"))
        } catch (_: Exception) {
            out.put("message", "").put("sealed", true)
        }
        return out
    }
```

Léelo con atención, porque no todos los casos son lo que esperarías:

| El mensaje                    | La clave en la app          | Un aviso muestra                      | La franja                                            |
| ----------------------------- | --------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Sin sellar                    | Ninguna                     | Su título y su texto                  | Toma el estado                                       |
| Sin sellar                    | Cualquier clave             | Su título y su texto, **sin cambios** | Toma el estado                                       |
| Sellado                       | La correcta                 | El título y el texto de dentro        | Toma el estado                                       |
| Sellado                       | Incorrecta, vacía o ninguna | El título `Narsil`, el texto 🔒       | Marca `isSealed`; conserva cualquier estado anterior |
| Sellado, con un byte cambiado | La correcta                 | El título `Narsil`, el texto 🔒       | Marca `isSealed`; conserva cualquier estado anterior |

De ahí salen tres hechos:

- **Una clave incorrecta falla cerrada.** Ni texto parcial ni basura: el mensaje se marca `sealed: true` y su texto se vacía. Cualquier error dentro, una etiqueta mala, un fallo al decodificar o un contenido que no es JSON, termina igual.
- **Un mensaje sin sellar pasa, haya clave o no.** `unseal` lo devuelve sin cambios si no empieza por `narsil1:`. La app no exige el sellado una vez que pones una clave. Eso es cómodo después de `/narsil movil clave off`, pero también significa que la clave no impide que alguien que conozca tu tema publique un aviso o un estado en claro que la app mostrará.
- **El candado de la franja es más discreto que el del aviso.** Como explica la [guía 4](/es/android/sidebar/), `StateModel` conserva su estado anterior cuando un mensaje no se abre, y el bloque muestra un estado siempre que tiene uno. El aviso del candado solo aparece cuando no hay nada que mostrar.

### `Settings.kt`: lo que guarda la app, y dónde

De `Settings.kt` (MIT):

```kotlin
// What the app keeps on the phone: the topic and the key typed in its settings (never in its code, as the repository
// is public), the last alert it showed, so a restart goes on from it, and the band's last state, per topic.
class Settings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("narsil", Context.MODE_PRIVATE)

    var topic: String?
        get() = prefs.getString(TOPIC, null)?.takeIf { isTopic(it) }
        set(value) = prefs.edit().putString(TOPIC, value).remove(LAST_ALERT).apply()

    var key: String?
        get() = prefs.getString(KEY, null)?.takeIf { it.isNotBlank() }
        set(value) = prefs.edit().putString(KEY, value).apply()

    var lastAlertId: String?
        get() = prefs.getString(LAST_ALERT, null)
        set(value) = prefs.edit().putString(LAST_ALERT, value).apply()
```

Cuatro valores, en el archivo de `SharedPreferences` de Android llamado `narsil`:

| Clave         | Lo que guarda                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `topic`       | Tu tema. Solo se vuelve a leer si todavía encaja con `^[-_A-Za-z0-9]{1,64}$`.                                      |
| `key`         | Tu clave, tal como la escribiste. Una en blanco se lee como sin clave.                                             |
| `lastAlertId` | El id del último aviso mostrado, para retomar ([guía 6](/es/android/alerts-service/)). Se borra con un tema nuevo. |
| `band`        | El último estado de la franja, con el tema al que pertenece; se ignora para cualquier otro tema.                   |

`MODE_PRIVATE` pone el archivo en la carpeta de datos propia de la app, que el sandbox de Android cierra a las demás apps. Dentro, los valores están en texto plano: la app no los cifra con el Keystore de Android. El `android:allowBackup="false"` del manifiesto los deja fuera de las copias de seguridad de Android. La especificación S4 explica por qué se escriben en lugar de venir incluidos: "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings." (el repositorio es público y se llama `narsil-android`: ni tema ni clave en el código; se escriben en la configuración de la app).

### `SettingsActivity.kt`: la pantalla

La pantalla es un layout sencillo de Android: un texto de introducción, un campo **Topic**, un campo **Clave (opcional)**, el botón **Guardar y recibir avisos**, una línea de estado y el botón de segundo plano de la [guía 6](/es/android/alerts-service/). Vale la pena fijarse en algunas decisiones:

- **El campo de la clave es un campo de contraseña** (`inputType="textPassword"`), así que muestra puntos, y los dos campos fijan `importantForAutofill="no"`, para que ningún gestor de contraseñas se ofrezca a guardarlos.
- **Guardar valida primero el tema.** Un tema con algo que no sean letras, números, `-` y `_` recibe "Ese topic no es válido: solo letras, números, - y _.", y no se guarda nada.
- **Los dos valores se recortan**, así que un espacio copiado con ellos no hace daño.
- **El tema solo se escribe si cambió**, así que guardar el mismo tema conserva `lastAlertId` y los avisos retoman donde iban.
- **Guardar con el campo de la clave vacío** quita la clave: el getter lee un valor en blanco como ninguno.
- Después arranca el servicio de avisos, dice "Guardado. Los avisos llegan a este teléfono; vuelve a Claude para ver la banda." y pide el permiso de notificaciones si Android lo necesita.

La actividad es `exported` en el manifiesto, lo que deja que el acceso directo del launcher la abra. `res/xml/shortcuts.xml` declara ese único acceso directo estático, con la etiqueta corta **Ajustes** y la larga **Ajustes de Narsil**, que apunta a `io.github.davshn.narsil.SettingsActivity`. Estar exportada también significa que otra app podría abrir la pantalla, pero no gana nada: la pantalla solo muestra campos, y no guardan nada que esa app pueda leer.

### Rotar la clave y el tema

Cada comando se ejecuta en Claude Code en tu PC; cada cambio va después a la configuración de la app.

| Quieres                             | En el PC                  | En la app                                                                                                                   |
| ----------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Empezar a cifrar, o una clave nueva | `/narsil movil clave`     | Pega la clave nueva y guarda. Hasta que lo hagas, los avisos muestran el texto 🔒.                                          |
| Dejar de cifrar                     | `/narsil movil clave off` | No hace falta nada, ya que los mensajes en claro pasan; borra el campo de la clave para dejarlo limpio.                     |
| Un tema nuevo                       | `/narsil movil nuevo`     | Pega el tema nuevo y guarda. Los avisos vuelven a empezar en él, y la franja empieza con un estado vacío.                   |
| Detener los avisos                  | `/narsil movil off`       | Nada que hacer; la app no tiene un interruptor propio para apagarlos.                                                       |
| Borrar todo del móvil               |                           | En Android, **Ajustes → Aplicaciones → Narsil → Almacenamiento**, bórralo: se van la sesión, el tema, la clave y el estado. |

Las respuestas del mod confirman cada paso. Para un tema nuevo: "Narsil: tema nuevo, el anterior ya no recibe nada." Para una clave nueva, muestra la clave y añade "/narsil movil clave crea otra clave". Esa respuesta todavía dice que pongas la clave en las opciones de la extensión de Firefox; en Android, va en la configuración de esta app.

Cada `/narsil movil clave` crea una clave **nueva**, y ningún comando vuelve a mostrar la actual. En el PC, la clave también vive en las preferencias del mod y en la respuesta del comando, que forma parte de tu conversación con Claude. [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) cubre ese lado.

### El modelo de amenazas, en palabras sencillas

Quién podría ver o hacer qué, según el código:

- **ntfy.sh** ve cada mensaje, la dirección del móvil cuando se conecta y tu tema en cada petición. Sin clave, ve todo el texto. Es un servicio de terceros.
- **Cualquiera que conozca tu tema, sin clave de tu lado,** lee cada aviso y cada estado: nombres de conversaciones, parte de las respuestas de Claude, tu nivel.
- **Esa misma persona, con clave de tu lado,** ve que se envió un mensaje y cuándo, su prioridad (así que si Claude te necesita), sus etiquetas, la dirección del dibujo (así que la etapa de Narsil y la pose del aviso), el botón y el título `Narsil`. No el texto.
- **Falsificar un mensaje sellado** sin la clave no pasa la comprobación de la etiqueta, y la app muestra el texto 🔒.
- **Falsificar un mensaje en claro** funciona, haya clave o no, como se ve arriba. Lo que puede hacer está limitado por la app: el texto entra como texto, un dibujo solo desde la propia carpeta de Narsil, un toque solo hacia `claude.ai`. Sus dos botones, en cambio, pueden llevar cualquier dirección, que se abre en otra app si lo tocas. Un estado en claro falsificado puede mostrar un nivel equivocado, y un `at` muy en el futuro impediría que los estados reales lo reemplazaran hasta que cambies el tema o borres los datos de la app.
- **La página** nunca recibe el tema ni la clave; solo el estado ya abierto ([guía 2](/es/android/webview-host/)).
- **Alguien con tu móvil desbloqueado** puede abrir la configuración y leer el tema (el campo de la clave está enmascarado, no oculto para alguien decidido), y la notificación silenciosa muestra el tema en el panel de notificaciones.
- **Un PC con la depuración por USB permitida en tu móvil** puede hacer más con una compilación de depuración, que es lo que instala `./gradlew installDebug`. Android le deja leer los archivos privados de una app depurable (con `adb shell run-as`), entre ellos la clave, e inspeccionar la página de Claude desde `chrome://inspect`. Apaga la depuración por USB cuando no la estés usando.

Nada de esto protege tu cuenta de Claude en sí: eso es tu cookie de sesión, que la WebView guarda en la misma carpeta privada, y está tan segura como el móvil.

## Constrúyelo con Claude

Pídele a Claude que porte a Kotlin el lado que abre del esquema del mod, y que lo demuestre con un vector hecho por el propio código del mod. La idea que debe acertar es el orden: comprobar primero la etiqueta, con una comparación de tiempo constante, y solo después descifrar; y un fallo de cualquier tipo debe dar un único resultado claro de "no se puede abrir", nunca texto parcial.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Porta la mitad `unseal` de este esquema de TypeScript a un `object` de Kotlin sin dependencias de Android (pega abajo `hooks/seal.ts` de narsil-pet). Usa `javax.crypto.Mac` con `HmacSHA256`, `ByteBuffer` para el contador de 4 bytes big-endian y `MessageDigest.isEqual` para la etiqueta. Decodifica base64url con relleno o sin él, y trata como clave incorrecta todo lo que no se decodifique, mida menos de 48 bytes o tenga una clave vacía. Comprueba la etiqueta antes de descifrar. Añade una función que reciba un mensaje de ntfy como `JSONObject` y, si su `message` empieza por `narsil1:`, reemplace `title` y `message` por los de dentro, o vacíe `message` y fije `sealed: true` cuando no pueda abrirlo. Escribe pruebas de JUnit con un vector que yo generaré ejecutando el `seal` de TypeScript con un nonce fijo, más una clave incorrecta, una clave nula, una clave vacía y un mensaje en claro.

### Qué revisar en la respuesta de Claude

1. La etiqueta se calcula sobre el nonce y el ciphertext, y se compara antes de cualquier descifrado.
2. La comparación es `MessageDigest.isEqual`, no `contentEquals` ni un bucle que se detiene antes.
3. El contador tiene cuatro bytes, big-endian, y empieza en 0.
4. Se derivan dos claves con HMAC de `"enc"` y `"mac"`; la clave compartida nunca se usa directamente.
5. Cada fallo termina en un único resultado, `sealed: true` con un mensaje vacío.
6. Una prueba usa un vector sellado por el código de TypeScript, no solo un viaje de ida y vuelta por el propio código Kotlin: un viaje de ida y vuelta pasa aunque las dos mitades compartan el mismo error.

Si una comprobación falla, dile a Claude lo que ves: "el vector del mod se abre en basura después de los primeros 32 caracteres", lo que apunta al contador.

### Cómo lo pidió el autor

Las palabras de quien creó Narsil recogidas en `odd/tasks/android-app.md` ponen el marco de esta guía. L2 (2026-11-24) dice "el repositorio seria publico", que la especificación S4 convierte en la regla citada arriba: ni tema ni clave en el código. La especificación S5, del agente, incluye "sealed messages opened with the key (`narsil1:`)" (los mensajes sellados se abren con la clave, `narsil1:`) entre las reglas que mantienen los avisos. T1 recoge la primera tarea: "Gradle project and `Seal` port, tested against vectors from [the earlier extension]'s seal.js" (proyecto de Gradle y port de `Seal`, probado contra vectores del seal.js de [la extensión anterior]; aquí se omite su nombre).

El registro recoge la comprobación con el tema y la clave reales, el 2026-11-24 a las 00:44: "the mod's alert and state, sealed with the new key, opened in the app." (el aviso y el estado del mod, sellados con la clave nueva, se abrieron en la app).

Los commits (el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `9051a31` (2026-11-24) "feat: open what the mod seals, as [the earlier extension]'s seal.js does" (abrir lo que sella el mod, como hace el seal.js de [la extensión anterior]). Su mensaje: "Gradle project for the Android app, with the sealing port tested against a vector sealed by the extension's own code." (proyecto de Gradle para la app de Android, con el port del sellado probado contra un vector sellado por el propio código de la extensión).
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano). Su mensaje: "Settings keep the topic and key on the phone." (la configuración guarda el tema y la clave en el móvil).
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir la configuración desde Narsil en la franja y desde la notificación del servicio).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registrar los avisos y la franja comprobados con el tema y la clave reales).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía (MIT). Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Un sellador solo para pruebas en Kotlin, que sigue a `hooks/seal.ts`, y dos pruebas contra el `Seal` de la app. Usa la clave claramente falsa `example-key-not-real`, que como base64url se decodifica en 15 bytes; HMAC acepta una clave de cualquier longitud. Recuerda la advertencia de la última comprobación de arriba: estas pruebas atrapan un byte manipulado y un contador roto del lado de Kotlin, pero no reemplazan el vector del propio código del mod que usa `SealTest.kt`.

```kotlin
package io.github.davshn.narsil

import java.nio.ByteBuffer
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SealRoundTripTest {
    private val key = "example-key-not-real"

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(data)
        }

    private fun seal(text: String, nonce: ByteArray): String {
        val shared = Base64.getUrlDecoder().decode(key)
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val plain = text.toByteArray(Charsets.UTF_8)
        val cipher = ByteArray(plain.size)
        var block = 0
        while (block * 32 < plain.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(20).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i < plain.size) cipher[i] = (plain[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        val tag = hmac(macKey, nonce + cipher)
        return "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce + cipher + tag)
    }

    @Test
    fun aLongTextOpensAcrossBlocks() {
        val text = "{\"title\":\"Narsil\",\"message\":\"" + "ñ".repeat(40) + "\"}"
        assertEquals(text, Seal.open(key, seal(text, ByteArray(16) { 7 })))
    }

    @Test
    fun oneChangedByteIsRefused() {
        val sealed = seal("{\"message\":\"hola\"}", ByteArray(16))
        val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix("narsil1:"))
        bytes[20] = (bytes[20].toInt() xor 1).toByte()
        val changed = "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        assertThrows(IllegalArgumentException::class.java) { Seal.open(key, changed) }
    }
}
```

`"ñ".repeat(40)` ocupa 80 bytes en UTF-8, así que, con el JSON alrededor, el texto abarca cuatro bloques de 32. El byte 20 está en el ciphertext, justo después del nonce de 16 bytes. Los nonces fijos son solo para la prueba; el mod saca uno aleatorio nuevo para cada mensaje, y así debe hacerlo cualquier cosa que construyas que selle.

## Errores comunes y cómo probarlo

- **Descifrar antes de comprobar la etiqueta.** Un mensaje cambiado produciría basura que podrías mostrar. Comprueba primero y descifra después.
- **Comparar etiquetas con un bucle que se detiene antes.** Revela, por el tiempo que tarda, cuántos bytes coincidieron. Usa una comparación de tiempo constante.
- **Un contador con el orden de bytes equivocado.** Los primeros 32 bytes se abren y el resto es basura. Cuatro bytes, big-endian.
- **Probar solo viajes de ida y vuelta.** Sellar y abrir con el mismo código coinciden aunque los dos estén mal. Prueba contra un vector del otro lado.
- **Esperar que la clave bloquee los mensajes en claro.** En esta app no lo hace. Si construyes la tuya, decide si un receptor con clave debe rechazar los mensajes sin sellar.
- **Olvidar pegar la clave nueva.** Cada `/narsil movil clave` crea una nueva. Los avisos muestran el texto 🔒 hasta que la pegues.
- **Compartir una captura de la configuración o del panel de notificaciones.** El tema aparece en los dos.
- **Guardar la clave en el repositorio.** El repositorio de la app es público a propósito; los temas y las claves van en la configuración.

Para probarlo, ejecuta `./gradlew testDebugUnitTest`: `SealTest.kt` abre el vector del mod, rechaza otra clave, distingue el texto sellado del texto en claro, vuelve a poner el título y el texto, deja en paz los mensajes en claro y marca lo que una clave incorrecta, nula o vacía no puede abrir. En el móvil, con un tema inventado en la configuración y el campo de la clave en `example-key-not-real`, publica desde el PC un aviso que parece sellado pero no lo está:

```bash
curl -H "Title: Narsil" -d "narsil1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" https://ntfy.sh/narsil-0000000000example0
```

La notificación debería decir "🔒 Aviso cifrado: pon la clave en los ajustes de la app.", ya que su etiqueta no puede coincidir. Después publica `-d "Hola"` en el mismo tema: se muestra tal cual, haya clave o no.

### Dónde difieren el código y el README

- El README dice que, con la clave, "Anyone reading the topic only sees "Narsil" and unreadable text." (quien lea el tema solo ve "Narsil" y texto ilegible). `sealedMessage` del mod deja en claro la prioridad, las etiquetas, la dirección del dibujo y el botón, así que un lector también ve el tipo de aviso y la etapa de Narsil.
- El README dice que, si la clave no es la que selló un estado, la franja muestra "🔒 Toca y pon la clave". El bloque solo lo hace cuando no tiene un estado anterior para el tema, como se explica arriba.
- El README no menciona que los mensajes sin sellar se aceptan mientras hay una clave puesta. El código los acepta.

## Para ir más lejos

- La [guía 6](/es/android/alerts-service/) muestra dónde está `unseal` en el recorrido de un aviso, y el botón de segundo plano de la configuración.
- La [guía 4](/es/android/sidebar/) muestra el aviso del candado en el bloque del menú lateral, y por qué puede quedarse oculto.
- Del lado del mod, [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica paso a paso el sellado y dónde vive la clave en tu PC.
- [Narsil Watch](/es/watch/what-it-is/) lee el mismo tema `-estado`.
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
