---
title: Leer el estado de Narsil
description: 'Lo que el mod publica ahora en <topic>-estado, límites y conversaciones incluidos, y cómo el reloj obtiene el último mensaje de ntfy.sh, abre su sello con tu clave y lo guarda.'
route: watch
order: 2
updated: 2026-11-24
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/NarsilState.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusParser.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/Seal.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/data/SealTest.kt
---

## Qué hace

Todo lo que muestra el reloj sale de un pequeño mensaje JSON. El mod de Narsil lo escribe en tu PC y lo publica en ntfy.sh, en el tema `<tu tema>-estado`. El reloj lee el último, lo abre si va sellado y lo guarda, para que el tile, la complicación y la app puedan dibujarse a partir de él en cualquier momento.

Esta guía sigue ese mensaje de un extremo a otro: lo que el mod pone en él desde narsil-pet 3.10.0, las clases de Kotlin en las que se lee (`NarsilState.kt`), la petición y lo que se guarda (`StatusRepository.kt`), el análisis (`StatusParser.kt`) y el sello (`Seal.kt`), incluido lo que pasa con una clave equivocada o un mensaje sin sellar.

> **Experimental.** El reloj solo puede leer lo que el mod publicó por última vez, y el mod solo publica mientras estás lejos del PC, dentro del margen diario gratuito de ntfy.sh. ntfy.sh guarda un mensaje durante un tiempo limitado, así que un periodo largo de silencio deja al reloj con su propia última copia. Y la forma del estado es un acuerdo privado entre dos proyectos: un cambio en el mod puede romper la lectura.

Los ejemplos usan solo valores inventados: el tema `narsil-0000000000example0` y claves falsas.

## Cómo funciona por dentro

### El lado del mod: lo que lleva ahora `-estado`

`sendStatus`, en `hooks/register.tsx` de narsil-pet, construye el estado, y `phoneStatus`, en `hooks/phone.ts`, lo envuelve para ntfy.sh: `{ topic: "<topic>-estado", message: JSON.stringify(state), priority: 1 }`. El estado en sí es un objeto JSON con siete campos desde el commit `6400a6f`, "feat(phone): publish Claude limits and open conversations for the watch" (publicar los límites de Claude y las conversaciones abiertas para el reloj), publicado como 3.10.0:

| Campo          | Qué es                                                                                  | ¿Lo usa el reloj?              |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| `xp`           | La etiqueta de nivel de Narsil, como `⭐ Nivel 3 · 120/300 XP`.                         | Sí, en la app.                 |
| `art`          | La URL de su dibujo, en su etapa, en la pose de la conversación abierta más importante. | Sí, tile y app.                |
| `at`           | Cuándo se envió, en segundos Unix.                                                      | Sí, la etiqueta de antigüedad. |
| `cacheMinutes` | Cuánto dura la caché del prompt; ausente cuando ninguna conversación tiene una.         | Se lee, no se muestra.         |
| `usage`        | Una fila, `ntfy`, con la cuenta de ntfy.sh de los mensajes de hoy desde tu red.         | No, se ignora.                 |
| `limits`       | Los límites de 5 horas y semanal de Claude: porcentaje, color y reinicio.               | Sí, en todas partes.           |
| `sessions`     | Hasta 8 conversaciones abiertas, la más importante primero: título, estado y etiqueta.  | Sí, tile y app.                |

Los dos campos nuevos los construyen dos funciones puras al final de `hooks/phone.ts`. Estos fragmentos son de narsil-pet (GPL v3); el formateador de este sitio ha partido sus líneas largas y ha añadido comas finales y paréntesis, y nada más difiere del archivo:

```ts
// One Claude limit as the watch draws it: its arc, its color and when it
// resets, in seconds since the epoch (null when Claude did not say).
export type WatchLimit = {
  key: 'fiveHour' | 'week'
  label: string
  percent: number
  color: string
  resetsAt: number | null
}

type Meter = { percent: number; resetsAt?: string }

// The 5-hour and weekly limits; the context is each conversation's own.
export function watchLimits(u: { fiveHour: Meter | null; week: Meter | null }): WatchLimit[] {
  const row = (key: WatchLimit['key'], label: string, m: Meter | null): WatchLimit[] => {
    if (!m) return []
    const at = m.resetsAt ? Date.parse(m.resetsAt) : NaN
    return [
      {
        key,
        label,
        percent: m.percent,
        color: levelColor(m.percent),
        resetsAt: Number.isNaN(at) ? null : Math.floor(at / 1000),
      },
    ]
  }
  return [...row('fiveHour', '5 horas', u.fiveHour), ...row('week', 'Semana', u.week)]
}
```

Y justo debajo, las conversaciones:

```ts
export type WatchSession = { title: string; status: string; label: string }

// The open conversations, most important first, as few and as short as an
// ntfy message (4 KB, more once sealed) holds with room to spare.
export const WATCH_SESSIONS = 8
const WATCH_TITLE = 40

export function watchSessions(list: readonly WatchSession[]): WatchSession[] {
  return list.slice(0, WATCH_SESSIONS).map((s) => {
    const title = s.title || 'conversación'
    return {
      title: title.length > WATCH_TITLE ? `${title.slice(0, WATCH_TITLE - 1)}…` : title,
      status: s.status,
      label: s.label,
    }
  })
}
```

Qué hay que notar:

- **`limits` tiene cero, una o dos filas**, `fiveHour` con la etiqueta `5 horas` y `week` con la etiqueta `Semana`. Un límite que Claude Code no ha informado se omite, no se envía como cero, y `resetsAt` va en segundos, o es `null` cuando Claude no lo dijo. Los valores vienen del `usage` del mod, que `usageOf` en `hooks/usage.ts` rellena a partir de los límites de uso de la sesión de tipo `five_hour` y `seven_day`, los mismos que lee la línea de estado de Claude Code.
- **El color se decide en el PC.** `levelColor` en `hooks/usage.ts` devuelve `#F0435A` (rojo) desde el 85 %, `#F5B400` (amarillo) desde el 60 %, y `#22B573` (verde) por debajo. El reloj pinta lo que le dicen, así que el PC y el reloj nunca discrepan.
- **`sessions` es la lista ordenada del mod.** `fleetOf` en `hooks/fleet.ts` ordena por `RANK`, "An error first, then what needs you, what works, what finished" (primero un error, después lo que te necesita, lo que trabaja, lo que terminó): `error`, `waiting`, `working`, `done`, `idle`. Entre iguales, va primero la que cambió más recientemente.
- **Como mucho 8 sesiones, con títulos de como mucho 40 caracteres.** El comentario da la razón: un mensaje de ntfy está limitado a 4 KB, y el sellado lo alarga. Un título vacío se convierte en `conversación`.
- **`status` es la palabra para la máquina y `label` la palabra para la pantalla**, de `STATUS_LABEL` en `hooks/words.ts`: `working` es `TRABAJANDO`, `idle` es `PARADA`, `waiting` es `TE NECESITA`, `done` es `TERMINADA`, `error` es `ERROR`. El reloj colorea según `status` y escribe `label`.

Un estado tal como lo recibe el reloj, escrito para esta guía con valores inventados:

```json
{
  "xp": "⭐ Nivel 3 · 40/300 XP",
  "art": "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/error-oscuro.png",
  "at": 1763900000,
  "cacheMinutes": 5,
  "usage": [],
  "limits": [
    {
      "key": "fiveHour",
      "label": "5 horas",
      "percent": 62.4,
      "color": "#F5B400",
      "resetsAt": 1763918000
    },
    { "key": "week", "label": "Semana", "percent": 90, "color": "#F0435A", "resetsAt": null }
  ],
  "sessions": [
    { "title": "web", "status": "error", "label": "ERROR" },
    { "title": "landing", "status": "waiting", "label": "TE NECESITA" }
  ]
}
```

Es la misma forma que usa `StatusParserTest.kt`.

### NarsilState.kt: el contrato en el reloj

El reloj declara la misma forma en Kotlin. El archivo entero, de `domain/NarsilState.kt` en narsil-watch (GPL v3), sin sus líneas de paquete e importaciones:

```kotlin
// What Narsil publishes on its ntfy status topic, as hooks/register.tsx
// (sendStatus) builds it. Fields the PC adds later are ignored; fields it
// does not send yet default to empty.
@Serializable
data class NarsilState(
    val xp: String? = null,
    val art: String? = null,
    // seconds since the epoch
    val at: Long = 0,
    val cacheMinutes: Int? = null,
    val limits: List<Limit> = emptyList(),
    val sessions: List<Session> = emptyList(),
)

// One Claude limit: the 5-hour window or the week.
@Serializable
data class Limit(
    val key: String,
    val label: String,
    val percent: Double,
    val color: String,
    // seconds since the epoch, null when Claude did not say
    val resetsAt: Long? = null,
)

// One open conversation, most important first.
@Serializable
data class Session(
    val title: String,
    val status: String,
    val label: String,
)
```

El primer comentario es la regla de diseño, y funciona en los dos sentidos:

- **Los campos que el PC añada más adelante se ignoran.** El analizador se construye con `Json { ignoreUnknownKeys = true }`. Por eso `usage` no causa ningún error: no está declarado, así que se salta. Un campo futuro se saltará igual.
- **Los campos que el PC todavía no envía quedan vacíos por defecto.** Un estado anterior a la 3.10.0 no tiene `limits` ni `sessions`, y el test "reads a state from before the watch fields, with no limits or sessions" (lee un estado anterior a los campos del reloj, sin límites ni sesiones) comprueba que se sigue leyendo, con las dos listas vacías.

Dentro de un `Limit` o de un `Session`, en cambio, solo `resetsAt` tiene un valor por defecto. Un límite sin su `key`, o una sesión sin su `label`, hace fallar toda la decodificación, y el analizador trata el mensaje como si no hubiera estado.

### StatusRepository.kt: la petición

`refresh()`, el único sitio que le pide el estado a ntfy.sh, se ejecuta en `Dispatchers.IO`, fuera del hilo principal. Su línea de petición:

```kotlin
val url = "$NTFY/${URLEncoder.encode(statusTopic, "UTF-8")}/json?poll=1&since=latest"
```

Pieza a pieza:

- **`$NTFY`** es `https://ntfy.sh`.
- **`statusTopic`** es `topic.removeSuffix(STATUS_SUFFIX) + STATUS_SUFFIX`, con `STATUS_SUFFIX` igual a `-estado`. Así, el reloj funciona tanto si escribes `narsil-0000000000example0` como si, por error, escribes `narsil-0000000000example0-estado`: nunca acaba pidiendo `-estado-estado`. El tema se codifica para URL antes de entrar en la ruta.
- **`/json`** le pide a ntfy.sh su flujo JSON: un objeto JSON por línea, cada uno con un campo `event`.
- **`poll=1`** pide lo que ntfy.sh ha guardado y después cierra la conexión, en lugar de mantenerla abierta esperando mensajes nuevos. Un reloj no debería mantener una conexión abierta.
- **`since=latest`** pide solo el mensaje más reciente. El reloj no necesita nada más antiguo: cada estado sustituye al anterior.

La función auxiliar `get(url, limit)` abre una `HttpURLConnection` con un tiempo de espera de conexión de 10 segundos y otro de lectura de 10 segundos (`TIMEOUT = 10_000`). Devuelve `null` salvo que la respuesta sea HTTP 200. Lee como mucho `limit + 1` bytes, y devuelve `null` si había más de `limit`: 64 KB para el estado (`MAX_STATE`), 256 KB para el dibujo (`MAX_ART`). Un tema que alguien haya llenado de basura no puede hacer que el reloj lea megabytes.

### Lo que guarda, y cuándo

El repositorio guarda cinco cosas en el archivo privado de `SharedPreferences` `narsil`, más un archivo:

| Clave o archivo | Qué contiene                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| `topic`         | Tu tema, sin espacios sobrantes.                                                 |
| `key`           | Tu clave, sin espacios sobrantes, o vacía.                                       |
| `raw`           | La respuesta en bruto de ntfy de la última lectura buena.                        |
| `checkedAt`     | Cuándo obtuvo el reloj por última vez una respuesta de ntfy.sh, en milisegundos. |
| `art.png`       | El último dibujo de Narsil, en la carpeta de archivos privados de la app.        |
| `artUrl`        | La URL de la que salió ese dibujo.                                               |

El resto de `refresh()` decide qué guardar. De `data/StatusRepository.kt` en narsil-watch (GPL v3):

```kotlin
val lines = try {
    get(url, MAX_STATE)?.toString(Charsets.UTF_8)
} catch (_: IOException) {
    null
} ?: return@withContext cached()?.let { StatusResult.Ok(it) } ?: StatusResult.Empty
val result = StatusParser.parse(lines, key.ifEmpty { null })
prefs.edit().putLong(CHECKED_AT, System.currentTimeMillis()).apply()
if (result is StatusResult.Ok) {
    prefs.edit().putString(RAW, lines).apply()
    result.state.art?.let { fetchArt(it) }
}
result
```

Así que:

- **Sin red, un tiempo de espera agotado, un error HTTP o una respuesta demasiado grande:** no cambia nada, `checkedAt` incluido. El resultado es el estado guardado, si lo hay. Estar sin conexión no es un error que muestre el reloj.
- **Una respuesta que se lee como estado:** las líneas en bruto sustituyen a `raw`, `checkedAt` avanza y el dibujo se descarga si su URL cambió.
- **Una respuesta vacía, con ruido o sellada con otra clave:** `checkedAt` avanza, pero `raw` se conserva. Un mensaje malo nunca borra una lectura buena.

Hay un detalle fácil de pasar por alto. El repositorio guarda la respuesta **en bruto**, no el estado decodificado, y `cached()` la vuelve a analizar cada vez, con la clave tal como está en ese momento:

```kotlin
fun cached(): NarsilState? = (StatusParser.parse(prefs.getString(RAW, "").orEmpty(), key.ifEmpty { null }) as? StatusResult.Ok)?.state
```

Eso mantiene un único camino de código para leer, y significa que la copia guardada de un estado sellado sigue sellada en el almacenamiento del reloj. El precio: si cambias la clave, una copia sellada guardada de antes ya no se abre.

### StatusParser.kt: de las líneas de ntfy a un estado

`parse` devuelve uno de tres resultados:

```kotlin
sealed interface StatusResult {
    data class Ok(val state: NarsilState) : StatusResult

    // the topic holds no state yet, or only noise
    data object Empty : StatusResult

    // sealed, and the watch has no key or the wrong one
    data object NeedsKey : StatusResult
}
```

Esas líneas y el siguiente fragmento son de `data/StatusParser.kt` en narsil-watch (GPL v3). El trabajo:

```kotlin
val message = ntfyLines.lineSequence()
    .filter { it.isNotBlank() }
    .mapNotNull { line -> objectOf(line) }
    .filter { it["event"]?.jsonPrimitive?.content == "message" }
    .lastOrNull()
    ?.get("message")?.jsonPrimitive?.content
    ?: return StatusResult.Empty
val body = if (message.startsWith(Seal.PREFIX)) {
    val inside = key?.let { Seal.unseal(it, message) } ?: return StatusResult.NeedsKey
    // what goes inside the seal is { message } (sealedPayload)
    objectOf(inside)?.get("message")?.jsonPrimitive?.content ?: return StatusResult.Empty
} else {
    message
}
```

Paso a paso:

1. **Cada línea es un evento de ntfy.** Las líneas que no son objetos JSON se saltan. Solo cuentan los eventos de tipo `message`; ntfy puede enviar otros.
2. **Gana el último mensaje.** Con `since=latest` suele haber uno solo, pero tomar el último hace que el analizador acierte con cualquier respuesta.
3. **Su campo `message` es el texto del mod**, el estado como una cadena JSON.
4. **Si empieza por `narsil1:`, va sellado.** Sin clave, o si la clave no lo abre, el resultado es `NeedsKey`.
5. **Dentro del sello hay otro sobre.** El mod sella `sealedPayload(m)`, que para un mensaje sin título es `{"message": "..."}`. Así que el analizador lee ese `message` interior, que es el estado.
6. **El estado se decodifica en `NarsilState`.** Una `SerializationException` o una `IllegalArgumentException` dan `Empty`.

### Seal.kt: abrir el sello con la misma clave

`/narsil movil clave` hace que el mod selle todo lo que envía. [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica el esquema desde el lado del mod; aquí está la mitad del reloj. `Seal.kt` implementa solo `unseal`, porque el reloj nunca sella nada.

El comentario al principio del archivo indica el formato, de `data/Seal.kt` en narsil-watch (GPL v3):

```kotlin
// Opens what Narsil seals with /narsil movil clave (hooks/seal.ts):
// HMAC-SHA256 in counter mode as the keystream, then a second HMAC over the
// nonce and the ciphertext (encrypt-then-MAC). "narsil1:" + base64url of
// nonce (16) | ciphertext | tag (32).
```

`unseal(key, sealed)` hace exactamente lo que hace el `unseal` de narsil-pet, en el mismo orden:

1. **El prefijo.** Sin `narsil1:`, devuelve `null`.
2. **Los bytes.** El resto se decodifica de base64url. Menos de 48 bytes (16 de nonce más 32 de etiqueta) devuelve `null`.
3. **La clave.** Tu clave, 43 caracteres base64url, se decodifica en sus 32 bytes.
4. **Primero la etiqueta.** `macKey = HMAC(key, "mac")`, después `HMAC(macKey, nonce ‖ ciphertext)`, comparada con los últimos 32 bytes. Si es distinta, devuelve `null` sin descifrar nada.
5. **Solo entonces el texto.** `encKey = HMAC(key, "enc")`. El bloque `i` del flujo de clave es `HMAC(encKey, nonce ‖ i)`, con `i` en 4 bytes, big-endian. Cada bloque da 32 bytes, combinados con XOR con el texto cifrado. El resultado se lee como UTF-8.

Los dos lados difieren en el cómo, no en el qué:

| Paso                 | narsil-pet `hooks/seal.ts`                                                                                                                               | narsil-watch `Seal.kt`                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| HMAC-SHA256          | Construido a mano sobre `crypto.subtle.digest`, porque "The hooks module's crypto has SHA-256 alone" (el crypto del módulo de hooks solo tiene SHA-256). | `javax.crypto.Mac` con `HmacSHA256`.                                    |
| Base64url            | Sus propios `toBase64Url` y `fromBase64Url`, sobre `btoa` y `atob`.                                                                                      | `java.util.Base64.getUrlDecoder()`.                                     |
| Comparar la etiqueta | `tag.some((b, i) => b !== given[i])`.                                                                                                                    | `MessageDigest.isEqual`, que tarda lo mismo sean cuales sean los bytes. |
| Errores              | Cualquier excepción da `null`.                                                                                                                           | Una `IllegalArgumentException` da `null`.                               |

El test que demuestra que coinciden es `SealTest.kt`. Su comentario: "The vector comes from Narsil's own hooks/seal.ts, with a fixed nonce (100..115), so the watch opens exactly what the PC seals." (el vector sale del propio hooks/seal.ts de Narsil, con un nonce fijo, 100..115, para que el reloj abra exactamente lo que sella el PC). La clave son los bytes del 0 al 31, `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`; el texto en claro es un pequeño `{"message": ...}` con un `xp` y una sesión. Los 16 bytes de nonce del 100 al 115 son las letras `defghijklmnopqrs`, y por eso el texto sellado empieza por `narsil1:ZGVmZ2hpamtsbW5vcHFyc`, su base64url.

Para esta guía, el vector también se comprobó en el otro sentido: ejecutar el `seal()` de narsil-pet de `hooks/seal.ts` con esa clave, ese texto y ese nonce da exactamente la cadena de `SealTest.kt`.

### Qué pasa con una clave equivocada, sin clave o con un mensaje sin sellar

Esto es preciso en el código, así que aquí va caso por caso:

| El mensaje del tema               | La clave del reloj | `Seal.unseal`                   | `StatusParser.parse`         |
| --------------------------------- | ------------------ | ------------------------------- | ---------------------------- |
| Sellado                           | La correcta        | El texto interior               | `Ok`                         |
| Sellado                           | Ninguna            | No se llama                     | `NeedsKey`                   |
| Sellado                           | Otra clave válida  | `null`: la etiqueta no coincide | `NeedsKey`                   |
| Sellado, con un carácter cambiado | La correcta        | `null`: la etiqueta no coincide | `NeedsKey`                   |
| Sin sellar                        | Ninguna            | No se llama                     | `Ok`, leído como JSON normal |
| Sin sellar                        | Cualquier clave    | No se llama                     | `Ok`, leído como JSON normal |
| Sin sellar, y no es un estado     | Cualquiera         | No se llama                     | `Empty`                      |

`SealTest.kt` cubre la columna de `Seal`: "opens what Narsil seals" (abre lo que sella Narsil), "another key opens nothing" (otra clave no abre nada), "a tampered message opens nothing" (un mensaje manipulado no abre nada) y "what is not sealed opens nothing" (lo que no va sellado no abre nada), que comprueba que `unseal(key, "no sellado")` y `unseal("not base64!", sealed)` den los dos `null`. `StatusParserTest.kt` cubre la última columna en "a sealed state needs the key" (un estado sellado necesita la clave).

De ahí se siguen dos consecuencias.

**Una clave equivocada también oculta el estado guardado.** Después de un `NeedsKey`, `raw` no se toca, pero `cached()` lo vuelve a analizar con la clave equivocada. Si la copia guardada iba sellada, tampoco se abre: el tile dice `configúrame`, la complicación no muestra datos y la app muestra su nota `El estado va sellado: falta la clave o no es la de /narsil movil clave.` Vuelve a poner la clave correcta y todo regresa, desde el mismo `raw`.

**Una clave no hace que el reloj rechace los mensajes normales.** El analizador solo llama a `unseal` para un texto que empieza por `narsil1:`. Un estado sin sellar se lee tengas clave o no. Eso mantiene el reloj funcionando después de `/narsil movil clave off`, pero también significa que cualquiera que conozca tu tema puede publicar un estado sin sellar, y el reloj lo mostrará. La clave protege lo que lees frente a los demás; no demuestra quién escribió lo que lees.

### El dibujo: solo desde narsil-pet

Cuando una lectura es buena, el repositorio descarga el dibujo indicado en `art`. De `StatusRepository.kt` (GPL v3):

```kotlin
// Narsil's art, only from the repository that publishes it: whoever knows
// an unsealed topic could write to it.
private fun fetchArt(url: String) {
    if (!url.startsWith(ART_ORIGIN) || url == prefs.getString(ART_URL, null)) return
```

`ART_ORIGIN` es `https://raw.githubusercontent.com/davshn/narsil-pet/`. El comentario es la razón: un estado sin sellar falsificado podría indicar cualquier URL, y esta comprobación impide que el reloj la descargue. También se salta la descarga cuando la URL es la que ya está en disco, así que la misma pose se descarga una sola vez. El dibujo se escribe en `art.png` solo si ocupa 256 KB o menos.

### Los secretos, en palabras sencillas

- **El tema** se guarda en las preferencias privadas de la app, y solo viaja en la ruta de la petición a ntfy.sh. Permite a cualquiera leer tus mensajes y publicar en el tema. Cámbialo con `/narsil movil nuevo` y después escribe el nuevo en el reloj.
- **La clave** se guarda a su lado y nunca se envía a ningún sitio. Abre los mensajes sellados. `/narsil movil clave` crea una nueva cada vez; la antigua deja de abrir los mensajes nuevos.
- **Las propias palabras del mod todavía nombran receptores más antiguos.** El comentario de `hooks/seal.ts` nombra "the PC, the Firefox extension and the phone app" (el PC, la extensión de Firefox y la app del móvil), y la respuesta de `/narsil movil clave` dice que pegues la clave en "la extensión de Firefox". El reloj abre el mismo sello; pega la misma clave en **Configurar**.

## Constrúyelo con Claude

Pídele a Claude solo la capa de datos, sin ninguna pantalla: las clases del estado, el analizador, el sello y el repositorio, con tests. La idea que debe acertar es que una respuesta mala nunca sustituye a una lectura buena.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt del autor.

> En mi app de Wear OS `my-watch` (Kotlin, kotlinx.serialization), escribe la capa de datos para el estado de ntfy de Narsil. `domain/NarsilState.kt`: clases `@Serializable` para `{ xp, art, at, cacheMinutes, limits: [{ key, label, percent, color, resetsAt }], sessions: [{ title, status, label }] }`, cada campo de primer nivel con un valor vacío por defecto. `data/Seal.kt`: `unseal(key, sealed): String?` para el formato de `hooks/seal.ts` de narsil-pet (prefijo `narsil1:`, base64url de nonce 16 + texto cifrado + etiqueta 32; `macKey = HMAC(key,"mac")`, `encKey = HMAC(key,"enc")`, bloque i del flujo de clave = `HMAC(encKey, nonce ‖ i as 4 bytes big-endian)`, comprueba la etiqueta con `MessageDigest.isEqual` antes de descifrar). `data/StatusParser.kt`: analiza las líneas JSON de ntfy, quédate con el último `event == "message"`, ábrelo si va sellado (el JSON interior es `{ message }`) y devuelve `Ok`, `Empty` o `NeedsKey`. `data/StatusRepository.kt`: GET a `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest` con tiempos de espera de 10 s y un tope de 64 KB; guarda las líneas en bruto solo cuando se analizan como `Ok`; ante un error de red, devuelve el estado guardado. Tests de JUnit, incluido un vector conocido sellado por `hooks/seal.ts` con un nonce fijo.

### Qué revisar en la respuesta de Claude

1. La petición usa `poll=1&since=latest`, codifica el tema y añade `-estado` sin duplicarlo.
2. La respuesta tiene un tope de tamaño, y solo se lee un HTTP 200.
3. La respuesta en bruto se guarda solo cuando se analiza como estado. Un error de red, un tema vacío o una clave equivocada nunca la sobrescriben.
4. `unseal` comprueba la etiqueta antes de descifrar, y la compara con `MessageDigest.isEqual`.
5. Los campos desconocidos se ignoran (`ignoreUnknownKeys = true`), y un estado sin `limits` ni `sessions` se sigue leyendo.
6. Hay un test con un vector producido por el propio `seal.ts` del mod, no solo un viaje de ida y vuelta en el lado del reloj. Un viaje de ida y vuelta solo demuestra que el reloj está de acuerdo consigo mismo.

Si una comprobación falla, dile a Claude lo que ves: "después de un error de red el tile se quedó en blanco", lo que apunta a que el camino de error sobrescribe el estado guardado.

### Cómo lo pidió el autor

No existe ninguna petición registrada para esta parte. Esto es una reconstrucción a partir del historial de commits:

- narsil-pet `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (sellar los mensajes del móvil con /narsil movil clave, enviar las horas de reinicio y un botón Abrir Claude). El sello nace en el lado del mod.
- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (publicar los límites de Claude y las conversaciones abiertas para el reloj). Llegan `watchLimits` y `watchSessions`, con el test "the watch gets the 5-hour and weekly limits with their color and reset, and at most 8 conversations" (el reloj recibe los límites de 5 horas y semanal con su color y su reinicio, y como mucho 8 conversaciones). Su mensaje: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." (el tema de estado lleva ahora los límites de 5 horas y semanal, porcentaje, color y reinicio, y hasta 8 conversaciones abiertas, para que una app de Wear OS pueda mostrarlos).
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil en Wear OS con los límites de Claude y las conversaciones abiertas). La capa de datos y sus tests llegan con el resto de la app. Su mensaje termina: "It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed." (lee el estado de Narsil de su tema de estado de ntfy.sh y lo abre con la clave de /narsil movil clave cuando va sellado).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Un lector reducido, escrito para esta guía y adaptado de `StatusParser.kt`, `StatusRepository.kt` y `Seal.kt` en [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa solo las llamadas de Java y de kotlinx.serialization que usan esos archivos. Deja fuera el dibujo y la copia guardada:

```kotlin
package com.example.mywatch.data

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object StateReader {
    private const val PREFIX = "narsil1:"
    private const val NONCE = 16
    private const val BLOCK = 32
    private const val MAX = 64 * 1024
    private val json = Json { ignoreUnknownKeys = true }

    fun fetch(topic: String): String? {
        val name = topic.removeSuffix("-estado") + "-estado"
        val url = "https://ntfy.sh/${URLEncoder.encode(name, "UTF-8")}/json?poll=1&since=latest"
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        return try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
            val bytes = conn.inputStream.use { input ->
                val out = ByteArrayOutputStream()
                val buf = ByteArray(8192)
                while (out.size() <= MAX) {
                    val read = input.read(buf)
                    if (read < 0) break
                    out.write(buf, 0, read)
                }
                out.toByteArray()
            }
            if (bytes.size > MAX) null else bytes.toString(Charsets.UTF_8)
        } finally {
            conn.disconnect()
        }
    }

    fun stateText(lines: String, key: String?): String? {
        val message = lines.lineSequence()
            .mapNotNull { line ->
                try {
                    json.parseToJsonElement(line).jsonObject
                } catch (_: SerializationException) {
                    null
                } catch (_: IllegalArgumentException) {
                    null
                }
            }
            .filter { it["event"]?.jsonPrimitive?.content == "message" }
            .lastOrNull()
            ?.get("message")?.jsonPrimitive?.content ?: return null
        if (!message.startsWith(PREFIX)) return message
        val inside = key?.let { unseal(it, message) } ?: return null
        return json.parseToJsonElement(inside).jsonObject["message"]?.jsonPrimitive?.content
    }

    fun unseal(key: String, sealed: String): String? {
        if (!sealed.startsWith(PREFIX)) return null
        return try {
            val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix(PREFIX))
            if (bytes.size < NONCE + BLOCK) return null
            val k = Base64.getUrlDecoder().decode(key)
            val body = bytes.copyOfRange(0, bytes.size - BLOCK)
            val tag = hmac(hmac(k, "mac".toByteArray()), body)
            if (!MessageDigest.isEqual(tag, bytes.copyOfRange(bytes.size - BLOCK, bytes.size))) return null
            val encKey = hmac(k, "enc".toByteArray())
            val nonce = bytes.copyOfRange(0, NONCE)
            val cipher = bytes.copyOfRange(NONCE, bytes.size - BLOCK)
            val out = ByteArray(cipher.size)
            for (i in cipher.indices) {
                val block = i / BLOCK
                val counter = byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte())
                out[i] = (cipher[i].toInt() xor hmac(encKey, nonce + counter)[i % BLOCK].toInt()).toByte()
            }
            String(out, Charsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }
}
```

Dos simplificaciones que conviene conocer. El bucle de lectura se detiene un poco después de los 64 KB en lugar de en 64 KB más un byte, lo que basta para rechazar una respuesta demasiado grande; el `readNBytesCompat` del repositorio real se detiene exactamente. Y esta versión vuelve a calcular el bloque del flujo de clave para cada byte, por brevedad, 32 veces más trabajo; el `xorStream` real calcula cada bloque una sola vez. `stateText` devuelve `null` tanto para "no hay estado" como para "necesita la clave"; el analizador real los mantiene separados, porque la app te dice cuál de los dos es.

## Errores comunes y cómo probarlo

- **Mantener la conexión abierta.** Sin `poll=1`, el endpoint `/json` de ntfy sigue enviando datos. En un reloj eso gasta batería, y da un trabajo de refresco que nunca termina.
- **Sobrescribir la lectura buena.** Guardar cada respuesta significa que una sola consulta vacía, después de que ntfy.sh haya olvidado el mensaje, deja el tile en blanco.
- **Olvidar el sobre interior.** El texto sellado se abre en `{"message": "..."}`, no en el estado en sí.
- **Suponer que una clave significa "solo sellados".** Un estado sin sellar se sigue leyendo. Trata un estado sin sellar como posiblemente falsificado cuando hay una clave configurada, si eso te importa.
- **Un decodificador estricto.** Sin `ignoreUnknownKeys`, el campo `usage`, que no está declarado, hace fallar todos los estados.

Para ejecutar los tests, desde el repositorio:

```bash
./gradlew :app:testDebugUnitTest
```

`StatusParserTest.kt` tiene cuatro tests: "reads the state as the PC sends it in the clear" (lee el estado tal como el PC lo envía en claro), "reads a state from before the watch fields, with no limits or sessions" (lee un estado anterior a los campos del reloj, sin límites ni sesiones), "a sealed state needs the key" (un estado sellado necesita la clave) y "an empty topic or noise is no state yet" (un tema vacío o con ruido todavía no es un estado). `SealTest.kt` tiene los cuatro de arriba.

Para comprobarlo contra el tema real desde tu PC, puedes hacerle a ntfy.sh la misma pregunta que le hace el reloj. Esto está escrito para esta guía, con el tema de ejemplo:

```bash
curl -s "https://ntfy.sh/narsil-0000000000example0-estado/json?poll=1&since=latest"
```

Usa tu propio tema solo en tu propio terminal, nunca en uno compartido ni en una captura de pantalla.

### Dónde difieren el código y el README

- El README de narsil-pet sigue documentando cinco campos para `-estado` (`xp`, `art`, `at`, `cacheMinutes`, `usage`). Desde la 3.10.0 su código envía siete; `limits` y `sessions` faltan en esa tabla. El test de narsil-pet "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" (cuando termina un turno desde el móvil, la extensión recibe solo lo que lee en el tema de estado, en silencio) enumera los siete.
- El README de narsil-pet dice que el estado sale "At the end of each turn" (al final de cada turno). El código también lo envía con cada pregunta, y solo mientras estás fuera.
- El README del reloj dice que la clave permite al reloj abrir el estado "just as the computer sealed it" (tal como lo selló el PC). Es cierto, y el código añade algo que el README no dice: con una clave configurada, un mensaje sin sellar se sigue aceptando.

## Para ir más lejos

- Lee `data/` en [narsil-watch](https://github.com/davshn/narsil-watch) en GitHub.
- El lado del mod del tema, la cuenta diaria y el sello: [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/).
- Haz que el analizador rechace los mensajes sin sellar cuando hay una clave configurada, para que se ignore un estado falsificado. Piensa en qué pasa entonces justo después de `/narsil movil clave off`.
- Vuelve a [Qué es Narsil Watch](/es/watch/what-it-is/) para ver el conjunto.
- Lo siguiente: [El tile](/es/watch/tile/), los dos anillos y Narsil en el centro.
