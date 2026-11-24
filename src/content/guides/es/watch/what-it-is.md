---
title: Qué es Narsil Watch
description: 'La app de Wear OS que pone en tu muñeca los límites de Claude y tus conversaciones abiertas de Claude Code: un tile, una complicación y una app, sin servidor y sin token de Claude.'
route: watch
order: 1
updated: 2026-11-24
sources:
  - repo: watch
    path: README.md
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/build.gradle.kts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Qué hace

Narsil Watch es una app de Wear OS. Pone dos cosas en tu muñeca: cuánto has gastado de los límites de uso de Claude y cómo van tus conversaciones abiertas de Claude Code. Las muestra en tres sitios:

| Superficie                     | Dónde la ves                                                                     | Qué muestra                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El tile **Narsil · Claude**    | Deslizando hacia un lado desde la esfera                                         | Dos anillos, el límite de 5 horas por fuera y el semanal por dentro, Narsil en el centro, cuántas conversaciones te necesitan y qué antigüedad tiene la lectura. |
| La complicación **Claude 5 h** | En cualquier esfera que admita una                                               | El límite de 5 horas, como un arco o como un texto corto, por ejemplo `62%`.                                                                                     |
| La app, llamada **Narsil**     | Desde la lista de apps del reloj, o con un toque en el tile o en la complicación | Cada conversación abierta con su estado, los dos límites con cuándo se reinician y el nivel de Narsil.                                                           |

La app habla español, como la propia Narsil. Los estados que muestra son los suyos: `TRABAJANDO`, `PARADA`, `TE NECESITA`, `TERMINADA` y `ERROR`.

No necesita **ningún servidor** ni **ningún token de Claude**. Nunca habla con Claude. Lee un pequeño estado que el mod de Narsil de tu PC ya publica para tu móvil, en un tema privado de [ntfy.sh](https://ntfy.sh). [Leer el estado de Narsil](/es/watch/reading-the-state/) explica ese estado, y [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica cómo lo envía el mod.

> **Experimental.** El reloj solo sabe lo que el mod publicó por última vez, y el mod solo publica cuando termina un turno (o llega una pregunta) mientras estás lejos del PC, dentro del margen diario gratuito de ntfy.sh. En tu escritorio, el reloj sigue mostrando una lectura vieja. Pide una nueva como mucho cada 15 minutos, ntfy.sh guarda un mensaje solo durante un tiempo, y la app es una compilación de depuración que instalas tú mismo por `adb`, versión `0.1.0`. Cualquier cambio en la forma del estado del mod puede romperla.

Narsil Watch es de código abierto bajo la GPL v3 (o cualquier versión posterior), en [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch). No está afiliada a Anthropic.

## Cómo funciona por dentro

### Un estado, tres superficies

El código es pequeño: diez archivos de Kotlin bajo `app/src/main/kotlin/tech/davshn/narsilwatch/`. El README resume las carpetas, y vale la pena copiar esa división:

- `domain/`: el estado tal como lo publica Narsil (`NarsilState.kt`) y cómo lo redacta y lo colorea el reloj (`Display.kt`). Kotlin puro, sin Android.
- `data/`: la lectura del tema de ntfy (`StatusRepository.kt`, `StatusParser.kt`), la apertura del sello (`Seal.kt`) y la conservación del último estado.
- `tile/`, `complication/`, `presentation/`: las tres superficies.
- `sync/`: el refresco cada 15 minutos con WorkManager, y los redibujados.

Las tres superficies nunca consultan la red por su cuenta mientras se dibujan. Todas leen el mismo último estado que `StatusRepository` guarda en el reloj, mediante `cached()`. Solo el refresco le pregunta a ntfy.sh, y cuando tiene algo nuevo les dice al tile y a la complicación que se vuelvan a dibujar. Por eso el tile aparece al instante, incluso sin conexión: nunca espera una petición.

El comentario al principio de `StatusRepository.kt` (GPL v3) lo dice en una línea:

```kotlin
// Where the watch keeps the topic, the key, and the last state it read, so
// the tile and the complication draw at once, offline too.
```

(Dónde guarda el reloj el tema, la clave y el último estado que leyó, para que el tile y la complicación se dibujen al instante, también sin conexión).

### El flujo de datos

El README dibuja todo el camino en una línea:

```text
Claude Code ── Narsil mod ──► ntfy.sh/<topic>-estado ──► Narsil Watch (tile, complication, app)
```

Paso a paso:

1. **Claude Code ejecuta el mod de Narsil** ([narsil-pet](https://github.com/davshn/narsil-pet)) en tu PC. Ya conoce tus conversaciones, sus estados, el nivel de Narsil y, desde la versión 3.10.0, los límites de 5 horas y semanal de Claude.
2. **El mod publica un estado JSON** en `https://ntfy.sh`, en el tema `<tu tema>-estado`. Tu tema es el que creó `/narsil movil`, un nombre como `narsil-0000000000example0` (todos los temas de esta ruta son ejemplos inventados).
3. **ntfy.sh guarda el último mensaje** durante un tiempo. Un comentario en `hooks/register.tsx` de narsil-pet dice que "keeps a message 12 h" (guarda un mensaje 12 h).
4. **El reloj le pide a ntfy.sh el último mensaje** de ese tema, lo abre con tu clave si va sellado y lo guarda.
5. **El tile, la complicación y la app** se dibujan a partir de lo que guardó.

Nada va en sentido contrario. La sección Security del README es clara: "the watch only reads the topic: it never publishes on it." (el reloj solo lee el tema: nunca publica en él).

### Cuándo publica el mod, y qué significa eso para la frescura

Esto es lo más importante que hay que entender del reloj. Es una ventana al último mensaje, no un flujo en vivo.

`sendStatus` del mod, en `hooks/register.tsx`, se ejecuta cuando termina un turno de la conversación principal y cuando llega una pregunta, y `/narsil movil prueba` también envía uno. Cada vez, `postToPhone` decide si de verdad sale. De sus primeras líneas:

```ts
const { phoneTopic, isPhoneOn, phoneKey } = await read($, prefs)
if (!isPhoneOn || !phoneTopic || (!force && !(await isAway($)))) return false
const day = dayOf(await $.clock.now())
const count = countOf(await $.store.get(PHONE_KEY).catch(() => undefined), day)
if (count.sent >= PHONE_DAILY) return false
```

Ese fragmento es de `hooks/register.tsx` en narsil-pet (GPL v3), sin su sangría. En palabras, el estado sale solo cuando:

- **`/narsil movil` está activado** y existe un tema.
- **Estás fuera.** `isAway` lee de dónde vino tu último mensaje. Si llegó por Remote Control (tu móvil o la web), estás fuera; si llegó desde el terminal o la app de escritorio, estás en el escritorio.
- **El margen del día no se ha agotado.** `PHONE_DAILY` es 200. El comentario de `hooks/phone.ts`: "ntfy.sh takes 250 a day for free: Narsil stops short of it." (ntfy.sh acepta 250 al día gratis: Narsil se queda por debajo). El día es el día UTC, y los avisos y los estados comparten los mismos 200.

Así que, en la práctica:

- **Mientras trabajas desde el móvil**, sale un estado nuevo al final de cada turno. El reloj lo recoge en su siguiente refresco.
- **En el escritorio**, no sale nada. El reloj se queda con la última lectura que tenía. Es así a propósito: en el escritorio ves la banda y la ventana flotante, y enviar gastaría el margen diario para nada. El tile y la app muestran qué antigüedad tiene la lectura (`hace 2 h`), así que nunca te engañan.
- **En un día ajetreado fuera**, los 200 se pueden agotar. A partir de ahí no llega nada nuevo hasta la medianoche UTC.
- **Si no se publicó nada durante más de unas 12 horas**, puede que ntfy.sh ya no tenga nada que dar. El reloj sigue mostrando lo que guardó.

Los límites también envejecen. Una cifra de 5 horas leída al mediodía no dice nada seguro sobre las 5 de la tarde. La app muestra cuándo se reinicia cada límite ([guía 5](/es/watch/app-and-refresh/)), y la etiqueta de antigüedad te dice qué edad tiene todo.

### Por qué los avisos no forman parte de la app

Podrías esperar que una app de reloj vibrara cuando Claude te necesita. Esta no lo hace, a propósito. El README lo explica: "Alerts (a question, a finished turn, an error) are not part of this app: Narsil for Android or the ntfy app on your phone already mirror them to the watch." (los avisos, una pregunta, un turno terminado, un error, no forman parte de esta app: Narsil para Android o la app de ntfy de tu móvil ya los reflejan en el reloj).

Wear OS ya muestra en el reloj las notificaciones del móvil. El mod ya envía sus avisos a tu tema de ntfy. Así que los avisos llegan a tu muñeca a través del móvil, con cualquiera de estas dos:

- [Narsil para Android](/es/android/what-it-is/), que los convierte en notificaciones nativas y abre los sellados con tu clave, o
- la app de ntfy, suscrita a tu tema. El propio texto de ayuda del mod dice que un reloj Wear OS "mostrará sus notificaciones si tienes activadas las de ntfy en la app del reloj".

Un segundo camino de avisos desde la app del reloj significaría dos vibraciones por un mismo evento, y una segunda suscripción que mantiene ocupada la radio. La app del reloj hace lo único que el móvil no puede reflejar: un resumen de todo de un vistazo.

### Lo que lee de la red

Según `AndroidManifest.xml`, la app pide solo dos permisos, `INTERNET` y `ACCESS_NETWORK_STATE`. Se marca como app de reloj independiente (`com.google.android.wearable.standalone` es `true`), así que no necesita una app compañera en el móvil. Fija `android:allowBackup="false"`, así que el tema y la clave que guarda no se copian a una copia de seguridad.

Solo habla con dos sitios, que la sección Security del README enumera y el código confirma:

- **`https://ntfy.sh`**, para el estado.
- **`https://raw.githubusercontent.com/davshn/narsil-pet/`**, para los dibujos de Narsil. `StatusRepository` rechaza cualquier otra dirección para el dibujo (la [guía 2](/es/watch/reading-the-state/) explica por qué).

Ningún token de Claude ni ninguna cuenta de Claude llegan al reloj.

### Instalarla por adb inalámbrico

No está en ninguna tienda. Compilas la app en tu PC y la instalas en el reloj por Wi-Fi. Según el README, necesitas:

- Un reloj con **Wear OS 3 o posterior**, con las opciones de desarrollador y la **depuración inalámbrica** activadas.
- En el PC, **JDK 17 o posterior** y el **Android SDK**, con `ANDROID_HOME` apuntando a él.

Empareja el reloj como explica su pantalla de depuración inalámbrica y, después, en una copia del repositorio:

```bash
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

La dirección es un ejemplo; usa la IP y el puerto que muestra tu reloj. `installDebug` compila la variante de depuración y la instala en el dispositivo conectado. Después añade el tile **Narsil · Claude** desde el editor de tiles del reloj, y la complicación **Claude 5 h** desde el editor de la esfera.

Para actualizar, trae la última versión del repositorio y vuelve a ejecutar el mismo comando. El README dice que la configuración se conserva.

La primera vez que abres la app, muestra **Configurar**: tu tema y, si usas una, tu clave. Puedes escribirlos en el reloj o enviarlos desde el PC con un solo comando `adb`. La [guía 5](/es/watch/app-and-refresh/) muestra las dos formas. En Claude Code, `/narsil movil` muestra tu tema y `/narsil movil clave` crea la clave.

### El tema y la clave: qué permiten y cómo cambiarlos

Los dos son secretos, así que conviene ser preciso con ellos:

- **Dónde se guardan en el reloj.** En el almacenamiento privado de la app (`SharedPreferences` de Android llamadas `narsil`, en `MODE_PRIVATE`), como dice el README. No en una copia de seguridad, porque las copias están desactivadas.
- **Qué permite el tema.** Cualquiera que conozca su nombre puede leer todos sus mensajes, tanto los avisos como `-estado`, y puede publicar en él. El reloj en sí solo lee.
- **Qué permite la clave.** Abre los mensajes sellados. Sin ella, quien lea el tema ve ruido; con ella, el estado completo.
- **Cómo rotarlos.** `/narsil movil nuevo` crea un tema nuevo; el antiguo ya no recibe nada más. `/narsil movil clave` crea una clave nueva cada vez que lo ejecutas, y la antigua ya no abre lo que se envía a partir de entonces. Después de cualquiera de los dos, dale al reloj el valor nuevo en **Configurar**.
- **Cómo quitarlos del reloj.** Vacía los campos en **Configurar**, o desinstala la app.

El README añade una advertencia sencilla: "Without a key, anyone who knows your topic's name can read it. Use `/narsil movil clave` if that matters to you." (sin clave, cualquiera que conozca el nombre de tu tema puede leerlo; usa `/narsil movil clave` si eso te importa).

### Sistemas compatibles

Según el README y `app/build.gradle.kts`:

| Sistema        | Compatibilidad                                                                               |
| -------------- | -------------------------------------------------------------------------------------------- |
| Wear OS        | 3 o posterior. La compilación fija `minSdk = 30` ("Wear OS 3 and later") y `targetSdk = 36`. |
| Mod de Narsil  | Una versión que publique `limits` y `sessions` en su estado: la 3.10.0 o posterior.          |
| Tizen, watchOS | No disponible. Es una app de Android.                                                        |

La compilación usa Java 17, Kotlin con Compose para la app, las bibliotecas Tiles y ProtoLayout de Wear para el tile, la biblioteca de fuentes de datos de complicaciones y WorkManager. Las versiones están en `gradle/libs.versions.toml`.

Un mod más antiguo sigue funcionando, en parte. `NarsilState` da a `limits` y `sessions` valores vacíos por defecto, así que un estado anterior a la 3.10.0 se lee sin ellos: los anillos se quedan vacíos y la lista dice `Sin conversaciones`.

### Por qué es experimental

Cada motivo sale del código o del README:

- **Depende de que el mod publique.** Sin mod, con `/narsil movil` desactivado o con un mod antiguo, el reloj tiene poco o nada que mostrar.
- **Las lecturas solo llegan mientras estás fuera.** En tu escritorio el estado no cambia.
- **El margen diario gratuito de ntfy.sh.** El mod se detiene en 200 mensajes al día, compartidos con los avisos.
- **Un refresco cada 15 minutos.** El intervalo repetido más corto de WorkManager, como dice el comentario de `Refresh.kt`.
- **Un servicio público en medio.** ntfy.sh guarda los mensajes durante un tiempo limitado y es un tercero.
- **Instalación manual.** Se instala como compilación de depuración por `adb`, versión `0.1.0`, sin tienda y sin actualizaciones automáticas.
- **Los tests cubren la lógica, no las pantallas.** Los tests unitarios comprueban el analizador, la redacción y el sello; nada prueba el tile ni la complicación en un dispositivo.

## Constrúyelo con Claude

Si quieres tu propia app de reloj como esta, pídele a Claude primero el esqueleto: un proyecto de Wear OS con una app, un servicio de tile y un servicio de complicación, todos leyendo un mismo estado guardado. La idea que debe acertar es que las superficies leen una copia local y nunca esperan a la red.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt del autor.

> Crea una app de Wear OS 3+ en Kotlin (`minSdk = 30`, Java 17) llamada `my-watch`, con el paquete `com.example.mywatch`. Lee un estado JSON del último mensaje de un tema de ntfy.sh, `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest`, y nunca publica. Divídela en `domain/` (el estado como una data class `@Serializable` y funciones puras de presentación), `data/` (un repositorio que guarda el tema y la última respuesta en bruto en `SharedPreferences` privadas, y un analizador), `tile/` (un `TileService`), `complication/` (un `SuspendingComplicationDataSourceService` con `RANGED_VALUE` y `SHORT_TEXT`), `presentation/` (una actividad de Compose para Wear OS) y `sync/` (un trabajo de WorkManager cada 15 minutos que refresca y pide al tile y a la complicación que se vuelvan a dibujar). El tile y la complicación solo leen el estado guardado. Marca la app como independiente, desactiva las copias de seguridad y pide solo `INTERNET` y `ACCESS_NETWORK_STATE`. Añade tests de JUnit para el analizador y las funciones de presentación, y un workflow de GitHub Actions que ejecute `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### Qué revisar en la respuesta de Claude

1. El tile y la complicación leen el estado guardado. Ninguno hace una petición de red mientras se dibuja.
2. El manifiesto declara el tile con `BIND_TILE_PROVIDER` y la complicación con `BIND_COMPLICATION_PROVIDER`, sus `SUPPORTED_TYPES` y un `UPDATE_PERIOD_SECONDS`.
3. La app tiene `com.google.android.wearable.standalone` en `true` y `allowBackup` en `false`.
4. Solo se piden `INTERNET` y `ACCESS_NETWORK_STATE`.
5. El repositorio guarda la última respuesta buena y no la sobrescribe con una vacía o ilegible.
6. El tema nunca aparece en un registro.

Si una comprobación falla, dile a Claude lo que ves: "el tile se queda en blanco unos segundos cuando deslizo hasta él", lo que significa que está esperando a la red.

### Cómo lo pidió el autor

No existe ningún registro de tareas ni ninguna petición registrada para esta app. Lo que sigue es una reconstrucción a partir del historial de commits de los dos repositorios, no las palabras del autor:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (publicar los límites de Claude y las conversaciones abiertas para el reloj). Su mensaje: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." (el tema de estado lleva ahora los límites de 5 horas y semanal, porcentaje, color y reinicio, y hasta 8 conversaciones abiertas, para que una app de Wear OS pueda mostrarlos).
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil en Wear OS con los límites de Claude y las conversaciones abiertas). Toda la app en un solo commit. Su mensaje: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose, a 5-hour complication, and an app listing every open conversation. It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed." (un tile con los límites de 5 horas y semanal como anillos y Narsil en su pose actual, una complicación de 5 horas y una app que lista cada conversación abierta; lee el estado de Narsil de su tema de estado de ntfy.sh y lo abre con la clave de /narsil movil clave cuando va sellado).
- narsil-pet `9437318` (2026-11-23) "chore(release): 3.10.0". La primera versión cuyo estado puede leer el reloj por completo.
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (alinear el README con la familia Narsil). El README gana la tabla de estados, las secciones Security y Supported systems, y Narsil para Android junto a la app de ntfy como camino por el que los avisos llegan al reloj; el primer README solo nombraba la app de ntfy.

El orden cuenta la historia: primero cambió el lado del mod, para que el estado llevara lo que necesita un reloj, y después se construyó el reloj para leerlo. Ninguno de los dos lados necesitó un servidor.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Un manifiesto mínimo para una app de esta forma, escrito para esta guía y adaptado de `app/src/main/AndroidManifest.xml` en [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Los nombres de clase pertenecen al paquete de ejemplo `com.example.mywatch`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".MyWatchApplication"
        android:allowBackup="false"
        android:label="My watch"
        android:theme="@android:style/Theme.DeviceDefault">

        <meta-data
            android:name="com.google.android.wearable.standalone"
            android:value="true" />

        <activity
            android:name=".presentation.MainActivity"
            android:exported="true"
            android:taskAffinity="">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".tile.MyTileService"
            android:exported="true"
            android:label="My tile"
            android:permission="com.google.android.wearable.permission.BIND_TILE_PROVIDER">
            <intent-filter>
                <action android:name="androidx.wear.tiles.action.BIND_TILE_PROVIDER" />
            </intent-filter>
        </service>

        <service
            android:name=".complication.MyComplicationService"
            android:exported="true"
            android:label="My limit"
            android:permission="com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER">
            <intent-filter>
                <action android:name="android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST" />
            </intent-filter>
            <meta-data
                android:name="android.support.wearable.complications.SUPPORTED_TYPES"
                android:value="RANGED_VALUE,SHORT_TEXT" />
            <meta-data
                android:name="android.support.wearable.complications.UPDATE_PERIOD_SECONDS"
                android:value="900" />
        </service>
    </application>
</manifest>
```

Cada línea está ahí por algo. El `uses-feature` limita la app a relojes. Los dos permisos son todo lo que necesita una lectura por HTTPS. Los servicios del tile y de la complicación se exportan, porque el sistema se vincula a ellos, y se protegen con los permisos de vinculación, para que solo pueda hacerlo el sistema. `900` segundos coincide con el refresco de 15 minutos.

Y los comandos para compilar, probar e instalar, según el README, con una dirección de ejemplo:

```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

## Errores comunes y cómo probarlo

- **Esperar datos en vivo en el escritorio.** El mod solo publica mientras estás fuera. La etiqueta de antigüedad es la respuesta honesta; léela antes que los números.
- **Desactivar `/narsil movil`.** Detiene los estados además de los avisos. El reloj se queda con su última lectura, que cada vez es más vieja.
- **Un mod antiguo.** Antes de la 3.10.0 no hay `limits` ni `sessions`. Los anillos se quedan vacíos y la lista dice `Sin conversaciones`.
- **El tema `-estado` en la app de avisos.** Suscribe la app de ntfy a tu tema normal, no a `-estado`. El tema de estado son datos, enviados con prioridad 1, y el comentario del mod dice que "not followed by push" (no se sigue por push).
- **Esperar avisos de la app del reloj.** Llegan a través del móvil. Comprueba primero que la app de ntfy o Narsil para Android los muestra en el móvil.
- **Sin opciones de desarrollador.** En el reloj, las opciones de desarrollador tienen que estar activadas para que aparezca la depuración inalámbrica.

Para probar todo el camino de punta a punta:

1. En Claude Code, ejecuta `/narsil movil`, apunta el tema y escríbelo en el reloj en **Configurar**.
2. Ejecuta `/narsil movil prueba`. Envía un aviso de prueba y, cuando ese sale, un estado, incluso desde el escritorio.
3. Abre la app en el reloj. Se refresca al abrirse. La antigüedad debería decir `ahora`.
4. Desliza hasta el tile. Muestra la misma lectura, con los anillos llenos si el mod ha leído los límites de Claude.

### Dónde difieren el código y el README

- El README dice que el reloj lee el último mensaje "every 15 minutes, and whenever you open the app or the tile" (cada 15 minutos, y cada vez que abres la app o el tile). La app sí se refresca cada vez que se abre. El tile, en cambio, solo pide un refresco cuando la última comprobación tiene más de 15 minutos, y dibuja primero el estado guardado ([guía 3](/es/watch/tile/)).
- El README dice que Narsil publica el estado "when a turn ends while you are away" (cuando termina un turno mientras estás fuera). El código del mod también lo publica con cada pregunta, y con `/narsil movil prueba`, que sale incluso desde el escritorio.
- El propio README de narsil-pet sigue listando cinco campos para `-estado`. Su código envía siete desde la 3.10.0, `limits` y `sessions` incluidos ([guía 2](/es/watch/reading-the-state/)).

## Para ir más lejos

- Lee el código en [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch).
- [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) cubre el lado del mod: el tema, la cuenta diaria y la clave.
- [Narsil para Android](/es/android/what-it-is/) es la app del móvil que refleja los avisos en el reloj.
- Lo siguiente en esta ruta: [Leer el estado de Narsil](/es/watch/reading-the-state/), cómo el reloj obtiene, abre y guarda el estado.
- Después, [el tile](/es/watch/tile/), [la complicación](/es/watch/complication/) y [la app y su refresco](/es/watch/app-and-refresh/).
