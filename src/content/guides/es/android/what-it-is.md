---
title: Qué es Narsil para Android
description: 'Una app experimental para Android que aloja claude.ai en una WebView con los colores, la franja y el bloque del menú lateral de Narsil, y convierte los avisos del mod en ntfy.sh en notificaciones.'
route: android
order: 1
updated: 2026-11-24
sources:
  - repo: android
    path: README.md
  - repo: android
    path: odd/tasks/android-app.md
  - repo: android
    path: app/src/main/AndroidManifest.xml
  - repo: android
    path: app/build.gradle.kts
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: pet
    path: hooks/register.tsx
---

## Qué hace

Narsil para Android es una app para el móvil que junta dos cosas en un solo lugar: la app web de Claude, `claude.ai`, y los avisos que el [mod de Narsil](/es/mods/pet/phone-and-watch/) envía a tu móvil. La abres como cualquier app. Dentro ves el `claude.ai` real, con tu cuenta iniciada, así que puedes aprobar permisos, responder preguntas, subir archivos y leer conversaciones completas como siempre. Encima, Narsil pone sus propios toques:

- **Los colores de Narsil.** Claude se viste con la paleta de mar nocturno de Narsil Skin, clara de 6:00 a 17:59 y oscura el resto del día, sea cual sea la apariencia que elegiste en Claude ([guía 5](/es/android/colors-and-mode/)).
- **La franja.** Justo encima de la caja donde escribes, una franja muestra la conversación abierta: Narsil en la pose de su estado, el estado (`TRABAJANDO`, `TE NECESITA`, `TERMINADA` o `EN REPOSO`), el contexto usado, la cuenta atrás de la caché y lo último que dijo Claude ([guía 3](/es/android/conversation-band/)).
- **El bloque del menú lateral.** Debajo de la búsqueda en el menú lateral de Claude: el nivel y la experiencia de Narsil, tus límites de 5 horas y de la semana, y la cuenta de ntfy.sh del día ([guía 4](/es/android/sidebar/)).
- **Avisos.** Cuando una conversación termina, te necesita o falla, llega una notificación, incluso con la app cerrada y después de reiniciar el móvil ([guía 6](/es/android/alerts-service/)).
- **Cifrado.** Con una clave de `/narsil movil clave`, la app abre lo que el mod selló ([guía 7](/es/android/encryption-and-settings/)).
- **Inicias sesión una vez.** La sesión se mantiene hasta que Claude la cierre o borres los datos de la app.
- **Archivos y voz.** El botón **+** de Claude abre el selector de archivos del móvil, y el micrófono funciona para dictar.

> **Experimental.** La app se apoya en la estructura de la página de `claude.ai` y en sus peticiones internas, no en una API pública. La franja encuentra la caja de texto y el menú lateral por el marcado de la página, los colores reemplazan las variables de diseño de la propia página, y los límites y los datos de las conversaciones vienen de direcciones que la página usa para sí misma. Una actualización de Claude puede romper cualquiera de estas cosas; cuando pasa, esa parte deja de mostrarse y Claude sigue funcionando. Además es un proyecto personal, que se instala desde el código fuente con una compilación de depuración.

La app es de código abierto bajo la licencia MIT, y no está afiliada con Anthropic. Su interfaz y las palabras de Narsil están en español, y esta ruta muestra las etiquetas tal como aparecen.

## Cómo funciona por dentro

### Por qué una app con una WebView

A la app nativa de Claude no se le puede añadir nada: ejecuta su propio código y no ofrece forma de cargar el tuyo. En un PC, lo habitual para cambiar una página web es una extensión de navegador, pero Chrome para Android no admite extensiones. Por eso la extensión de navegador anterior, la que dibujaba a Narsil en `claude.ai`, necesitaba un navegador que sí las admitiera, y eso era una app más que instalar y mantener con la sesión iniciada.

Una WebView resuelve los dos problemas. Es el motor web integrado de Android, el mismo Chromium que mueve a Chrome, metido en la ventana de una app. La app dueña de la WebView decide qué se ejecuta en ella: aquí carga `claude.ai`, ejecuta los scripts y los estilos de Narsil al inicio de cada página y les responde desde Kotlin. El primer mensaje de quien creó Narsil, recogido en el registro de tareas, pedía justo eso: una app móvil completa que reciba las notificaciones y que, dentro de una web view, muestre la web de Claude y cambie sus estilos como lo hacía la extensión.

Los scripts que dibujan la franja, el bloque y los colores siguen las mismas ideas que tenía la extensión, y buena parte de su código es el mismo: todavía hablan con un objeto `browser`, como hacen los scripts de una extensión. La app les da uno, escrito en `host.js`, y responde de forma nativa a cada llamada. La [guía 2](/es/android/webview-host/) explica ese anfitrión.

### Las piezas

Todo el código de la app está en un único módulo de Gradle, `app`, con el paquete `io.github.davshn.narsil`:

| Archivo                                                       | Qué hace                                                                                                         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `MainActivity.kt`                                             | La WebView: configuración, cookies, archivos, micrófono, ventanas emergentes y adónde va cada enlace.            |
| `PageScript.kt` y `assets/host.js`                            | Construye el único script que se ejecuta al inicio de cada página de `claude.ai`, y el "navegador" de la página. |
| `assets/page/`                                                | Los colores de Narsil (`skin.css`, `mode.js`) y la franja (`content.js`, `band.css`, `lib/`).                    |
| `StateFeed.kt` y `StateModel.kt`                              | Siguen `<tu tema>-estado` para la franja y guardan el estado más reciente.                                       |
| `AlertService.kt`, `NtfyStream.kt`, `Alert.kt`, `Notifier.kt` | Siguen tu tema en segundo plano y convierten cada mensaje en una notificación.                                   |
| `BootReceiver.kt`                                             | Vuelve a arrancar los avisos después de un reinicio o una actualización.                                         |
| `Seal.kt`                                                     | Abre lo que el mod selló con `/narsil movil clave`.                                                              |
| `Settings.kt` y `SettingsActivity.kt`                         | El tema, la clave y lo que la app recuerda, en almacenamiento privado.                                           |
| `Links.kt`                                                    | Qué direcciones se quedan en la app.                                                                             |

No hay servidor propio, ni Firebase, ni analítica: el módulo depende de tres bibliotecas de AndroidX (`core-ktx`, `webkit` y `activity`), y de JUnit y `org.json` para las pruebas.

### Lo que necesita del mod de Narsil

La app lee dos temas en [ntfy.sh](https://ntfy.sh), los dos creados por el mod de Narsil en Claude Code en tu PC:

- **Tu tema**, por ejemplo `narsil-0000000000example0`, donde el mod publica un aviso cuando una conversación termina, te necesita o falla.
- **`<tu tema>-estado`**, donde el mod publica un estado silencioso al terminar cada turno y con cada pregunta: el nivel de Narsil, su dibujo en su etapa, cuánto dura una caché y la cuenta de ntfy.sh de los mensajes del día.

El mod envía los dos solo mientras le escribes a Claude por Remote Control, es decir, desde el móvil o desde la web. En cuanto vuelves a escribir en el escritorio, deja de enviarlos. Además se limita a 200 mensajes al día, por debajo del margen gratuito de ntfy.sh. [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica a fondo el lado del mod.

Sin el mod, la app sigue funcionando como Claude con los colores de Narsil, la franja sigue mostrando el estado, el contexto, la caché y el último evento de cada conversación, y el bloque tus límites: todo eso viene del propio `claude.ai`. Lo que pierdes es lo que solo sabe tu PC: los avisos, el nivel de Narsil, su etapa en los dibujos (en su lugar aparece el icono de la app), la cuenta de ntfy.sh y la duración real de la caché (la franja supone 60 minutos).

### Sistemas compatibles

| Qué                    | Qué se necesita                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Android                | 10 o posterior (`minSdk = 29`); compilada para Android 16 (`targetSdk = 36`)                    |
| Android System WebView | Una que pueda ejecutar scripts al inicio de una página y hablar con la app; cualquiera reciente |
| Inicio de sesión       | El correo de tu cuenta de Claude; los botones de Google y de Apple no funcionan aquí            |
| iPhone                 | No disponible                                                                                   |
| Para compilarla        | Un PC con JDK 17 o posterior y el Android SDK (`ANDROID_HOME`); Gradle viene incluido           |

La comprobación de la WebView está en el código. `MainActivity` le pregunta a `WebViewFeature` por dos funciones, `WEB_MESSAGE_LISTENER` y `DOCUMENT_START_SCRIPT`. Si falta alguna, escribe en el log "This WebView cannot run the band: update Android System WebView" (esta WebView no puede ejecutar la franja: actualiza Android System WebView) y carga Claude sin Narsil. La solución es actualizar Android System WebView desde Google Play.

### Instalación

No está en ninguna tienda: compilas la app desde su repositorio y la instalas por USB.

1. En el móvil, activa las opciones de desarrollador y la **depuración por USB**, y conéctalo al PC.
2. En el PC, clona [narsil-android](https://github.com/davshn/narsil-android) y, en su carpeta, ejecuta:

```bash
./gradlew installDebug
```

Gradle se descarga solo (el wrapper está fijado a Gradle 9.9.2), compila un APK de depuración y lo instala. Para actualizar más adelante, trae los cambios del repositorio y vuelve a ejecutar el mismo comando: Android reemplaza la app en su sitio y conserva sus datos, así que la sesión y la configuración se quedan.

Una compilación de depuración tiene una propiedad que conviene conocer: su página se puede inspeccionar desde un PC en `chrome://inspect`, como explica la [guía 2](/es/android/webview-host/). Es útil para aprender y para arreglar cosas, y también es una razón para mantener apagada la depuración por USB cuando no la necesitas.

### Iniciar sesión: con tu correo

Abre **Narsil** e inicia sesión **con tu correo**: el de tu cuenta de Claude, aunque hayas creado la cuenta con Google. Claude te envía un código o un enlace, y ya entras.

Los botones de inicio de sesión de Google y de Apple no funcionan dentro de la WebView de una app. Los dos proveedores se niegan a funcionar ahí, y abrirlos en el navegador del móvil no ayudaría: como dice `Links.kt`, "in the phone's browser they would sign the browser in, not the app" (en el navegador del móvil iniciarían la sesión del navegador, no la de la app). Así que, cuando la página intenta ir a `accounts.google.com` o a `appleid.apple.com`, la app no va a ningún sitio y muestra en su lugar un mensaje:

> "Google y Apple no dejan iniciar sesión dentro de una app como esta. Escribe tu correo (el mismo de tu cuenta) y entra con el código o el enlace que te llega."

Esto salió de un fallo real. Antes del commit `38cb33c`, el botón de Google abría una ventana emergente que la WebView descartaba, y el inicio de sesión se quedaba colgado.

Si el enlace para entrar llega por correo, por defecto se abre en tu navegador. Para que los enlaces de `claude.ai` se abran en la app, ve en Android a **Ajustes → Aplicaciones → Narsil → Abrir de forma predeterminada → Añadir enlace** y activa `claude.ai`. El manifiesto explica por qué es manual: Android "cannot verify a domain that is not ours" (no puede verificar un dominio que no es nuestro).

### Primera configuración

1. En Claude Code en tu PC, ejecuta `/narsil movil`. Activa los avisos y te responde con tu tema.
2. Si quieres los avisos cifrados, ejecuta también `/narsil movil clave`. Te responde con una clave nueva.
3. En la app, abre la configuración: toca a Narsil en el bloque del menú lateral (o el aviso `Toca y escribe tu topic`), o mantén pulsado el icono de la app y elige **Ajustes**.
4. Escribe el tema y, si creaste una, la clave, y toca **Guardar y recibir avisos**. Permite las notificaciones cuando Android lo pida.
5. Toca **Permitir en segundo plano**. Sin eso, Android corta la conexión mientras el móvil duerme y los avisos llegan tarde. Una vez permitido, el botón dice **Ya funciona en segundo plano**.

De vuelta en Claude, la franja muestra a Narsil en cuanto el mod haya enviado un estado. Para comprobar toda la cadena de una vez, ejecuta `/narsil movil prueba` en el PC: envía un aviso de prueba y un estado, escribas desde donde escribas.

Las respuestas del propio mod se escribieron antes de que existiera esta app. `/narsil movil` todavía te dice que instales la app de ntfy, y `/narsil movil clave` que pongas la clave en "las opciones de la extensión de Firefox". Con esta app no necesitas ninguna de las dos cosas: la clave va en la configuración de la app.

### El modelo de privacidad

La app habla con cuatro sitios, cada uno por una razón:

| Quién                                  | Habla con                                 | Por qué                                                                                        |
| -------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| La WebView                             | `claude.ai` y `challenges.cloudflare.com` | El propio Claude, y la comprobación de Cloudflare que puede ir antes. Nada más se abre dentro. |
| Los scripts de la franja, en la página | `claude.ai`                               | Las mismas peticiones `GET` que hace la página, con tu sesión: conversaciones y límites.       |
| La página y las notificaciones         | `raw.githubusercontent.com`               | Los dibujos de Narsil, solo desde la propia carpeta `assets/` de narsil-pet.                   |
| El código Kotlin de la app             | `ntfy.sh`                                 | Tu tema para los avisos, y `<tu tema>-estado` para la franja.                                  |

Del código salen tres reglas:

- **El tema y la clave nunca llegan a la página.** Viven en el almacenamiento privado de la app, y solo Kotlin lee ntfy.sh. La página recibe el estado ya abierto, nada más. `host.js` lo dice claramente: "the topic and the key never reach the page" (el tema y la clave nunca llegan a la página).
- **ntfy.sh es un servicio público.** Sin clave, cualquiera que conozca tu tema puede leerlo y publicar en él, y ntfy.sh lo ve todo. Con clave, ven que se envió un mensaje y unos pocos detalles, no su texto. La [guía 7](/es/android/encryption-and-settings/) repasa qué queda oculto y qué no.
- **Nada de ntfy.sh se toma como marcado de confianza.** Entra en la página y en las notificaciones como texto, y un dibujo solo se acepta desde la propia carpeta de Narsil.

La app también fija `android:allowBackup="false"`, así que sus datos, incluida la sesión, no viajan a las copias de seguridad de Android.

## Constrúyelo con Claude

Pídele a Claude primero el esqueleto: un proyecto de Gradle con una actividad que muestre `claude.ai` en una WebView, decida adónde va cada enlace y tenga una pantalla de configuración para un tema. La idea que debe acertar es el límite: dentro de la app se abre `claude.ai` y nada más, y los secretos se quedan en Kotlin, nunca en la página.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Crea una app de Android en Kotlin (Gradle Kotlin DSL, `minSdk 29`, JDK 17, sin Compose) cuya actividad principal muestre `https://claude.ai/code` en una WebView a pantalla completa con JavaScript y DOM storage activados. Mantén dentro de la WebView solo `https://claude.ai` y `https://challenges.cloudflare.com`; abre cualquier otra dirección `https` en el navegador del móvil con `ACTION_VIEW`. Cuando la página vaya a `accounts.google.com` o a `appleid.apple.com`, no abras nada y muestra un toast que diga que se inicie sesión con un correo. Gestiona las ventanas emergentes en `onCreateWindow` con una WebView desechable que solo lea la dirección que quiere abrir. Vacía las cookies a disco en `onPause`. Añade una actividad de configuración con un campo de tema validado como `^[-_A-Za-z0-9]{1,64}$`, guardado en `SharedPreferences` privadas, y un acceso directo del launcher hacia ella. Pon las reglas de los enlaces en un objeto Kotlin puro con pruebas de JUnit, que incluyan `http://claude.ai`, `https://claude.ai.evil.example/` y un texto que no sea una URL.

### Qué revisar en la respuesta de Claude

1. Los hosts se comparan exactamente después de analizar la dirección, y solo para `https`: `https://claude.ai.evil.example/` y `http://claude.ai` no deben contar como Claude.
2. Las direcciones de inicio de sesión de Google y de Apple no abren nada; muestran un mensaje.
3. Las ventanas emergentes no abren una segunda ventana visible: su primera dirección va adonde iría cualquier enlace.
4. Se llama a `CookieManager.getInstance().flush()` en `onPause`, para que la sesión sobreviva cuando Android cierra la app.
5. El tema se valida antes de guardarse, y no se escribe nada secreto en la página ni en el código.

Si una comprobación falla, dile a Claude lo que ves: "el botón de Google no hace nada y la pantalla se queda en blanco".

### Cómo lo pidió el autor

Esta vez quedó registrado. El registro de tareas de narsil-android, `odd/tasks/android-app.md`, cita los mensajes de quien creó Narsil en sus entradas L1 a L3.

La idea, el 2026-11-23 (L1):

> "se me ocurrio crear una app movil completa, que reciba las notificaciones y que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension, eso es viable?"

El alcance, el 2026-11-24 (L2):

> "seria para reemplazar la pwa, la friccion que me dices para iniciar sesion seria igual solo una vez, no? ... (igual seria para mi uso personal)"

La PWA es la app web anterior para los avisos. Y en la misma entrada: "hazlo en un proyecto nuevo y probemos a ver que tal, el repositorio seria publico, te dejo conectado el celular para que la instales".

De L3: "no olvides ir haciendo commits al repositorio a medida que vas trabajando el repo se va a llamar narsil-android".

La especificación convierte esto en reglas: S3 "login once and the session stays (cookies flushed to disk)" (inicias sesión una vez y la sesión se queda, con las cookies guardadas en disco), y S4 "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings" (el repositorio es público y se llama `narsil-android`: ni tema ni clave en el código; se escriben en la configuración de la app). La última entrada del registro, L4, recoge la decisión de quien creó Narsil de retirar la extensión y la app web anteriores en favor de esta app ("[…] los voy a deprecar en favor de esta app"), y por eso los scripts de la franja pasaron a ser de la propia app.

Los commits, todos del 2026-11-24, muestran el orden de la construcción (aquí, el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `9051a31` "feat: open what the mod seals, as [the earlier extension]'s seal.js does" (abrir lo que sella el mod, como hace el seal.js de [la extensión anterior]).
- `3bcea35` "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (construir el script que aloja [la extensión anterior] en una WebView, y lo que guardan los avisos y los estados).
- `53c55c1` "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano).
- `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" (presentar la WebView como Chrome, y permitir inspeccionar la página de una compilación de depuración).
- `38cb33c` "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging" (decir que se inicie sesión con un correo cuando se pide el inicio de sesión de Google o de Apple, en vez de quedarse colgado).
- `9e514dd` "feat: open the settings from Narsil in the band and from the service's notification" (abrir la configuración desde Narsil en la franja y desde la notificación del servicio).
- `5ad4577` "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (hacer que los scripts de la franja sean de la app, y dejar de nombrar los proyectos que reemplaza).

## Código de referencia

Este es `Links.kt` completo, de `app/src/main/java/io/github/davshn/narsil/` en [narsil-android](https://github.com/davshn/narsil-android) (MIT). Es corto, y toda navegación de la app pasa por él: los enlaces de la WebView, sus ventanas emergentes, las direcciones que lleva un aviso y las direcciones que Android le pasa a la app.

```kotlin
package io.github.davshn.narsil

import java.net.URI

// Which addresses the app opens itself: claude.ai, and the Cloudflare check it may put before it. Everything else
// goes to the phone's browser, Google's sign-in among it, which refuses to run inside a WebView.
object Links {
    const val CLAUDE_CODE = "https://claude.ai/code"
    private val IN_APP = setOf("claude.ai", "challenges.cloudflare.com")

    private fun hostOf(url: String): String? = try {
        URI(url).takeIf { it.scheme == "https" }?.host?.lowercase()
    } catch (_: Exception) {
        null
    }

    fun isClaude(url: String?): Boolean = url != null && hostOf(url) == "claude.ai"

    fun isInApp(url: String?): Boolean = url != null && hostOf(url) in IN_APP

    // Google's and Apple's sign-ins, which refuse to run inside an app's WebView: in the phone's browser they would
    // sign the browser in, not the app, so the app says to sign in with an email instead.
    private val OUTSIDE_SIGN_IN = setOf("accounts.google.com", "appleid.apple.com")

    fun isOutsideSignIn(url: String?): Boolean = url != null && hostOf(url) in OUTSIDE_SIGN_IN
}
```

Tres detalles lo hacen seguro. `hostOf` devuelve `null` salvo que el esquema sea `https`, así que una dirección `http` nunca es Claude. Compara el host analizado de forma exacta, así que `claude.ai.evil.example` no es `claude.ai`. Y un texto que no se puede analizar lanza un error dentro de `URI`, que el `try` convierte en `null`. `LinksTest.kt` comprueba las tres cosas.

Una pequeña prueba propia, escrita para esta guía (MIT), en el mismo estilo que las de la app:

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MyLinksTest {
    @Test
    fun onlyClaudeAndTheCheckStayInside() {
        assertTrue(Links.isInApp("https://claude.ai/code/session_example"))
        assertTrue(Links.isInApp("https://CHALLENGES.cloudflare.com/x"))
        assertFalse(Links.isInApp("https://sub.claude.ai/"))
        assertFalse(Links.isInApp("claude.ai/code"))
    }
}
```

La segunda aserción pasa porque `hostOf` pasa el host a minúsculas. La última se cumple porque una dirección sin esquema no tiene esquema `https`, así que para la app no tiene host.

## Errores comunes y cómo probarlo

- **Tocar Continuar con Google.** Aquí no puede funcionar. Usa el correo de tu cuenta, aunque la hayas creado con Google.
- **Sin permiso en segundo plano.** Sin **Permitir en segundo plano**, los avisos pueden llegar con muchos minutos de retraso mientras el móvil duerme. Algunos móviles (el README nombra Infinix, Xiaomi y Huawei) necesitan además que su propio ahorro de batería deje funcionar a Narsil.
- **Esperar avisos en el escritorio.** El mod no envía nada mientras tu último mensaje haya salido de la terminal o de la app de escritorio. Escríbele a Claude por Remote Control, o usa `/narsil movil prueba`.
- **Un tema copiado con un espacio o una errata.** La configuración rechaza todo lo que no sean letras, números, `-` y `_` con "Ese topic no es válido". Un tema válido pero equivocado simplemente se queda en silencio: compáralo con la respuesta de `/narsil movil`.
- **Instalar desde un segundo PC.** Una compilación de depuración se firma con la clave de depuración propia de cada PC, y Android rechaza una actualización firmada con otra clave. Desinstalar para esquivarlo borra la sesión y la configuración.
- **Un Android System WebView viejo.** Claude carga, pero sin los colores ni la franja. Actualízalo desde Google Play.

Para probar la lógica de la app, ejecuta sus pruebas de JVM en el PC:

```bash
./gradlew testDebugUnitTest
```

Cubren las reglas de los enlaces, el script que carga la franja, las reglas de los avisos, el estado que guarda la franja y el cifrado frente a un mensaje sellado como lo sella el mod. Para probar toda la cadena sin tocar tu tema real, pon uno inventado como `narsil-0000000000example0` en la configuración y publica en él desde el PC ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Title: Narsil prueba" -d "Hola desde el ordenador" https://ntfy.sh/narsil-0000000000example0
```

Debería llegar una notificación en un segundo o dos. Después vuelve a escribir tu tema real.

### Dónde difieren el código y el README

- El README no menciona ninguna forma de detener los avisos desde la app, y el código no tiene ninguna: `AlertService.stop` existe, pero nada lo llama, y la configuración rechaza un tema vacío. Para detenerlos, ejecuta `/narsil movil off` en el PC, o desactiva las notificaciones de la app en la configuración de Android.
- El README dice que ya no necesitas la app de ntfy. Es cierto para la app; la respuesta de `/narsil movil` del mod todavía te dice que la instales (mira Primera configuración).

## Para ir más lejos

- La [guía 2](/es/android/webview-host/) abre el anfitrión de la WebView: cómo se juntan los scripts y cómo habla la página con la app.
- La [guía 6](/es/android/alerts-service/) sigue un aviso desde ntfy.sh hasta la barra de notificaciones.
- La [guía 7](/es/android/encryption-and-settings/) explica la clave, la configuración y lo que todavía puede ver quien lea tu tema.
- El lado del mod está en [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/). El mismo estado `-estado` también alimenta [Narsil Watch](/es/watch/what-it-is/).
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
