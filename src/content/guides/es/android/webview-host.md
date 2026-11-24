---
title: La WebView que aloja a Claude
description: 'Cómo MainActivity aloja claude.ai: la WebView, la sesión que se conserva, archivos y micrófono, adónde van los enlaces, y cómo PageScript y host.js ejecutan a Narsil al inicio de cada página.'
route: android
order: 2
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/PageScriptTest.kt
  - repo: android
    path: app/src/main/AndroidManifest.xml
---

## Qué hace

El anfitrión es todo lo que hace la app para que `claude.ai` funcione dentro de ella con Narsil encima. Vive casi entero en un archivo, `MainActivity.kt`, con dos ayudantes: `PageScript.kt`, que construye el script que se ejecuta al inicio de cada página, y `assets/host.js`, la parte de ese script que hace de navegador para los scripts de página de Narsil.

Desde fuera solo notas los resultados:

- Claude se abre en `claude.ai/code`, a pantalla completa, entre las barras del sistema y por encima del teclado.
- Inicias sesión una vez, y la sesión sobrevive cuando Android cierra la app.
- El botón **+** abre el selector de archivos del móvil, y el dictado puede usar el micrófono.
- `claude.ai` se queda en la app. Cualquier otro enlace se abre en tu navegador, y los inicios de sesión de Google y de Apple muestran un mensaje en su lugar.
- El botón de volver retrocede dentro de Claude, y desde la primera página de Claude manda la app a segundo plano.
- Los colores y la franja de Narsil están en cada página de `claude.ai` desde su primer instante.

> **Experimental.** El anfitrión ejecuta los scripts de Narsil dentro de una página que no controla. Dependen de la estructura de `claude.ai` y de sus peticiones internas, no de una API pública, así que una actualización de Claude puede romperlos. El anfitrión está hecho para que, cuando eso pase, Claude siga funcionando: cada script se ejecuta por su cuenta, y un error en uno queda en el log y deja a los demás en marcha.

## Cómo funciona por dentro

### La configuración de la WebView

`onCreate` construye la WebView en código, dentro de un `FrameLayout`, y fija lo que necesita `claude.ai`. Este fragmento es de `MainActivity.kt` en narsil-android (MIT):

```kotlin
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // A page's popups (Google's sign-in button opens one) reach onCreateWindow, which decides where they go.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, true)
        }
```

JavaScript y el DOM storage vienen apagados por defecto en una WebView, y `claude.ai` es una app de JavaScript que guarda estado en ese almacenamiento, así que se activan los dos. Los medios pueden reproducirse sin un toque. Las ventanas emergentes se permiten, pero solo para que la app pueda atraparlas (más abajo). Se aceptan cookies, también las de terceros; el código no dice qué página las necesita.

Otras dos líneas importan para la pantalla. Android 15 dibuja las apps de borde a borde, por debajo de la barra de estado, la barra de navegación y el teclado. La actividad llama a `enableEdgeToEdge()` y después añade a su marco un relleno del tamaño de las barras del sistema y del teclado (`WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()`), así que la página queda entre ellos. El manifiesto también enumera cada cambio de configuración que la app gestiona por sí misma (`orientation|screenSize|...|uiMode|density`), así que girar el móvil no reconstruye la actividad ni recarga Claude.

### Iniciar sesión una vez: guardar la cookie en disco

Tu sesión con `claude.ai` es una cookie. El `CookieManager` de la WebView guarda las cookies en memoria y las escribe en disco cuando le parece. Si Android cierra la app antes, la sesión se pierde y vuelves a iniciar sesión. Por eso la app las escribe ella misma cada vez que pasa a segundo plano:

```kotlin
    // The session's cookie reaches the disk now, not when Android gets to it: a killed app keeps its sign-in.
    override fun onPause() {
        CookieManager.getInstance().flush()
        web.onPause()
        super.onPause()
    }
```

`onPause` se ejecuta siempre que la app deja de estar al frente: cambias de app, bloqueas el móvil o abres la configuración. Es el último momento en que la app tiene la seguridad de ejecutarse antes de que Android pueda cerrarla. La especificación S3 pedía exactamente esto: "login once and the session stays (cookies flushed to disk)" (inicias sesión una vez y la sesión se queda, con las cookies guardadas en disco).

### Adónde va cada enlace

Cada navegación que pide la página llega a `shouldOverrideUrlLoading`, que le pregunta a `Links.isInApp` (la [guía 1](/es/android/what-it-is/) cita `Links.kt` completo). Devolver `false` deja que la WebView la cargue; devolver `true` la detiene, y `goOut` decide qué pasa en su lugar:

- **Los inicios de sesión de Google y de Apple** (`accounts.google.com`, `appleid.apple.com`): no se abre nada, y un toast largo dice que se inicie sesión con un correo.
- **Cualquier otra cosa**: el `ACTION_VIEW` de Android con la categoría `BROWSABLE`, que abre tu navegador o la app que maneje esa dirección. Si ninguna lo hace, la app escribe en el log "Nothing opens" (no se abre nada) y la dirección.

Las ventanas emergentes necesitan su propio camino. El botón de Google abre una, y una WebView que no tiene ventana que darle la descarta, que es por lo que el inicio de sesión se quedaba colgado. Ahora `onCreateWindow` le da a la página una WebView desechable que nunca se muestra. Su único trabajo es oír la primera dirección que quiere abrir la ventana emergente: una dirección de `claude.ai` se carga en la WebView principal, cualquier otra va a `goOut`, y la desechable se destruye. En palabras del código, "The popup's opener sees it closed." (quien abrió la ventana emergente la ve cerrada).

Las direcciones también llegan desde fuera: el toque en un aviso, o un enlace de `claude.ai` que Android le pasa a la app. Las dos llegan como un `Intent`, al arrancar o en `onNewIntent`, ya que la actividad es `singleTask` y solo existe una copia de ella. `claudeIn(intent)` se queda con la dirección solo cuando `Links.isClaude` la acepta, así que otra app no puede hacer que esta cargue una página que no sea Claude.

### Archivos y el micrófono

Cuando la página pide un archivo, la WebView llama a `onShowFileChooser`. La app abre el selector de documentos de Android (`ActivityResultContracts.OpenMultipleDocuments`) con los tipos que acepta la página, o `*/*` cuando no nombra ninguno, y le devuelve a la página las direcciones elegidas. Una petición que sigue esperando se responde antes con `null`, para que la página nunca espere a un selector que ya no está.

El micrófono es el único dispositivo que puede usar la página:

```kotlin
        // The microphone, for dictating to Claude; nothing else the page may ask for.
        override fun onPermissionRequest(request: PermissionRequest) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources || !Links.isClaude(request.origin.toString())) {
                request.deny()
                return
            }
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                microphone = request
                askMicrophone.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
```

Hay dos permisos en juego. La página se lo pide a la WebView, y la WebView se lo pide a la app (`onPermissionRequest`). La app a su vez necesita el `RECORD_AUDIO` de Android, que concedes una vez, la primera. Una petición que no venga de `https://claude.ai`, o que pida algo que no sea audio, se rechaza, e incluso una petición de audio y video recibe solo audio.

### Cómo se presenta la app

Cada petición que envía una WebView lleva su user agent, un texto que nombra el motor y que, en Android, la marca como WebView con `; wv`. Algunos inicios de sesión y algunas comprobaciones contra bots rechazan las WebViews por esa marca.

El historial muestra que el autor probó las dos cosas. El commit `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" (presentar la WebView como Chrome, y permitir inspeccionar la página de una compilación de depuración) quitó `; wv` y `Version/4.0` del user agent, con el comentario "As Chrome on Android" (como Chrome en Android). Siete minutos después, `38cb33c` lo deshizo: "The user agent is the WebView's own again: the app does not pass itself off as Chrome to get past a sign-in's check." (el user agent vuelve a ser el de la WebView: la app no se hace pasar por Chrome para superar la comprobación de un inicio de sesión). Hoy el código no toca `userAgentString` en absoluto, y la sección Security del README dice: "The app pretends nothing: Claude, Google, and Cloudflare see it as the Android app it is." (la app no finge nada: Claude, Google y Cloudflare la ven como la app de Android que es). Por eso tampoco se fuerza el inicio de sesión de Google: la respuesta honesta es el mensaje del correo.

### Mirar por dentro: inspección de depuración y logcat

La página de una WebView solo se puede inspeccionar desde las DevTools de un Chrome de escritorio si la app lo permite. La app lo permite solo en las compilaciones de depuración:

```kotlin
        // A debug build's page can be inspected from a computer, at chrome://inspect.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
```

`./gradlew installDebug` instala una compilación de depuración, así que, con el móvil conectado por USB, `chrome://inspect` en el PC muestra la página. Las pruebas del registro de tareas se reunieron así: "through DevTools the page has narsilHostLoaded, a live narsilWatch, both style marks and the night ground rgb(15, 26, 44)" (desde las DevTools, la página tiene narsilHostLoaded, un narsilWatch vivo, las dos marcas de estilo y el fondo de noche rgb(15, 26, 44)). Recuerda lo que esto significa: quien tenga tu móvil desbloqueado en un PC con la depuración por USB permitida puede ver tu página de Claude.

La consola de la página también llega al log de Android: `onConsoleMessage` escribe cada mensaje en logcat con la etiqueta `NarsilWeb`, con su nivel, su archivo y su línea. `adb logcat -s NarsilWeb` los muestra, incluidos los errores `narsil: <file>` que se describen más abajo.

### PageScript: un solo script, en orden

Los scripts de la franja se escribieron como scripts de contenido de una extensión, que un navegador ejecuta en grupos y en un orden fijo. Una WebView no tiene nada parecido: acepta un script por registro. Por eso `PageScript.build` cose todo en un solo script, en el orden que esperan los scripts. De `PageScript.kt` en narsil-android (MIT):

```kotlin
object PageScript {
    private val STYLES = listOf("page/skin.css", "page/band.css")
    private val AT_START = listOf("page/lib/watch.js", "page/lib/mode.js", "page/mode.js")
    private val AT_IDLE = listOf("page/lib/restore.js", "page/lib/state.js", "page/lib/live.js", "page/content.js")

    fun build(read: (String) -> String): String {
        val css = STYLES.joinToString("\n") { read(it) }
        fun run(path: String) = "run(${jsString(path)}, function () {\n${read(path)}\n})\n"
        return buildString {
            append("(() => {\n")
            append("if (window.top !== window || self.narsilHostLoaded || !self.narsilHost) return\n")
            append("self.narsilHostLoaded = true\n")
            append("const run = (name, code) => { try { code() } catch (error) { console.error('narsil: ' + name, error) } }\n")
            append("const NARSIL_CSS = ${jsString(css)}\n")
            append(read("host.js")).append('\n')
            AT_START.forEach { append(run(it)) }
            append("self.narsilWatch(adopt)\n")
            append("const idle = () => {\n")
            AT_IDLE.forEach { append(run(it)) }
            append("}\n")
            append("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idle, { once: true })\n")
            append("else idle()\n")
            append("})()\n")
        }
    }
```

Léelo de arriba abajo, como lo ejecuta la página:

1. **Una guarda.** Sale enseguida en un marco que no sea la ventana superior, si el script ya se ejecutó en este documento, o si falta el canal de la app (`narsilHost`).
2. **`run`**, un envoltorio que atrapa cualquier error, lo escribe como `narsil: <file>` y sigue adelante. Cada archivo se ejecuta dentro de su propia función, así que un archivo roto no puede detener al resto.
3. **`NARSIL_CSS`**, las dos hojas de estilos unidas como una sola cadena de JavaScript.
4. **`host.js`**, que construye la hoja de estilos, la pone en la página y define `browser` (más abajo).
5. **El primer grupo, enseguida**: el observador de la página (`lib/watch.js`) y el modo claro u oscuro (`lib/mode.js`, `mode.js`). Tienen que actuar antes de que la página se pinte, como explica la [guía 5](/es/android/colors-and-mode/).
6. **`self.narsilWatch(adopt)`**: en cada cambio que ve el observador, vuelve a poner la hoja de estilos si la página la quitó.
7. **El segundo grupo, cuando el documento ya está analizado**: los scripts de la franja. Si el documento todavía se está cargando, esperan a `DOMContentLoaded`, cerca de cuando se ejecutaría el grupo `document_idle` de una extensión: el marcado de la página ya está ahí para encontrarlo.

`jsString` convierte un archivo en un literal de cadena de JavaScript escapando las barras invertidas, las comillas, los saltos de línea y los dos caracteres U+2028 y U+2029, que el JavaScript antiguo trataba como saltos de línea dentro de las cadenas. `read` es una función que se pasa desde fuera, para que las pruebas puedan construir el script con archivos falsos. `PageScriptTest.kt` comprueba que cada archivo esté presente y en orden, que el segundo grupo espere al documento, que los dos estilos entren como una sola cadena entre comillas y que la guarda esté ahí.

### Al inicio del documento, solo en `claude.ai`, solo en el marco superior

`MainActivity.host()` registra el script y el canal. De `MainActivity.kt` (MIT):

```kotlin
    private fun host() {
        val origins = setOf(ORIGIN)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            Log.w(TAG, "This WebView cannot run the band: update Android System WebView")
            return
        }
        WebViewCompat.addWebMessageListener(web, "narsilHost", origins) { _, message, origin, isMainFrame, proxy ->
            if (!isMainFrame || origin.toString() != ORIGIN) return@addWebMessageListener
            val m = try {
                JSONObject(message.data ?: return@addWebMessageListener)
            } catch (_: Exception) {
                return@addWebMessageListener
            }
            when (m.optString("kind")) {
                "connect" -> {
                    reply = proxy
                    feed.start()
                }
                "disconnect" -> if (reply === proxy) {
                    reply = null
                    feed.stop()
                }
                "port" -> if (m.optJSONObject("message")?.optString("type") == "settings") openSettings()
                "settings" -> openSettings()
            }
        }
        val script = PageScript.build { path -> assets.open(path).bufferedReader().use { it.readText() } }
        WebViewCompat.addDocumentStartJavaScript(web, script, origins)
    }
```

Las dos llamadas vienen de `androidx.webkit` y reciben la misma regla de origen, `https://claude.ai`:

- **`addDocumentStartJavaScript`** ejecuta el script en cada documento que coincida antes que cualquiera de los scripts propios de la página, y eso es lo que permite que los colores ganen desde el primer fotograma.
- **`addWebMessageListener`** pone un objeto llamado `narsilHost` en los marcos que coincidan. La página llama a `narsilHost.postMessage(text)`; la app recibe el texto, el origen, si vino del marco principal y un proxy de respuesta por el que contestar.

Las comprobaciones van en capas. La propia WebView no les da ni el script ni `narsilHost` a otros orígenes. La guarda del script sale de cualquier marco que no sea la ventana superior. Y el listener descarta un mensaje que no venga del marco principal de `https://claude.ai`, o que no sea JSON. El README lo resume: "The band's scripts and the channel to the app run only on `https://claude.ai`, in the page itself and not in its frames." (los scripts de la franja y el canal hacia la app solo funcionan en `https://claude.ai`, en la propia página y no en sus marcos).

Cuando una página nueva empieza a cargarse (`onPageStarted`), la app olvida su proxy de respuesta y detiene la fuente del estado, ya que la página anterior ya no está.

### Servir los archivos de Narsil desde `claude.ai/__narsil__/`

La franja muestra el icono propio de la app cuando no tiene un dibujo de Narsil. Una página no puede cargar directamente un archivo de los assets de la app, y la Content Security Policy de `claude.ai` limita de dónde pueden venir las imágenes. La app usa `WebViewAssetLoader` para responder desde sus propios assets a las peticiones a `https://claude.ai/__narsil__/`:

```kotlin
        private val files = WebViewAssetLoader.Builder()
            .setDomain("claude.ai")
            .addPathHandler("/__narsil__/", WebViewAssetLoader.AssetsPathHandler(this@MainActivity))
            .build()
```

La petición nunca llega a la red: `shouldInterceptRequest` la responde con el asset. Para la página, el archivo viene de su propio origen, "where the page's own policy lets them load" (donde la propia política de la página deja que se carguen), como dice el comentario de la clase. Todo lo demás bajo `claude.ai` pasa sin tocarse.

### `host.js`: un navegador para los scripts de página

Los scripts de página de Narsil se escribieron para una extensión. Llaman a `browser.runtime.getURL`, abren un puerto con `browser.runtime.connect`, envían `browser.runtime.sendMessage` y miran `browser.runtime.id` para saber si su extensión sigue viva. `host.js` les da un objeto `browser` con exactamente esas partes, y responde a cada una:

| Lo que llaman los scripts      | Lo que responde `host.js`                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.id`                   | Siempre `'narsil-android'`, para que los scripts nunca se crean huérfanos.                                                      |
| `runtime.getURL(path)`         | `https://claude.ai/__narsil__/page/` más la ruta.                                                                               |
| `runtime.getManifest()`        | Solo lo que leen de él los scripts: un grupo cuyos estilos son `skin.css` y `band.css`.                                         |
| `runtime.connect({ name })`    | Un puerto. Envía `connect` a la app; los mensajes de la app llegan a su `onMessage`; `postMessage` envía `port`.                |
| `runtime.sendMessage(message)` | Para `narsil-missing` (los scripts notaron que faltan los estilos), vuelve a poner la hoja de estilos. Siempre responde `true`. |
| `runtime.onMessage`            | Una lista de listeners a los que la app nunca llama; los scripts se registran en ella, y no pasa nada más.                      |

Los estilos entran como una hoja de estilos construida: `host.js` crea un `CSSStyleSheet`, lo llena con `replaceSync(NARSIL_CSS)` y lo añade a `document.adoptedStyleSheets`. El comentario del archivo da la razón: las hojas de estilos construidas son unas "which the page's CSP does not govern" (que la CSP de la página no gobierna), mientras que un elemento `<style>` añadido por un script podría rechazarse. La página a veces reemplaza sus propias hojas adoptadas, así que `adopt()` lo comprueba y vuelve a poner la de Narsil en cada cambio que ve el observador.

`host.js` añade una cosa que una extensión no necesitaba. La app no tiene un menú de navegador desde el que llegar a su configuración, así que un toque en cualquier parte del dibujo o del nivel de Narsil en el bloque del menú lateral (`#narsil-band .narsil-head`) envía `{ kind: 'settings' }`. Escucha en la fase de captura, así que ve el toque antes de que la página pueda detenerlo.

### El canal, mensaje a mensaje

Todos los mensajes son texto JSON.

| Dirección    | Mensaje                     | Qué pasa                                                                                      |
| ------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| Página → app | `{ kind: 'connect', name }` | La app guarda este proxy de respuesta y empieza a seguir `<topic>-estado`.                    |
| Página → app | `{ kind: 'disconnect' }`    | Si es el proxy actual, la app deja de seguirlo.                                               |
| Página → app | `{ kind: 'port', message }` | Solo `message.type === 'settings'` hace algo: abre la configuración.                          |
| Página → app | `{ kind: 'settings' }`      | Abre la configuración.                                                                        |
| App → página | `{ type: 'model', model }`  | El estado más reciente que debe mostrar la franja ([guía 3](/es/android/conversation-band/)). |
| App → página | `{ type: 'no-topic' }`      | Todavía no hay tema: el bloque te pide que toques y escribas uno.                             |

La franja también envía `{ type: 'awake' }` por su puerto cada 25 segundos, una costumbre de la extensión, donde mantenía despierto un worker de fondo dormido. La app lo ignora.

### El puente como frontera de seguridad

Un canal entre una página web y código nativo es una puerta, y la pregunta siempre es qué puede pasar por ella. Aquí, muy poco:

- **Hacia la app, la página puede hacer tres cosas**: pedir que se empiece a seguir el estado, pedir que se deje de seguir y abrir la pantalla de configuración. Cualquier otro mensaje se ignora. Ningún mensaje lleva una URL que abrir, un archivo que leer o un valor que guardar.
- **Desde la app, la página recibe solo el estado ya abierto**: el JSON que el mod envió a `-estado`, después de descifrarlo. El tema y la clave se quedan en Kotlin. Forman parte de la dirección y del descifrado que hace la propia app, y nunca se envían.
- **Cualquier script del marco principal de `claude.ai` puede usar `narsilHost`**, incluido el propio código de `claude.ai`, ya que comparte la página con los scripts de Narsil. Lo peor que puede hacer es leer el mismo estado que muestra la franja y abrir la configuración.

La dirección contraria también importa. Lo que llega de ntfy.sh pudo escribirlo cualquiera que conozca tu tema, así que los scripts de página lo tratan como no confiable: el texto entra con `textContent`, y un dibujo solo desde la propia carpeta de Narsil en GitHub.

## Constrúyelo con Claude

Pídele primero a Claude un anfitrión mínimo: una WebView que ejecute un script al inicio del documento en un solo origen, con un canal de mensajes por el que el script pueda hablar. Después hazlo crecer. La idea que debe acertar es que el script y el canal existen solo en `https://claude.ai`, solo en el marco superior, y que la app lo vuelve a comprobar en cada mensaje.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi app de Android (Kotlin, `androidx.webkit` 1.18), la actividad principal muestra `https://claude.ai/code` en una WebView. Si `WebViewFeature` admite `WEB_MESSAGE_LISTENER` y `DOCUMENT_START_SCRIPT`, registra un web message listener llamado `myHost` y un script de inicio de documento, los dos solo para la regla de origen `https://claude.ai`. Construye el script en un objeto Kotlin puro a partir de archivos de assets: una guarda que salga salvo que `window.top === window`, que `self.myHost` exista y que no se haya ejecutado todavía; cada archivo envuelto en su propio `try/catch` que escriba en el log el nombre del archivo; el CSS unido en un solo literal de cadena escapado. En el listener, descarta todo lo que no venga del marco principal de `https://claude.ai` o no sea JSON, y actúa solo sobre una lista fija de valores de `kind`. Sirve `https://claude.ai/__mine__/` desde los assets con `WebViewAssetLoader`. No envíes nunca ninguna configuración a la página. Añade pruebas de JUnit para el orden y el escapado del constructor del script.

### Qué revisar en la respuesta de Claude

1. Tanto `addWebMessageListener` como `addDocumentStartJavaScript` reciben el mismo conjunto estrecho de orígenes, no `"*"`.
2. El listener comprueba él mismo `isMainFrame` y el origen, aunque la regla de origen ya filtre.
3. La primera línea del script sale en los iframes y en una segunda ejecución.
4. Cada archivo se ejecuta en su propio `try/catch`, así que un error no detiene a los demás.
5. El escapado de cadenas maneja `\`, `"`, `\n`, `\r`, U+2028 y U+2029, y una prueba lo demuestra.
6. Hay una comprobación de funciones con una línea de log clara, y Claude sigue cargando cuando falla.

Si una comprobación falla, dile a Claude lo que ves: "el script se ejecuta dos veces dentro del marco de Cloudflare".

### Cómo lo pidió el autor

Las palabras de quien creó Narsil están recogidas en el registro de tareas, `odd/tasks/android-app.md`. La primera, L1, pedía una web view que "muestre la web de claude y modifique sus estilos como lo hace esta extension". L3 añadió: "recuerda que los estilos que va a inyectar seran los de la extension […]" (aquí se omite el nombre del proyecto anterior). La especificación S2 del agente convierte eso en el diseño de esta guía: "the extension's content scripts and CSS run unchanged inside the WebView, with a `browser` shim the app answers natively." (los scripts de contenido y el CSS de la extensión se ejecutan sin cambios dentro de la WebView, con un shim `browser` al que la app responde de forma nativa).

El resto se reconstruye a partir del historial de commits (el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (construir el script que aloja [la extensión anterior] en una WebView, y lo que guardan los avisos y los estados). Su mensaje: "host.js answers the extension's browser calls; the styles go on as a constructed style sheet." (host.js responde a las llamadas a browser de la extensión; los estilos entran como una hoja de estilos construida).
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano). Nace `MainActivity`.
- `bfa379a` (2026-11-24) "fix: present the WebView as Chrome, and let a debug build's page be inspected" (presentar la WebView como Chrome, y permitir inspeccionar la página de una compilación de depuración).
- `38cb33c` (2026-11-24) "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging" (decir que se inicie sesión con un correo cuando se pide el inicio de sesión de Google o de Apple, en vez de quedarse colgado). Las ventanas emergentes y el user agent honesto.
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir la configuración desde Narsil en la franja y desde la notificación del servicio). Su mensaje: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic." (no todos los launchers muestran el acceso directo, y el aviso de la franja solo aparece sin tema).
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (hacer que los scripts de la franja sean de la app, y dejar de nombrar los proyectos que reemplaza). `assets/extension` pasó a ser `assets/page` y `ExtensionScript` pasó a ser `PageScript`, siguiendo la L4 de quien creó Narsil.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía (MIT). Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Un anfitrión mínimo con la misma forma que `MainActivity`: un origen, un script al inicio del documento, un canal y una regla para los enlaces. Reutiliza `Links` de la app.

```kotlin
package io.github.davshn.narsil

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class TinyHostActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        val origins = setOf("https://claude.ai")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            WebViewCompat.addWebMessageListener(web, "myHost", origins) { _, message, origin, isMainFrame, reply ->
                if (!isMainFrame || origin.toString() != "https://claude.ai") return@addWebMessageListener
                if (message.data == "hello") reply.postMessage("hi from the app")
            }
            WebViewCompat.addDocumentStartJavaScript(web, SCRIPT, origins)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (Links.isInApp(request.url.toString())) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url).addCategory(Intent.CATEGORY_BROWSABLE))
                return true
            }
        }
        web.loadUrl(Links.CLAUDE_CODE)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    private companion object {
        const val SCRIPT = """
            if (window.top === window && self.myHost && !self.myHostLoaded) {
              self.myHostLoaded = true
              myHost.addEventListener('message', (event) => {
                document.documentElement.dataset.myHost = event.data
              })
              myHost.postMessage('hello')
            }
        """
    }
}
```

Declara la actividad en el manifiesto como la del launcher, abre después la página en `chrome://inspect` (con `WebView.setWebContentsDebuggingEnabled(true)` en una compilación de depuración) y mira el elemento `<html>`: debería llevar `data-my-host="hi from the app"`. Carga cualquier otro sitio en la misma WebView y ahí `self.myHost` es `undefined`. `startActivity` lanza `ActivityNotFoundException` cuando ninguna app puede abrir una dirección; el `goOut` real lo atrapa, y el tuyo también debería hacerlo antes de publicarlo.

## Errores comunes y cómo probarlo

- **`"*"` como regla de origen.** El canal y el script llegarían a cada página y a cada marco que la WebView cargue alguna vez, incluidos anuncios y páginas de inicio de sesión. Nombra el único origen.
- **Confiar solo en la regla de origen.** Los marcos del mismo origen también reciben el objeto. Comprueba `isMainFrame` en el listener.
- **Un solo `try` alrededor de todo.** Un único error, por ejemplo en la franja después de una actualización de Claude, también tumbaría los colores. Envuelve cada archivo.
- **Olvidar `flush()`.** La sesión funciona hasta que Android cierra la app en segundo plano, y entonces vuelves a iniciar sesión.
- **Ignorar las ventanas emergentes.** Con `setSupportMultipleWindows(false)`, un botón de inicio de sesión que abre una ventana emergente no hace nada de nada. Atrápala en `onCreateWindow`.
- **Falsear el user agent.** Puede que hoy supere una comprobación y mañana falle, y oculta lo que es la app. La app lo dejó en `38cb33c`.
- **Enviar una configuración a la página.** Cualquier script de la página podría leerla entonces. Deja el tema y la clave del lado de Kotlin.
- **Conceder cada petición de permiso.** Concede solo el micrófono, y solo a `claude.ai`.

Para probarlo en el móvil, instala una compilación de depuración, abre `chrome://inspect` en el PC y, en la consola de la página, comprueba `self.narsilHostLoaded` (debería ser `true`), `typeof narsilHost` (`object`) y `document.adoptedStyleSheets.length` (al menos uno). En un iframe de la página, `self.narsilHostLoaded` debería ser `undefined`. Después, `adb logcat -s NarsilWeb` muestra la consola de la página; una línea que empiece por `narsil:` nombra un script que lanzó un error.

Para probar el constructor del script sin móvil, ejecuta `./gradlew testDebugUnitTest`: `PageScriptTest` construye el script con archivos falsos y comprueba el orden, el grupo que espera, las comillas y la guarda.

### Dónde difieren el código y el README

- El README dice "A debug build's page can be inspected from a computer at `chrome://inspect`; its console goes to logcat with the `NarsilWeb` tag." (la página de una compilación de depuración se puede inspeccionar desde un PC en `chrome://inspect`; su consola va a logcat con la etiqueta `NarsilWeb`). En el código, la inspección se limita a las compilaciones de depuración; la consola no: `onConsoleMessage` escribe en logcat en cualquier compilación. Como la única instalación documentada es `installDebug`, la diferencia solo se nota si compilas tú una versión release.

## Para ir más lejos

- La [guía 3](/es/android/conversation-band/) sigue el estado desde el canal de la app hasta la franja encima de la caja de texto.
- La [guía 5](/es/android/colors-and-mode/) explica por qué el primer grupo de scripts se ejecuta enseguida y cómo evitan los colores un destello.
- La [guía 7](/es/android/encryption-and-settings/) cubre la configuración que abre el puente, y por qué el tema y la clave se quedan fuera de la página.
- Del lado del mod, [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) describe el estado `-estado` que lleva el canal.
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
