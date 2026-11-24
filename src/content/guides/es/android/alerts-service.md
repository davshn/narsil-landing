---
title: Avisos desde un servicio en primer plano
description: 'Cómo AlertService mantiene abierta una conexión con ntfy.sh, recupera con since los avisos perdidos, y cómo Alert y Notifier convierten cada mensaje en una notificación en el canal correcto.'
route: android
order: 6
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/AlertService.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/NtfyStream.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Alert.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Notifier.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/BootReceiver.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/AlertTest.kt
  - repo: pet
    path: hooks/phone.ts
---

## Qué hace

Mientras le escribes a Claude Code por Remote Control, el mod de Narsil publica en tu tema de ntfy.sh cuando una conversación termina, te necesita o falla. La app muestra cada aviso como una notificación, con Narsil en su etapa actual y en la pose del aviso:

| Aviso                   | Cómo llega                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Una pregunta o un error | En el canal **Te necesita**: aparece encima de lo que estés haciendo y vibra con su propio patrón largo. |
| Un turno terminado      | En el canal **Terminó**: una vibración corta, y aparece en silencio en el panel de notificaciones.       |

- **Un toque** abre Claude Code dentro de la app. Hasta entonces, cada aviso se queda en el panel de notificaciones.
- **Los enlaces del aviso** aparecen como botones, dos como mucho. Los de `claude.ai` se abren en la app, y cualquier otro en tu navegador. El mod envía uno, `Abrir Claude`.
- **La app puede estar cerrada.** Una conexión con ntfy.sh se queda abierta en un servicio en primer plano, con una notificación silenciosa propia: "Narsil escucha tus avisos", y debajo `Topic <tu tema> · toca para cambiarlo`. Un toque en ella abre la configuración.
- **Después de reiniciar** el móvil, o de actualizar la app, el servicio vuelve a arrancar solo.
- **Los avisos perdidos llegan tarde, no nunca.** Si el móvil estaba apagado o sin conexión, los avisos enviados mientras tanto llegan en cuanto vuelve, siempre que ntfy.sh todavía los guarde (12 horas, dice el código).

Ya no necesitas la app de ntfy.

> **Experimental.** La app en su conjunto se apoya en la estructura de la página de `claude.ai` y en sus peticiones internas, que una actualización de Claude puede romper. Esta parte no toca `claude.ai`, pero tiene sus propios puntos frágiles: depende del servicio público gratuito de ntfy.sh y de que Android deje a una app mantener una conexión abierta todo el día. Algunos fabricantes de móviles cierran las apps en segundo plano de todos modos, y entonces los avisos llegan tarde o dejan de llegar hasta que abres la app.

## Cómo funciona por dentro

### El recorrido de un aviso

```text
Narsil mod on the computer
  └─ POST https://ntfy.sh  (your topic)
       └─ NtfyStream: GET https://ntfy.sh/<topic>/json?since=<last id>
            └─ AlertService.take
                 ├─ Seal.unseal      (opens it with the key, if sealed)
                 ├─ Alert.of         (the rules: channel, tag, buttons, picture, tap)
                 ├─ Notifier.show    (the notification)
                 └─ settings.lastAlertId = its id
```

Cada paso es un archivo pequeño con una sola tarea. `NtfyStream` sabe de ntfy.sh, `Alert` sabe las reglas y no tiene código de Android (así que `AlertTest.kt` lo prueba en el PC), y `Notifier` sabe de las notificaciones de Android.

### Un servicio en primer plano, y por qué `specialUse`

Android detiene el trabajo en segundo plano que no puede ver. Para mantener una conexión abierta durante horas, una app tiene que ejecutar un **servicio en primer plano**: un servicio que muestra una notificación mientras está en marcha, para que siempre sepas que está ahí. Desde Android 14, cada servicio en primer plano declara además un tipo que dice para qué sirve.

El tipo obvio, `dataSync`, no encaja: la decisión del registro de tareas recoge que "Android 15 caps `dataSync` at 6 h a day" (Android 15 limita `dataSync` a 6 h al día). La app declara en su lugar `specialUse`, con la razón que Android pide en el manifiesto:

<!-- prettier-ignore -->
```xml
        <service
            android:name=".AlertService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Keeps a connection to ntfy.sh open to show the alerts of Claude Code as they come" />
        </service>
```

Ese fragmento es de `AndroidManifest.xml` en narsil-android (MIT). La misma decisión explica lo que la app no usa: "no Firebase, no ntfy app needed" (sin Firebase, sin necesidad de la app de ntfy). Los servicios push como Firebase Cloud Messaging necesitan un servidor que les envíe; aquí el único servidor es ntfy.sh, y la app lo escucha directamente.

El servicio en sí es corto. De `AlertService.kt` (MIT):

```kotlin
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val settings = Settings(this)
        val wanted = settings.topic
        if (wanted == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        Notifier.createChannels(this)
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, Notifier.SERVICE_ID, Notifier.serviceNotification(this, wanted), type)
        if (wanted != topic || stream == null) {
            stream?.stop()
            topic = wanted
            stream = NtfyStream(NtfyStream.topicUrl(wanted), settings.lastAlertId, ::take).also { it.start() }
        }
        return START_STICKY
    }
```

- **Sin tema, no hay servicio.** Se detiene solo y pide que no se le vuelva a arrancar.
- **Primero la notificación silenciosa.** Hay que llamar a `startForeground` poco después de que arranque el servicio, o Android lo detiene. El tipo solo se pasa en Android 14 (`UPSIDE_DOWN_CAKE`) y posteriores, donde existen los tipos.
- **Un flujo por tema.** El servicio puede arrancarse muchas veces: al abrir la app, desde **Guardar y recibir avisos** en la configuración y después de un reinicio. Si el tema es el mismo y hay un flujo en marcha, no cambia nada. Si guardaste un tema nuevo, el flujo viejo se detiene y empieza uno nuevo.
- **`START_STICKY`** le pide a Android que vuelva a arrancar el servicio si alguna vez tiene que cerrarlo.

La notificación silenciosa vive en su propio canal, **Conexión**, con la importancia más baja y sin insignia, así que se queda al fondo del panel de notificaciones sin sonido. Su texto incluye tu tema, algo que conviene saber si otros ven tu pantalla.

### `NtfyStream`: una conexión, siempre abierta

ntfy.sh puede enviar un tema como un flujo JSON: una respuesta HTTP que nunca termina, con un objeto JSON por línea ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). Cada línea de mensaje tiene `"event": "message"`; ntfy.sh también envía líneas `open` y `keepalive`. `NtfyStream` lee ese flujo en un hilo propio. La parte que lee, de `NtfyStream.kt` (MIT):

```kotlin
    private fun read() {
        val from = since
        val url = URL(if (from != null) "$topicUrl?since=${URLEncoder.encode(from, "UTF-8")}" else topicUrl)
        val c = url.openConnection() as HttpURLConnection
        connection = c
        try {
            c.connectTimeout = 15_000
            c.readTimeout = 90_000
            c.useCaches = false
            if (c.responseCode != 200) throw IOException("ntfy.sh answered ${c.responseCode}")
            c.inputStream.bufferedReader().useLines { lines ->
                for (line in lines) {
                    if (!isRunning) return
                    val raw = try {
                        JSONObject(line)
                    } catch (_: Exception) {
                        continue
                    }
                    if (raw.optString("event") != "message") continue
                    try {
                        onMessage(raw)
                    } catch (e: Exception) {
                        Log.w(TAG, "a message could not be taken: ${e.message}")
                    }
                    raw.optString("id").takeIf { it.isNotEmpty() }?.let { since = it }
                }
            }
        } finally {
            c.disconnect()
            connection = null
        }
    }
```

Los números tienen sus razones. El comentario de la clase dice "ntfy.sh sends a keepalive every 45 s, so a read that waits 90 s found a dead connection" (ntfy.sh envía un keepalive cada 45 s, así que una lectura que espera 90 s ha encontrado una conexión muerta): un móvil que cambió de red puede conservar un socket que ya nunca entregará nada, y el tiempo de espera de lectura de 90 segundos es como lo nota la app. Una línea que no es JSON se salta. Un mensaje que no se puede mostrar queda en el log y no detiene el flujo. Y después de cada mensaje, `since` pasa a su id.

Alrededor de `read()`, `follow()` lo mantiene en marcha:

- **Cuando el flujo termina con normalidad** (lo cerró ntfy.sh o un proxy), espera un segundo y vuelve a leer, desde `since`.
- **Cuando falla** (sin red, un tiempo de espera agotado, una respuesta distinta de 200), espera un segundo, luego dos, cuatro, y así hasta un minuto, y vuelve a un segundo después de una lectura que funcionó.
- **`stop()`** borra una bandera, desconecta la conexión abierta e interrumpe el hilo, así que termina enseguida incluso en mitad de una espera.

El hilo es un hilo daemon, así que nunca mantiene vivo por sí solo el proceso de la app; de eso se encarga el servicio en primer plano.

### Ponerse al día con `since`

ntfy.sh guarda los mensajes de un tema durante un tiempo (12 horas, dice el comentario de `AlertService.kt`), y su parámetro `since` pide los que vienen después del id de un mensaje dado ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). La app lo usa para retomar donde lo dejó:

1. Después de cada aviso que muestra, `AlertService.take` guarda el id del mensaje como `lastAlertId` en la configuración.
2. Cuando arranca el servicio, por ejemplo después de un reinicio, abre el flujo con `since=<lastAlertId>`.
3. ntfy.sh envía primero lo que guardó después de ese id, y después sigue en vivo.

Así que un aviso enviado mientras el móvil estaba apagado llega cuando vuelve. Del código salen tres límites:

- **La primera vez no hay desde dónde retomar.** Sin id guardado, `since` es `null` y el flujo empieza "from now on" (desde ahora). Los avisos enviados antes del primero no se recuperan.
- **Un tema nuevo empieza de cero.** Guardar un tema distinto borra `lastAlertId` (lo hace el setter), así que no te queda un id que pertenece a otro tema.
- **Pasadas 12 horas, ya no están** en ntfy.sh, ni por tanto en la app.

Hay una protección discreta en la etiqueta de la notificación. Si Android cierra la app entre mostrar un aviso y guardar su id, el aviso vuelve a llegar en el siguiente arranque, pero con el mismo id de mensaje, y por tanto la misma etiqueta, así que se reemplaza a sí mismo en lugar de aparecer dos veces.

### `Alert.kt`: las reglas

`Alert.of` convierte un mensaje, ya abierto si estaba sellado, en lo que muestra una notificación. De `Alert.kt` (MIT):

```kotlin
        fun of(m: JSONObject): Alert {
            val isUrgent = m.optInt("priority", 3) >= 4
            val tags = m.optJSONArray("tags")
            val conversation = (0 until (tags?.length() ?: 0)).map { tags!!.optString(it) }.firstOrNull { it.startsWith("conv-") }
            val id = m.optString("id").ifEmpty { m.optLong("time").toString() }
            val actions = m.optJSONArray("actions")
            val views = (0 until (actions?.length() ?: 0)).mapNotNull { actions!!.optJSONObject(it) }
                .filter { it.optString("action") == "view" && it.optString("url").isNotEmpty() }
                .take(2)
                .map { View(it.optString("label").ifEmpty { "Abrir" }, it.optString("url")) }
            val click = m.optString("click").takeIf { Links.isClaude(it) }
            return Alert(
                title = m.optString("title").ifEmpty { "Narsil" },
                body = if (m.optBoolean("sealed")) SEALED else m.optString("message"),
                isUrgent = isUrgent,
                tag = if (!isUrgent && conversation != null) "done-$conversation" else id,
                views = views,
                icon = m.optString("icon").takeIf { it.startsWith(ART) },
                opens = click ?: Links.CLAUDE_CODE,
            )
        }
```

| Regla    | Lo que hace el código                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urgente  | Prioridad 4 o 5 de ntfy. El mod envía 4 para una pregunta o un error, y 3 para un turno terminado.                                                      |
| Etiqueta | Un turno terminado con una etiqueta `conv-…` recibe `done-conv-…`, así que el siguiente de esa conversación lo reemplaza. Cualquier otro, su propio id. |
| Botones  | Solo las acciones `view` de ntfy con dirección, dos como mucho, con la etiqueta `Abrir` cuando no tienen ninguna.                                       |
| Toque    | La dirección `click` del mensaje solo si es de `claude.ai`; si no, `https://claude.ai/code`.                                                            |
| Dibujo   | Solo un `icon` que empiece por `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`.                                                      |
| Título   | El título del mensaje, o `Narsil`.                                                                                                                      |
| Sellado  | Cuando la clave no pudo abrirlo: "🔒 Aviso cifrado: pon la clave en los ajustes de la app."                                                             |

La regla del dibujo tiene su razón en un comentario: "Without a key anyone who knows the topic can publish on it: a picture only comes from Narsil's own assets." (sin clave, cualquiera que conozca el tema puede publicar en él: un dibujo solo viene de los propios assets de Narsil). Lo mismo vale para el toque. Las direcciones de los botones no se comprueban más allá de que existan: una que no sea de `claude.ai` se abre en la app que la maneje, después de que la toques.

### Lo que envía el mod

Las reglas de arriba encajan con lo que publica el mod. De `hooks/phone.ts` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

<!-- prettier-ignore -->
```ts
export function phoneMessage(topic: string, kind: PhoneKind, title: string, text: string, where: string, stage: number, isLast: boolean, fleet = '') {
  const body = fleet ? `${text}\n\n${fleet}` : text
  return {
    topic,
    title: where ? `Narsil · ${title} · ${where}` : `Narsil · ${title}`,
    message: isLast ? `${body}\n(último aviso de hoy: mañana sigo)` : body,
    priority: PRIORITY[kind],
    tags: [TAGS[kind]],
    icon: phoneIcon(kind, stage),
    actions: [OPEN_CLAUDE],
  }
}
```

`PRIORITY` es 3 para `done` y 4 para `question` y `error`. `TAGS` guarda una etiqueta de emoji por tipo (`white_check_mark`, `raising_hand`, `warning`). `phoneIcon` construye la dirección del dibujo a partir de la etapa de Narsil y la pose del aviso: los dibujos de la cría están en la raíz de `assets/`, cada etapa posterior en una carpeta `etapaN/`, y la pose es `terminado`, `necesita` o `error`, siempre en la variante oscura (`-oscuro.png`). `OPEN_CLAUDE` es el único botón, `Abrir Claude`, hacia `https://claude.ai/code`. El cuerpo puede terminar con la lista de conversaciones abiertas y, en el mensaje 200 del día, con `(último aviso de hoy: mañana sigo)`. [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica cuándo envía el mod.

Fíjate en lo que el mod no envía: una etiqueta `conv-` ni una dirección `click`. Así que, con el mod de hoy, cada turno terminado es su propia notificación, y cada toque abre `claude.ai/code`, donde Remote Control lista tus conversaciones.

### `Notifier.kt`: los canales y la notificación

Desde Android 8, cada notificación pertenece a un canal, y la persona decide por canal si suena, vibra o se muestra. La app crea tres. De `Notifier.kt` (MIT):

```kotlin
    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            listOf(
                NotificationChannel(NEEDS, "Te necesita", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Una pregunta o un error de Claude"
                    enableVibration(true)
                    vibrationPattern = NEEDS_BUZZ
                },
                NotificationChannel(DONE, "Terminó", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Claude terminó un turno"
                    enableVibration(true)
                    vibrationPattern = DONE_BUZZ
                },
                NotificationChannel(SERVICE, "Conexión", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "La conexión con ntfy.sh que trae los avisos"
                    setShowBadge(false)
                },
            ),
        )
    }
```

`IMPORTANCE_HIGH` es lo que hace que un aviso aparezca encima de lo que estás haciendo. Los dos patrones de vibración son la "forma propia" en que vibra cada uno: `NEEDS_BUZZ` es `0, 300, 120, 300, 120, 600` (tres pulsos, el último largo), y `DONE_BUZZ` es `0, 200`. Una vez que existe un canal, Android te deja cambiar su sonido y su vibración en la configuración de notificaciones de la app, y los valores de la app son solo el punto de partida.

`show` construye cada notificación:

- Sale enseguida si las notificaciones están desactivadas para la app (el comentario: "the person may have turned notifications off", la persona puede haber desactivado las notificaciones).
- El título y el cuerpo tal como llegan, con `BigTextStyle` para que un cuerpo largo se pueda expandir. Categoría `REMINDER` para las urgentes, `STATUS` para el resto, y `setAutoCancel(true)`, para que un toque la descarte.
- **El toque y los botones** son `PendingIntent` construidos por `open`: una dirección de `claude.ai` se convierte en un intent explícito hacia `MainActivity`, y cualquier otra en un `ACTION_VIEW` para la app que la maneje. Son inmutables (`FLAG_IMMUTABLE`), así que ninguna otra app puede cambiar adónde llevan.
- **El dibujo** se descarga desde la dirección `icon` con tiempos de espera de 5 segundos para conectar y para leer, y se convierte en el icono grande. Si no llega a tiempo, la notificación sale sin él. Esto se ejecuta en el hilo del flujo, que puede permitirse esperar.
- `manager.notify(alert.tag, 0, ...)`: la etiqueta decide el reemplazo. La misma etiqueta reemplaza la notificación anterior; una etiqueta nueva añade una.

Nada en `show` fija un tiempo de expiración ni hace persistente una notificación, así que cada aviso, urgente o no, se queda en el panel de notificaciones hasta que lo tocas (`setAutoCancel`) o lo deslizas. Lo que distingue a los urgentes es que su canal los hace aparecer encima de lo que estás haciendo y vibrar con el patrón largo.

### El toque, de vuelta a la app

Cuando tocas un aviso, Android envía el intent explícito a `MainActivity` con la dirección. La actividad es `singleTask`, así que, si ya está abierta, recibe la dirección en `onNewIntent` y la carga; si no, `onCreate` la carga en lugar de la página por defecto. En los dos casos, `claudeIn` solo acepta direcciones de `claude.ai` ([guía 2](/es/android/webview-host/)).

### `BootReceiver`: después de un reinicio o una actualización

Un reinicio mata todos los servicios. La app escucha dos broadcasts, `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED`, y con cualquiera de los dos llama a `AlertService.start`, que arranca el servicio solo si hay un tema guardado. El segundo se dispara después de volver a ejecutar `./gradlew installDebug`, así que una actualización no te deja sin avisos. El primero necesita el permiso `RECEIVE_BOOT_COMPLETED`, que el manifiesto pide.

### La batería: Doze y los móviles agresivos

El modo Doze de Android corta el acceso a la red de las apps mientras el móvil duerme, y solo las despierta en ventanas cortas. Un servicio en primer plano ayuda, pero la conexión todavía se puede cortar. La solución es una exención de las optimizaciones de batería, que solo puedes conceder tú.

El segundo botón de la pantalla de configuración lo hace. Mientras la app no está exenta (`PowerManager.isIgnoringBatteryOptimizations` dice que no), **Permitir en segundo plano** está activado; un toque abre el propio diálogo de Android (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) para esta app. Una vez concedida, el botón pasa a **Ya funciona en segundo plano** y se pone gris. El código silencia para esta llamada el aviso de lint `BatteryLife`, que advierte que Google Play solo permite esa petición a algunos tipos de apps; esta app se instala desde el código fuente.

Algunos fabricantes de móviles van más allá y cierran por su cuenta las apps en segundo plano. El README nombra Infinix, Xiaomi y Huawei. Las pruebas del registro de tareas se hicieron en un Infinix X6730B con Android 15. Si los avisos dejan de llegar, revisa **Permitir en segundo plano**, y después los ajustes de batería o de inicio de apps del propio móvil para Narsil.

## Constrúyelo con Claude

Pídele a Claude el servicio y las reglas por separado: una función pura de Kotlin que vaya de un mensaje de ntfy a lo que muestra una notificación, probada en el PC, y un servicio en primer plano que siga un tema y le pase cada mensaje. La idea que debe acertar es retomar: el flujo tiene que empezar desde el último mensaje mostrado, y solo las direcciones que no pueden hacer daño reciben el toque y el dibujo.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi app de Android (Kotlin, `minSdk 29`, `targetSdk 36`), añade un servicio en primer plano de tipo `specialUse` (con `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` en el manifiesto) que siga `https://ntfy.sh/<topic>/json` en un hilo daemon con `HttpURLConnection`, con tiempos de espera de 15 s para conectar y 90 s para leer, un objeto JSON por línea, quedándose solo con `event == "message"`. Retoma con `?since=<id>` desde el último mensaje mostrado, guardado en `SharedPreferences` después de cada uno y borrado cuando cambie el tema. Reconecta al cabo de un segundo cuando el flujo termine, y con una espera que se duplica hasta 60 s después de un fallo. Pon las reglas en una función pura `Alert.of(JSONObject)`: una prioridad de 4 o más va a un canal de importancia alta, una etiqueta `conv-` en un aviso no urgente se convierte en la etiqueta de reemplazo, como mucho dos acciones `view` se convierten en botones, el toque abre la dirección `click` solo cuando es de `https://claude.ai`, y un icono grande solo se acepta con un prefijo de URL fijo. Vuelve a arrancar el servicio con `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED`. Añade un botón que pida la exención de la optimización de batería. Prueba `Alert.of` con JUnit.

### Qué revisar en la respuesta de Claude

1. Se llama a `startForeground` al principio de `onStartCommand`, con el tipo `specialUse` solo en Android 14 y posteriores.
2. El flujo retoma desde un id guardado, y guardar un tema nuevo borra ese id.
3. Un tiempo de espera de lectura más largo que el keepalive de 45 segundos de ntfy.sh detecta una conexión muerta.
4. Los fallos esperan cada vez más, hasta un tope, y una lectura que funciona reinicia la espera.
5. La dirección del toque y el dibujo están restringidos; los botones tienen un tope de dos.
6. Cada notificación se publica con una etiqueta, para que un mensaje repetido se reemplace a sí mismo.
7. Los `PendingIntent` son `FLAG_IMMUTABLE`.
8. Las reglas no tienen código de Android, y sus pruebas se ejecutan con `./gradlew testDebugUnitTest`.

Si una comprobación falla, dile a Claude lo que ves: "después de tener el móvil apagado una hora, los avisos de esa hora nunca llegaron".

### Cómo lo pidió el autor

El primer mensaje de quien creó Narsil, recogido en `odd/tasks/android-app.md` como L1, pedía "una app movil completa, que reciba las notificaciones". El resto de las reglas de esta guía son del agente, recogidas en la especificación y en el registro, no palabras de quien creó Narsil. La especificación S5 dice que los avisos "keep the PWA's rules" (mantienen las reglas de la PWA, la app web anterior): "sealed messages opened with the key (`narsil1:`), priority >= 4 stays until touched and buzzes its own way, a "done" replaces the previous one of its `conv-` tag, ntfy "view" actions as buttons, a tap opens Claude Code inside the app." (los mensajes sellados se abren con la clave, `narsil1:`; la prioridad 4 o más se queda hasta que se toca y vibra a su manera; un "done" reemplaza al anterior de su etiqueta `conv-`; las acciones "view" de ntfy, como botones; un toque abre Claude Code dentro de la app). La decisión sobre el tipo de servicio está citada arriba.

El registro recoge dos comprobaciones en el móvil. Con un tema desechable: "two done alerts of conv-a left one notification (tag done-conv-a, importance 3) and a priority 4 one its own (importance 4); accents arrive intact; a tap opened MainActivity on claude.ai/code." (dos avisos done de conv-a dejaron una sola notificación, con etiqueta done-conv-a e importancia 3, y uno de prioridad 4 la suya propia, con importancia 4; las tildes llegan intactas; un toque abrió MainActivity en claude.ai/code). Y con el tema y la clave reales, el 2026-11-24 a las 00:44: "The alert showed as an app notification on the urgent channel (importance 4)" (el aviso apareció como notificación de la app en el canal urgente, con importancia 4).

Los commits (el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (construir el script que aloja [la extensión anterior] en una WebView, y lo que guardan los avisos y los estados). `Alert.kt` y sus pruebas.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano). Su mensaje: "alerts follow <topic> from the last one shown, also after a reboot." (los avisos siguen <topic> desde el último mostrado, también después de un reinicio).
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir la configuración desde Narsil en la franja y desde la notificación del servicio).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registrar los avisos y la franja comprobados con el tema y la clave reales).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía (MIT). Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Dos pruebas de JUnit para `Alert.of` con mensajes con la misma forma que los del mod, con ids y textos inventados. Ponlas junto a `AlertTest.kt`:

```kotlin
package io.github.davshn.narsil

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModAlertTest {
    private val openClaude = JSONObject()
        .put("action", "view")
        .put("label", "Abrir Claude")
        .put("url", "https://claude.ai/code")

    @Test
    fun aQuestionFromTheModIsUrgentAndKeepsItsButton() {
        val m = JSONObject()
            .put("id", "example1")
            .put("title", "Narsil · Te necesito · web")
            .put("message", "¿Sigo con la migración?")
            .put("priority", 4)
            .put("tags", JSONArray().put("raising_hand"))
            .put("icon", "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/necesita-oscuro.png")
            .put("actions", JSONArray().put(openClaude))
        val alert = Alert.of(m)
        assertTrue(alert.isUrgent)
        assertEquals("example1", alert.tag)
        assertEquals(listOf("Abrir Claude"), alert.views.map { it.label })
        assertEquals("https://claude.ai/code", alert.opens)
        assertNotNull(alert.icon)
    }

    @Test
    fun twoDonesWithoutAConversationTagDoNotReplaceEachOther() {
        fun done(id: String) = JSONObject()
            .put("id", id)
            .put("message", "He terminado")
            .put("priority", 3)
            .put("tags", JSONArray().put("white_check_mark"))
        assertNotEquals(Alert.of(done("example2")).tag, Alert.of(done("example3")).tag)
    }
}
```

La segunda prueba documenta el comportamiento de hoy con el mod: sin etiqueta `conv-`, no hay reemplazo. Para ver el reemplazo en sí, publica dos avisos con una etiqueta `conv-` en un tema inventado que hayas puesto en la configuración ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Tags: white_check_mark,conv-demo" -d "Primera" https://ntfy.sh/narsil-0000000000example0
curl -H "Tags: white_check_mark,conv-demo" -d "Segunda" https://ntfy.sh/narsil-0000000000example0
curl -H "Priority: 4" -H "Actions: view, Abrir Claude, https://claude.ai/code" -d "¿Sigo?" https://ntfy.sh/narsil-0000000000example0
```

Deberías ver una notificación **Terminó** que dice "Segunda", y una **Te necesita** que aparece encima, vibra tres veces y tiene un botón `Abrir Claude`.

## Errores comunes y cómo probarlo

- **Un servicio `dataSync`.** En Android 15 se detiene después de seis horas al día. Declara el tipo que encaje, con su razón.
- **Empezar el flujo desde ahora en cada reinicio.** Los avisos enviados mientras el móvil estaba apagado se pierden. Retoma desde el último id.
- **Sin tiempo de espera de lectura.** Una conexión que murió con un cambio de red espera para siempre. Elige uno más largo que el keepalive.
- **Reintentar enseguida, para siempre.** Sin una espera creciente, un móvil sin red da vueltas sin parar. Ponle un tope de un minuto.
- **Confiar en el tema.** Sin clave, cualquiera que sepa su nombre puede publicar un aviso. Restringe el toque, el dibujo y el número de botones.
- **Publicar sin etiqueta.** Usa el propio id del mensaje como etiqueta, para que un mensaje entregado dos veces se reemplace a sí mismo.
- **Saltarse la exención de batería.** Los avisos llegan en ráfagas cuando el móvil despierta, con minutos de retraso.
- **Esperar el reemplazo con el mod de hoy.** El mod no envía etiqueta `conv-`, así que los turnos terminados se apilan.

Para probar las reglas, ejecuta `./gradlew testDebugUnitTest`: `AlertTest.kt` comprueba que una pregunta o un error es urgente, que un done con etiqueta `conv-` reemplaza y uno sin ella no, el texto de sellado, el título por defecto, el tope de dos botones, la regla de `click` (una dirección de otro sitio vuelve a `claude.ai/code`) y la regla del dibujo. Para probar el servicio, publica en un tema inventado como arriba, después activa el modo avión, publica dos veces y desactívalo: los dos deberían llegar en menos de un minuto. `adb logcat -s NarsilNtfy` muestra los fallos del flujo y sus esperas ("ntfy.sh stream failed, again in 4 s").

### Dónde difieren el código y el README

- El README dice que cada turno terminado "takes the place of the previous one of the same conversation" (ocupa el lugar del anterior de la misma conversación). La app sí los reemplaza cuando un mensaje lleva una etiqueta `conv-`, como mostró la prueba del registro de tareas con `conv-a`, pero hoy `phoneMessage` de narsil-pet no envía esa etiqueta, solo `white_check_mark`, `raising_hand` o `warning`. Con el mod real, cada turno terminado es su propia notificación.
- El README dice que los avisos perdidos mientras el móvil estaba apagado llegan "once it is back, as ntfy.sh keeps them for 12 hours" (en cuanto vuelve, ya que ntfy.sh los guarda 12 horas). Es cierto una vez que la app ha mostrado al menos un aviso del tema. Antes de eso, y justo después de cambiar de tema, no hay id guardado y el flujo empieza en el momento en que se conecta.
- El README dice que una pregunta o un error "stays until you touch it" (se queda hasta que lo tocas), como si un turno terminado no lo hiciera. En el código, ninguna notificación es persistente ni tiene tiempo de expiración: los dos tipos se quedan hasta que los tocas o los deslizas, y el canal urgente añade la aparición encima y la vibración larga.
- El comentario de la clase de `NtfyStream.kt` dice que sigue el flujo "as the band's lib/stream.js follows it" (como lo sigue el lib/stream.js de la franja). No hay ningún `lib/stream.js` en este repositorio; el comentario se refiere a la extensión anterior.

## Para ir más lejos

- La [guía 7](/es/android/encryption-and-settings/) abre `Seal.unseal`, el primer paso de `take`, y explica la pantalla de configuración y sus botones.
- La [guía 3](/es/android/conversation-band/) reutiliza `NtfyStream` para `<topic>-estado`, desde `since=12h`.
- Del lado del mod, [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica cuándo envía el mod, el límite diario de 200 y el tema.
- [Narsil Watch](/es/watch/what-it-is/) muestra el estado de Narsil en un reloj Wear OS, desde el mismo tema `-estado`.
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
