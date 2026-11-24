---
title: La app y el refresco
description: 'La app del reloj con cada conversación, los dos límites y el nivel de Narsil; el tema y la clave, en el reloj o desde el PC; el refresco de WorkManager cada 15 minutos, los redibujados y la CI.'
route: watch
order: 5
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/presentation/MainActivity.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/NarsilApplication.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: .github/workflows/ci.yml
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: watch
    path: README.md
---

## Qué hace

El tile y la complicación son para un vistazo. La app, llamada **Narsil** en la lista de apps del reloj, es para cuando quieres verlo todo. Es una única lista que se desplaza:

1. **Narsil arriba**, en la pose de tu conversación más importante, con su nombre y su nivel, como `⭐ Nivel 3 · 40/300 XP` (nivel 3, 40 de 300 puntos de experiencia).
2. **Una nota**, solo cuando algo va mal: todavía no hay estado, o hay un estado sellado que el reloj no puede abrir.
3. **`Límites de Claude`**: una fila por límite, `5 horas` y `Semana`, cada una con su porcentaje, una barra de color y cuándo se reinicia, como `reinicia en 2 h 05 min`.
4. **`Conversaciones`**: cada conversación abierta que envió el mod, la más importante primero, cada una con un punto de color, su título y su estado, como `TE NECESITA`. Si no hay ninguna, el encabezado dice `Sin conversaciones`.
5. **La antigüedad de la lectura**, como `hace 12 min`.
6. **Dos botones**: `Actualizar`, que dice `Leyendo…` mientras trabaja, y `Configurar`.

Por detrás de las pantallas, un trabajo en segundo plano le pide a ntfy.sh un estado nuevo cada 15 minutos y vuelve a dibujar el tile y la complicación. Esta guía cubre las dos cosas, y la CI y los tests del proyecto.

> **Experimental.** La app muestra solo lo que el mod publicó por última vez, y el mod solo publica mientras trabajas lejos del PC, dentro del margen diario gratuito de ntfy.sh. El refresco en segundo plano se ejecuta como mucho cada 15 minutos, el intervalo más corto de WorkManager. La app se instala como compilación de depuración por `adb`, y el tema y la clave se configuran a mano.

## Cómo funciona por dentro

### Una actividad, escrita con Compose para Wear OS

`presentation/MainActivity.kt` contiene toda la app: una `ComponentActivity` y un puñado de funciones composables. Usa Compose para Wear OS con Material 3: `AppScaffold`, `ScreenScaffold` y una `ScalingLazyColumn`, la lista que encoge y difumina los elementos cerca de los bordes de la pantalla redonda.

Los colores son un `ColorScheme` de Material 3 construido a partir de `Palette` en `domain/Display.kt`: el fondo azul oscuro, el texto claro, el gris apagado, la pista y el acento violeta. Así, la app, el tile y la complicación comparten un mismo juego de colores.

`onCreate` hace tres cosas, en orden:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val repo = StatusRepository(this)
    setupFrom(intent, repo)
    setContent {
        MaterialTheme(colorScheme = NarsilColors) {
            AppScaffold { NarsilScreen(repo) }
        }
    }
}
```

Ese fragmento y los demás de esta sección son de `MainActivity.kt` en narsil-watch (GPL v3). `setupFrom` lee un tema y una clave enviados desde el PC, si los hay (abajo). Después se dibuja la pantalla.

### Primero la configuración, o la lista

`NarsilScreen` guarda su estado en unos pocos valores `remember`: si se está mostrando la configuración, el estado guardado, el dibujo, la nota actual y si hay un refresco en marcha. La primera línea decide lo que ves:

```kotlin
var isSetup by remember { mutableStateOf(!repo.isConfigured) }
```

`isConfigured` es verdadero en cuanto hay un tema guardado. Así que la primera vez que abres la app muestra **Configurar**, y todas las veces siguientes muestra la lista.

Un `LaunchedEffect(isSetup)` ejecuta `refresh()` cada vez que aparece la lista: cuando abres la app, y justo después de guardar la configuración. Ese es el "refresco al abrir". Llama directamente al repositorio, en el ámbito de corrutinas de la pantalla:

```kotlin
fun refresh() {
    isLoading = true
    scope.launch {
        val result = repo.refresh()
        problem = when (result) {
            is StatusResult.Ok -> null
            StatusResult.NeedsKey -> "El estado va sellado: falta la clave o no es la de /narsil movil clave."
            StatusResult.Empty -> "Aún no hay estado: Narsil lo publica cuando escribes lejos del PC."
        }
        state = repo.cached()
        art = repo.art()
        isLoading = false
        Refresh.redraw(repo.appContext)
    }
}
```

Lo que significa cada resultado en pantalla:

- **`Ok`**: ninguna nota.
- **`NeedsKey`**: `El estado va sellado: falta la clave o no es la de /narsil movil clave.`
- **`Empty`**: `Aún no hay estado: Narsil lo publica cuando escribes lejos del PC.`

Después de cualquier resultado, la pantalla vuelve a cargar el estado y el dibujo guardados, y llama a `Refresh.redraw`, para que el tile y la complicación se pongan al día con lo que acaba de leer la app. La [guía 2](/es/watch/reading-the-state/) explica por qué un error de red da `Ok` con el estado guardado: estar sin conexión no es un error que muestre la app.

`Empty` puede aparecer encima de un estado. Si ntfy.sh ya no tiene ningún mensaje (un comentario de narsil-pet dice que "keeps a message 12 h", guarda un mensaje 12 h), la consulta vuelve vacía, pero el reloj sigue teniendo su copia guardada. Ves las dos cosas: el estado viejo y la nota de que no hay nada nuevo.

### Los límites, con "reinicia en"

`LimitRow` dibuja un límite: la etiqueta a la izquierda, el porcentaje a la derecha en el color del límite (`62 %`), una barra de 6 dp con la parte usada en ese color sobre la pista y, debajo, cuándo se reinicia. El color es `parseColor(limit.color)`, el color que envió el PC ([guía 3](/es/watch/tile/)).

El texto del reinicio es `resetLabel`, de `domain/Display.kt` (GPL v3):

```kotlin
fun resetLabel(resetsAt: Long?, nowSeconds: Long): String {
    if (resetsAt == null) return ""
    if (resetsAt <= nowSeconds) return "reiniciado"
    val minutes = (resetsAt - nowSeconds) / 60
    return when {
        minutes < 60 -> "reinicia en $minutes min"
        minutes < 24 * 60 -> "reinicia en ${minutes / 60} h ${(minutes % 60).toString().padStart(2, '0')} min"
        else -> "reinicia en ${minutes / (24 * 60)} d ${(minutes % (24 * 60)) / 60} h"
    }
}
```

- **Sin hora de reinicio** (`null`, Claude no lo dijo): ninguna línea. La fila la oculta cuando el texto está vacío.
- **Dentro de la hora**: `reinicia en 45 min`.
- **Dentro del día**: `reinicia en 2 h 05 min`, con los minutos rellenados a dos dígitos.
- **Más allá**: `reinicia en 3 d 4 h`, la forma que suele tener un límite semanal.
- **Ya pasado**: `reiniciado`.

Ese último caso es la línea más útil de la app. El porcentaje de encima sale del último estado, que puede tener horas. Si la hora de reinicio ya pasó, la ventana ha vuelto a empezar, y el porcentaje que se muestra ya no es cierto. `reiniciado` te lo dice. El test "says when a limit resets" (dice cuándo se reinicia un límite) de `DisplayTest.kt` comprueba los cinco casos.

### Las conversaciones, con sus estados

`SessionRow` dibuja una conversación como una fila redondeada: un punto de 8 dp en el color del estado, el título en una línea (cortado con puntos suspensivos si es largo) y la etiqueta del estado debajo, en el mismo color, en negrita. Los colores son `statusColor` de `Display.kt`: azul para `TRABAJANDO`, gris para `PARADA`, amarillo para `TE NECESITA`, verde para `TERMINADA` y rojo para `ERROR`.

Las filas llegan en el orden en que las envió el mod, que es el orden del mod: primero los errores, después lo que te necesita, lo que trabaja, lo que terminó y lo que está en reposo ([guía 2](/es/watch/reading-the-state/)). Como mucho 8, con títulos de como mucho 40 caracteres, tal como los corta `watchSessions` en `hooks/phone.ts` de narsil-pet. La app no añade ningún orden propio, así que siempre coincide con la banda de tu PC.

### El nivel de Narsil

`NarsilHeader` muestra el dibujo (48 por 80 dp), el nombre **Narsil** en negrita y el texto `xp` del estado. El dibujo es el que el repositorio descargó del GitHub de narsil-pet, decodificado con `BitmapFactory`; si todavía no hay ninguno, o no se puede decodificar, el dibujo incluido `narsil_preview`. El texto `xp` lo escribe el mod, así que el nivel, la experiencia y las estrellas son exactamente los del PC.

### Configurar: la configuración en el reloj

`SetupScreen` tiene dos campos y un botón:

- **`El tema de /narsil movil`**, con la pista `narsil-…`.
- **`La clave, si usas /narsil movil clave`**, con la pista `opcional`.
- **`Guardar`**, activado solo cuando el tema no está en blanco.

Los campos son `BasicTextField` de Compose, de una línea cada uno, rellenos con lo que ya está guardado. `Guardar` guarda los dos a través del repositorio, que les quita los espacios sobrantes, y vuelve a la lista, que se refresca. Para quitar la clave, vacía el campo y guarda.

La configuración no comprueba nada más. Un tema con una errata se guarda sin problema, y la lista dice entonces `Aún no hay estado`. Un error sí se perdona: el repositorio añade `-estado` solo si el tema no termina ya en él ([guía 2](/es/watch/reading-the-state/)), así que pegar por error el tema de estado sigue funcionando.

Escribir una clave de 43 caracteres en el teclado de un reloj es lento. Por eso hay una segunda forma.

### Configurar el tema y la clave desde el PC

`setupFrom` lee dos extras del intent que arrancó la actividad:

```kotlin
// Setup from the PC, without typing on the watch:
// adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-... --es key ...
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Refresh.now(this)
}
```

Así que, con el reloj conectado por `adb` inalámbrico ([guía 1](/es/watch/what-it-is/)), puedes enviar los dos en un solo comando. Con valores inventados:

```bash
adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-0000000000example0 --es key example-key-not-real
```

`am start -n` arranca la actividad indicada, y cada `--es nombre valor` añade un extra de tipo cadena. Lo que hace el código con ellos:

- **Sin el extra `topic`, no pasa nada.** La función vuelve enseguida, así que un arranque normal desde la lista de apps no cambia nada.
- **`topic` sin `key`** guarda el tema y deja la clave guardada como estaba.
- **`--es key ""`** guarda una clave vacía, lo que la quita.
- **Después, `Refresh.now`** pone en cola un refresco en segundo plano, y el tile y la complicación se vuelven a dibujar cuando termina.

Como `setupFrom` solo se ejecuta en `onCreate`, y la actividad no gestiona intents nuevos, cierra la app en el reloj antes de enviar el comando. Si no, Android puede traer al frente la app abierta sin leer los extras.

Dos notas sobre los secretos:

- **Dónde acaban.** En el reloj, en las preferencias privadas de la app ([guía 2](/es/watch/reading-the-state/)). En el PC, el comando, clave incluida, se queda en el historial de tu shell. Borra esa línea si otras personas usan la máquina.
- **Qué permiten y cómo rotarlos.** El tema permite a cualquiera leer tu tema de ntfy y publicar en él; la clave abre los mensajes sellados. `/narsil movil nuevo` crea un tema nuevo, y `/narsil movil clave` una clave nueva; envía los nuevos con el mismo comando.

La actividad está exportada, como debe estarlo toda actividad de lanzador, para que el sistema pueda arrancarla. Lo mismo vale para cualquier app del reloj: cualquier cosa que pueda arrancar actividades puede arrancar esta con un extra `topic`.

### El refresco: sync/Refresh.kt

Tres funciones y un worker. De `sync/Refresh.kt` en narsil-watch (GPL v3):

```kotlin
// Every 15 minutes (WorkManager's shortest), the watch asks ntfy.sh for the
// state and redraws the tile and the complication.
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Refresh.redraw(applicationContext)
        return Result.success()
    }
}

object Refresh {
    private const val PERIODIC = "narsil-refresh"
    private const val NOW = "narsil-refresh-now"

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<RefreshWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, work)
    }
```

Leyéndolo:

- **`RefreshWorker`** obtiene el estado ([guía 2](/es/watch/reading-the-state/)) y después pide al tile y a la complicación que se vuelvan a dibujar (la [guía 4](/es/watch/complication/) muestra `redraw`). Es un `CoroutineWorker`, así que `refresh()`, una función `suspend`, se ejecuta dentro con naturalidad.
- **Siempre informa de éxito.** Una descarga fallida no se reintenta con la espera progresiva de WorkManager; el siguiente periodo simplemente vuelve a intentarlo. El repositorio ya guarda el último estado bueno, así que no hay nada que recuperar.
- **`online`**: los dos tipos de trabajo esperan a tener conexión de red. Sin conexión, WorkManager retiene el trabajo hasta que el reloj se conecta, en lugar de ejecutarlo para que falle.
- **`schedule`**: un trabajo periódico cada 15 minutos, la repetición más corta que permite WorkManager. Es único por nombre, `narsil-refresh`, con la política `KEEP`: si ya hay uno programado, la nueva petición se descarta. Así que llamar a `schedule` en cada arranque nunca apila trabajos ni reinicia el temporizador.
- **`now`**: un refresco lo antes posible, único como `narsil-refresh-now`, también con `KEEP`. Muchas llamadas seguidas, como deslizar hasta el tile varias veces, ponen en cola uno solo.

### NarsilApplication: donde empieza la programación

El archivo entero, sin su paquete ni sus importaciones, de `NarsilApplication.kt` (GPL v3):

```kotlin
class NarsilApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Refresh.schedule(this)
    }
}
```

El manifiesto la nombra como clase de la aplicación (`android:name=".NarsilApplication"`). `Application.onCreate` se ejecuta cada vez que arranca el proceso de la app, por cualquier motivo: abrir la app, que el sistema se vincule al tile o que le pida datos a la complicación. Así que el trabajo periódico se programa en cuanto se ejecuta cualquier parte de la app y, gracias a `KEEP`, se programa una sola vez.

### Qué se ejecuta y cuándo

Juntando las piezas:

| Momento                                                            | Qué pasa                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Arranca cualquier parte de la app                                  | `NarsilApplication` programa el trabajo de 15 minutos, una vez.                            |
| Cada 15 minutos, con red                                           | `RefreshWorker` obtiene, guarda y vuelve a dibujar el tile y la complicación.              |
| Abres la app (con el tema configurado)                             | La pantalla obtiene el estado directamente, muestra el resultado y vuelve a dibujar ambos. |
| Tocas `Actualizar`                                                 | Lo mismo que al abrirla.                                                                   |
| Guardas en `Configurar`                                            | Aparece la lista y obtiene el estado.                                                      |
| Envías el tema con `adb shell am start`                            | `Refresh.now` pone en cola un refresco; la pantalla también obtiene el estado al aparecer. |
| Se dibuja el tile y la última comprobación tiene más de 15 minutos | `Refresh.now` pone en cola un refresco; mientras, el tile dibuja el estado guardado.       |
| El calendario de 900 segundos de la complicación en el sistema     | La complicación responde a partir del estado guardado, sin descargar nada.                 |

Todos los caminos terminan igual: obtener, guardar y después volver a dibujar. Y ninguna superficie espera nunca a la red para dibujarse.

### La CI y los tests unitarios

`.github/workflows/ci.yml` se ejecuta en cada push a `main` y en cada pull request. Un solo trabajo, en `ubuntu-latest`:

1. `actions/checkout@v4`.
2. `actions/setup-java@v4` con Temurin, Java 17.
3. `gradle/actions/setup-gradle@v4`.
4. `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain`.

Así que cada cambio tiene que pasar los tests unitarios y compilar un APK de depuración. No hay paso de lint, ni compilación de release, ni tests en dispositivo. El wrapper de Gradle fija Gradle 9.9.2 con un `distributionSha256Sum`, así que el Gradle descargado se comprueba antes de ejecutarse, y `gradle.properties` activa la caché de compilación y la caché de configuración.

Los tests unitarios son JUnit 4 sin más, en la JVM del PC, sin ningún dispositivo Android. Tres archivos, trece tests:

- **`domain/DisplayTest.kt`** (5): "counts the conversations that need you" (cuenta las conversaciones que te necesitan), "says how old the state is" (dice qué antigüedad tiene el estado), "says when a limit resets" (dice cuándo se reinicia un límite), "colors a status as Narsil does" (colorea un estado como lo hace Narsil), "reads a level color, and falls back to dim on noise" (lee un color de nivel y recurre al gris apagado ante el ruido).
- **`data/StatusParserTest.kt`** (4): leer un estado sin sellar, leer un estado antiguo sin `limits` ni `sessions`, un estado sellado que necesita la clave, y un tema vacío o con ruido.
- **`data/SealTest.kt`** (4): abrir un vector sellado por el propio `seal.ts` de narsil-pet, rechazar otra clave, rechazar un mensaje manipulado, rechazar lo que no va sellado.

Pueden ejecutarse sin dispositivo porque la lógica se mantuvo fuera de las clases de Android: `Display.kt`, `NarsilState.kt`, `StatusParser.kt` y `Seal.kt` solo usan Kotlin, kotlinx.serialization y la biblioteca estándar de Java. Las pantallas, el tile, la complicación y el refresco no se prueban automáticamente.

## Constrúyelo con Claude

Pídele a Claude la lista de la app, su configuración y el refresco en segundo plano a la vez, porque comparten el repositorio. Las ideas que debe acertar son que cada refresco termina volviendo a dibujar las otras superficies y que la programación es idempotente.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt del autor.

> En mi app de Wear OS `my-watch` (Compose para Wear OS, Material 3), escribe `presentation/MainActivity.kt`: si no hay ningún tema guardado, muestra una pantalla de configuración con un campo para el tema, un campo opcional para la clave y un botón Guardar activado solo con un tema; si no, una `ScalingLazyColumn` con el dibujo y el nivel, los límites (etiqueta, porcentaje en el color del límite, una barra y una línea de reinicio de una función pura `resetLabel(resetsAt, now)` que diga "reiniciado" una vez pasado), las sesiones en el orden recibido (un punto en el color del estado, título, etiqueta), la antigüedad y los botones Actualizar y Configurar. Refresca cuando aparezca la lista y con el botón, muestra una nota para "todavía no hay estado" y "necesita la clave", y después vuelve a dibujar el tile y la complicación. En `onCreate`, lee los extras de cadena opcionales `topic` y `key` para que `adb shell am start ... --es topic ... --es key ...` los configure, y después pon en cola un refresco. Escribe `sync/Refresh.kt`: un `CoroutineWorker` que refresque y vuelva a dibujar; `schedule` como trabajo periódico único cada 15 minutos con `KEEP` y una restricción de red conectada; `now` como trabajo único de una sola vez con `KEEP`; `redraw` con `TileService.getUpdater` y `ComplicationDataSourceUpdateRequester.requestUpdateAll()`. Llama a `schedule` desde una subclase de `Application`. Tests de JUnit para `resetLabel`, y un workflow de CI que ejecute `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### Qué revisar en la respuesta de Claude

1. La pantalla de configuración aparece solo cuando no hay ningún tema guardado, y la lista se refresca cuando aparece.
2. Cada refresco, en la app y en el worker, termina volviendo a dibujar el tile y la complicación.
3. El trabajo periódico es único por nombre con `KEEP`, y exige una red conectada.
4. El refresco de una sola vez también es único, así que las llamadas repetidas ponen en cola un solo trabajo.
5. `resetLabel` devuelve "reiniciado" para un reinicio pasado y nada para uno que falta, y tiene un test para cada caso.
6. Los extras del intent son opcionales: un arranque normal no cambia nada, y si falta el extra `key` se conserva la clave guardada.
7. Nada escribe el tema ni la clave en un registro.

Si una comprobación falla, dile a Claude lo que ves: "después de tocar Actualizar la app muestra el estado nuevo, pero el tile sigue mostrando el viejo", lo que significa que falta el redibujado en el refresco de la app.

### Cómo lo pidió el autor

No existe ninguna petición registrada para la app ni para el refresco. Esto es una reconstrucción a partir del historial de commits:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil en Wear OS con los límites de Claude y las conversaciones abiertas). La app, el refresco, la clase de la aplicación, el workflow de CI y los tests llegan todos en este único commit. Su mensaje cierra la lista de superficies con "an app listing every open conversation" (una app que lista cada conversación abierta).
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (alinear el README con la familia Narsil). El primer README ya tenía las dos formas de configurar el tema y la clave, bajo "Set up". Este commit la renombra a "Settings", añade una sección Security que dice dónde se guardan el tema y la clave, y la línea sobre cómo actualizar: "pull the latest version of this repository and run the same command again: the settings are kept." (trae la última versión de este repositorio y vuelve a ejecutar el mismo comando: la configuración se conserva).

El comentario encima de `setupFrom` conserva en el propio código el motivo del camino por `adb`: "Setup from the PC, without typing on the watch" (configuración desde el PC, sin escribir en el reloj).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

El refresco y su arranque, escritos para esta guía y adaptados de `sync/Refresh.kt` y `NarsilApplication.kt` en [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa las mismas llamadas de WorkManager, Tiles y complicaciones, y supone tu propio `StatusRepository`, tu servicio de tile y tu servicio de complicación:

```kotlin
package com.example.mywatch.sync

import android.app.Application
import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import com.example.mywatch.complication.MyComplicationService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.tile.MyTileService

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Sync.redraw(applicationContext)
        return Result.success()
    }
}

object Sync {
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("my-sync", ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork("my-sync-now", ExistingWorkPolicy.KEEP, work)
    }

    fun redraw(context: Context) {
        TileService.getUpdater(context).requestUpdate(MyTileService::class.java)
        ComplicationDataSourceUpdateRequester
            .create(context, ComponentName(context, MyComplicationService::class.java))
            .requestUpdateAll()
    }
}

class MyWatchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Sync.schedule(this)
    }
}
```

Nombra la clase de la aplicación en el `<application android:name=...>` del manifiesto, como muestra la [guía 1](/es/watch/what-it-is/). En tu actividad, lee los extras de configuración antes de dibujar, también escrito para esta guía:

```kotlin
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Sync.now(this)
}
```

## Errores comunes y cómo probarlo

- **Refrescar sin volver a dibujar.** La app muestra el estado nuevo y el tile se queda con el viejo. Termina cada refresco con `redraw`.
- **Programar con `REPLACE`.** Cada arranque del proceso cancelaría el trabajo programado y pondría en cola uno nuevo. `KEEP` deja en paz la programación existente, así que arrancar a menudo no cambia nada.
- **Pedir menos de 15 minutos.** El trabajo periódico de WorkManager no se repite más rápido, como dice el comentario del código.
- **Sin restricción de red.** El trabajo se ejecuta sin conexión solo para fallar, y la siguiente oportunidad queda a 15 minutos.
- **Enviar el comando `adb` a una app abierta.** Los extras solo se leen en `onCreate`. Cierra la app primero.
- **Fiarse del porcentaje después de un reinicio.** Si la fila dice `reiniciado`, el porcentaje de encima es de antes del reinicio.
- **Una clave real en un terminal compartido.** Se queda en el historial del shell. Usa la pantalla de configuración, o borra esa línea.
- **Lógica dentro de los composables.** La redacción y los colores de `Display.kt` se prueban en la JVM; dentro de un composable, solo se podrían probar en un dispositivo.

Para ejecutar las mismas comprobaciones que la CI, desde el repositorio:

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

En el reloj:

1. Abre la app sin tema: muestra `Configurar`.
2. Envía el tema desde el PC con el comando `adb shell am start` de arriba, usando tu propio tema en un terminal privado. Abre la app: aparece la lista y se refresca.
3. Ejecuta `/narsil movil prueba` en Claude Code y toca `Actualizar`. La antigüedad dice `ahora`, y el tile y la complicación cambian al instante.
4. Pon una clave equivocada en `Configurar`. Con un estado sellado, la nota dice que el estado va sellado. Vuelve a poner la clave correcta y se abre de nuevo.
5. Para ver el trabajo periódico, conecta el reloj y espera: la antigüedad del tile se reinicia después del siguiente refresco, si el mod ha publicado desde entonces.

### Dónde difieren el código y el README

- El README dice que el reloj lee el estado "every 15 minutes, and whenever you open the app or the tile" (cada 15 minutos, y cada vez que abres la app o el tile). Abrir la app siempre refresca. El tile solo pone en cola un refresco cuando la última comprobación tiene más de 15 minutos.
- La sección Settings del README muestra `--es topic narsil-... --es key ...` juntos. El código trata la clave como opcional: si omites `--es key`, la clave guardada se queda; si la pasas vacía, la clave se quita. El README no lo dice.
- La sección Development del README enumera los comandos de test y de compilación, pero no la CI. El workflow ejecuta exactamente esas dos tareas.

## Para ir más lejos

- Lee `presentation/`, `sync/` y `.github/workflows/ci.yml` en [narsil-watch](https://github.com/davshn/narsil-watch).
- Gestiona también `onNewIntent`, para que la configuración por `adb` funcione con la app abierta.
- Valida el tema en la pantalla de configuración. Los temas del mod son `narsil-` seguido de 20 caracteres hexadecimales, tal como los crea `newTopic` en `hooks/phone.ts` de narsil-pet.
- Añade un test para los extras de configuración con un repositorio falso, o pásalos a una función pura que devuelva lo que hay que guardar.
- El lado del mod del tema y la clave: [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/). Todo el camino desde el principio: [Qué es Narsil Watch](/es/watch/what-it-is/), [Leer el estado de Narsil](/es/watch/reading-the-state/), [El tile](/es/watch/tile/) y [La complicación](/es/watch/complication/).
