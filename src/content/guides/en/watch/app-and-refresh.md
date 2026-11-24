---
title: The app and the refresh
description: 'The watch app with every conversation, both limits and Narsil level; setting the topic and key on the watch or from the computer; the 15-minute WorkManager refresh, the redraws and the CI.'
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

## What it does

The tile and the complication are for a glance. The app, named **Narsil** in the watch's app list, is for when you want the whole picture. It is one scrolling list:

1. **Narsil at the top**, in the pose of your most important conversation, with her name and her level, such as `⭐ Nivel 3 · 40/300 XP` (level 3, 40 of 300 experience points).
2. **A note**, only when something is wrong: no state yet, or a sealed state the watch cannot open.
3. **`Límites de Claude`** (Claude's limits): one row per limit, `5 horas` (5 hours) and `Semana` (week), each with its percent, a colored bar, and when it resets, such as `reinicia en 2 h 05 min` (resets in 2 h 05 min).
4. **`Conversaciones`** (conversations): every open conversation the mod sent, most important first, each with a colored dot, its title and its state, such as `TE NECESITA` (needs you). With none, the header reads `Sin conversaciones` (no conversations).
5. **The age of the reading**, such as `hace 12 min` (12 minutes ago).
6. **Two buttons**: `Actualizar` (refresh), which reads `Leyendo…` (reading) while it works, and `Configurar` (set up).

Behind the screens, a background job asks ntfy.sh for a new state every 15 minutes and redraws the tile and the complication. This guide covers both, and the project's CI and tests.

> **Experimental.** The app shows only what the mod last published, and the mod publishes only while you work away from the computer, within ntfy.sh's free daily room. The background refresh runs at most every 15 minutes, WorkManager's shortest interval. The app is installed as a debug build over `adb`, and the topic and key are set by hand.

## How it works inside

### One activity, written with Compose for Wear OS

`presentation/MainActivity.kt` holds the whole app: one `ComponentActivity` and a handful of composable functions. It uses Compose for Wear OS with Material 3: `AppScaffold`, `ScreenScaffold`, and a `ScalingLazyColumn`, the list that shrinks and fades items near the round screen's edges.

The colors are a Material 3 `ColorScheme` built from `Palette` in `domain/Display.kt`: the dark blue background, the light text, the dim gray, the track and the violet accent. So the app, the tile and the complication share one set of colors.

`onCreate` does three things, in order:

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

That excerpt and the others in this section are from `MainActivity.kt` in narsil-watch (GPL v3). `setupFrom` reads a topic and key sent from the computer, if any (below). Then the screen is drawn.

### Setup first, or the list

`NarsilScreen` keeps its state in a few `remember` values: whether setup is showing, the kept state, the picture, the current note, and whether a refresh is running. The first line decides what you see:

```kotlin
var isSetup by remember { mutableStateOf(!repo.isConfigured) }
```

`isConfigured` is true once a topic is saved. So the first time you open the app it shows **Configurar**, and every later time it shows the list.

A `LaunchedEffect(isSetup)` runs `refresh()` each time the list appears: when you open the app, and right after you save the setup. That is the "refresh on open". It calls the repository directly, in the screen's coroutine scope:

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

What each result means on screen:

- **`Ok`**: no note.
- **`NeedsKey`**: `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (The state is sealed: the key is missing or it is not the one from /narsil movil clave.)
- **`Empty`**: `Aún no hay estado: Narsil lo publica cuando escribes lejos del PC.` (No state yet: Narsil publishes it when you write away from the PC.)

After any result, the screen reloads the kept state and picture, and calls `Refresh.redraw`, so the tile and the complication catch up with what the app just read. [Guide 2](/en/watch/reading-the-state/) explains why a network error gives `Ok` with the kept state: offline is not an error the app shows.

`Empty` can show above a state. If ntfy.sh no longer holds a message (a comment in narsil-pet says it "keeps a message 12 h"), the poll comes back empty, but the watch still has its kept copy. You see both: the old state, and the note that nothing new is there.

### The limits, with "reinicia en"

`LimitRow` draws one limit: the label on the left, the percent on the right in the limit's color (`62 %`), a 6 dp bar with the used part in that color over the track, and, under it, when it resets. The color is `parseColor(limit.color)`, the color the computer sent ([guide 3](/en/watch/tile/)).

The reset text is `resetLabel` from `domain/Display.kt` (GPL v3):

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

- **No reset time** (`null`, Claude did not say): no line at all. The row hides it when the text is empty.
- **Within the hour**: `reinicia en 45 min`.
- **Within the day**: `reinicia en 2 h 05 min`, minutes padded to two digits.
- **Further**: `reinicia en 3 d 4 h`, the shape a weekly limit usually takes.
- **Already past**: `reiniciado` (reset).

That last case is the most useful line in the app. The percent above it comes from the last state, which may be hours old. If the reset time has passed, the window has started over, and the percent shown is no longer true. `reiniciado` tells you so. The test "says when a limit resets" in `DisplayTest.kt` checks all five cases.

### The conversations, with their states

`SessionRow` draws one conversation as a rounded row: an 8 dp dot in the state's color, the title on one line (cut with an ellipsis if long), and the state's label under it, in the same color, in bold. The colors are `statusColor` from `Display.kt`: blue for `TRABAJANDO` (working), gray for `PARADA` (idle), yellow for `TE NECESITA` (needs you), green for `TERMINADA` (done) and red for `ERROR`.

The rows come in the order the mod sent them, which is the mod's ranking: errors first, then what needs you, what works, what finished, and what is idle ([guide 2](/en/watch/reading-the-state/)). At most 8, with titles of at most 40 characters, as `watchSessions` in narsil-pet's `hooks/phone.ts` cuts them. The app adds no order of its own, so it always agrees with the band on your computer.

### Narsil's level

`NarsilHeader` shows the picture (48 by 80 dp), the name **Narsil** in bold, and the state's `xp` text. The picture is the one the repository downloaded from narsil-pet's GitHub, decoded with `BitmapFactory`; if there is none yet, or it does not decode, the bundled `narsil_preview` drawing. The `xp` text is written by the mod, so the level, the experience and the stars are exactly the computer's.

### Configurar: setting it up on the watch

`SetupScreen` has two fields and one button:

- **`El tema de /narsil movil`** (the topic from /narsil movil), with the hint `narsil-…`.
- **`La clave, si usas /narsil movil clave`** (the key, if you use /narsil movil clave), with the hint `opcional` (optional).
- **`Guardar`** (save), enabled only when the topic is not blank.

The fields are Compose `BasicTextField`s, one line each, filled with what is already saved. `Guardar` stores both through the repository, which trims them, and goes back to the list, which refreshes. To remove the key, empty the field and save.

The setup checks nothing else. A topic with a typo saves fine, and the list then says `Aún no hay estado`. One mistake is forgiven, though: the repository adds `-estado` only if the topic does not already end with it ([guide 2](/en/watch/reading-the-state/)), so pasting the state topic by mistake still works.

Typing a 43-character key on a watch keyboard is slow. That is why there is a second way.

### Setting the topic and key from the computer

`setupFrom` reads two extras from the intent that started the activity:

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

So, with the watch connected over wireless `adb` ([guide 1](/en/watch/what-it-is/)), you can send both in one command. With made-up values:

```bash
adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-0000000000example0 --es key example-key-not-real
```

`am start -n` starts the named activity, and each `--es name value` adds a string extra. What the code does with them:

- **No `topic` extra, nothing happens.** The function returns at once, so a normal launch from the app list changes nothing.
- **`topic` without `key`** saves the topic and leaves the saved key as it was.
- **`--es key ""`** saves an empty key, which removes it.
- **Then `Refresh.now`** queues a background refresh, and the tile and complication redraw when it ends.

Because `setupFrom` runs only in `onCreate`, and the activity does not handle new intents, close the app on the watch before you send the command. Otherwise Android may bring the open app to the front without reading the extras.

Two notes on the secrets:

- **Where they end up.** On the watch, in the app's private preferences ([guide 2](/en/watch/reading-the-state/)). On the computer, the command, key included, stays in your shell's history. Clear that line if others use the machine.
- **What they grant and how to rotate them.** The topic lets anyone read and publish to your ntfy topic; the key opens sealed messages. `/narsil movil nuevo` makes a new topic, and `/narsil movil clave` a new key; send the new ones with the same command.

The activity is exported, as every launcher activity must be, so the system can start it. The same is true for any app on the watch: anything that can start activities can start this one with a `topic` extra.

### The refresh: sync/Refresh.kt

Three functions and one worker. From `sync/Refresh.kt` in narsil-watch (GPL v3):

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

Reading it:

- **`RefreshWorker`** fetches the state ([guide 2](/en/watch/reading-the-state/)), then asks the tile and the complication to redraw ([guide 4](/en/watch/complication/) shows `redraw`). It is a `CoroutineWorker`, so `refresh()`, a `suspend` function, runs inside it naturally.
- **It always reports success.** A failed fetch is not retried with WorkManager's backoff; the next period simply tries again. The repository already keeps the last good state, so there is nothing to recover.
- **`online`**: both kinds of work wait for a network connection. Offline, WorkManager holds the job until the watch is connected, rather than running it to fail.
- **`schedule`**: a periodic job every 15 minutes, the shortest repeat WorkManager allows. It is unique by name, `narsil-refresh`, with the policy `KEEP`: if one is already scheduled, the new request is dropped. So calling `schedule` on every start never stacks jobs or resets the timer.
- **`now`**: one refresh as soon as possible, unique as `narsil-refresh-now`, also with `KEEP`. Many calls in a row, such as swiping to the tile several times, queue only one.

### NarsilApplication: where the schedule starts

The whole file, without its package and imports, from `NarsilApplication.kt` (GPL v3):

```kotlin
class NarsilApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Refresh.schedule(this)
    }
}
```

The manifest names it as the application class (`android:name=".NarsilApplication"`). `Application.onCreate` runs every time the app's process starts, for any reason: opening the app, the system binding the tile, or asking the complication for data. So the periodic job is scheduled as soon as any part of the app runs, and, because of `KEEP`, scheduled once.

### What runs when

Putting the pieces together:

| Moment                                                      | What happens                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Any part of the app starts                                  | `NarsilApplication` schedules the 15-minute job, once.                     |
| Every 15 minutes, with a network                            | `RefreshWorker` fetches, keeps, and redraws the tile and complication.     |
| You open the app (topic set)                                | The screen fetches directly, shows the result, and redraws both.           |
| You tap `Actualizar`                                        | The same as opening.                                                       |
| You save under `Configurar`                                 | The list appears and fetches.                                              |
| You send the topic with `adb shell am start`                | `Refresh.now` queues one refresh; the screen also fetches when it appears. |
| The tile is drawn and the last check is over 15 minutes old | `Refresh.now` queues one refresh; the tile draws the kept state meanwhile. |
| The system's 900-second complication schedule               | The complication answers from the kept state, without fetching.            |

Every path ends the same way: fetch, keep, then redraw. And no surface ever waits on the network to draw.

### The CI and the unit tests

`.github/workflows/ci.yml` runs on every push to `main` and every pull request. One job, on `ubuntu-latest`:

1. `actions/checkout@v4`.
2. `actions/setup-java@v4` with Temurin, Java 17.
3. `gradle/actions/setup-gradle@v4`.
4. `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain`.

So every change must pass the unit tests and build a debug APK. There is no lint step, no release build and no device test. The Gradle wrapper pins Gradle 9.9.2 with a `distributionSha256Sum`, so the downloaded Gradle is checked before it runs, and `gradle.properties` turns on the build cache and the configuration cache.

The unit tests are plain JUnit 4, on the computer's JVM, with no Android device. Three files, thirteen tests:

- **`domain/DisplayTest.kt`** (5): "counts the conversations that need you", "says how old the state is", "says when a limit resets", "colors a status as Narsil does", "reads a level color, and falls back to dim on noise".
- **`data/StatusParserTest.kt`** (4): reading a plain state, reading an old state without `limits` or `sessions`, a sealed state that needs the key, and an empty topic or noise.
- **`data/SealTest.kt`** (4): opening a vector sealed by narsil-pet's own `seal.ts`, refusing another key, refusing a tampered message, refusing what is not sealed.

They can run without a device because the logic was kept out of Android classes: `Display.kt`, `NarsilState.kt`, `StatusParser.kt` and `Seal.kt` use only Kotlin, kotlinx.serialization and the Java standard library. The screens, the tile, the complication and the refresh are not tested automatically.

## Build it with Claude

Ask Claude for the app's list, its setup, and the background refresh together, since they share the repository. The ideas it must get right are that every refresh ends by redrawing the other surfaces, and that scheduling is idempotent.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Wear OS app `my-watch` (Compose for Wear OS, Material 3), write `presentation/MainActivity.kt`: if no topic is saved, show a setup screen with a topic field, an optional key field and a Save button enabled only with a topic; otherwise a `ScalingLazyColumn` with the picture and level, the limits (label, percent in the limit's color, a bar, and a reset line from a pure `resetLabel(resetsAt, now)` that says "reiniciado" once past), the sessions in the order received (a dot in the status color, title, label), the age, and Refresh and Setup buttons. Refresh when the list appears and on the button, show a note for "no state yet" and "needs the key", then redraw the tile and complication. In `onCreate`, read optional `topic` and `key` string extras so `adb shell am start ... --es topic ... --es key ...` sets them up, then queue one refresh. Write `sync/Refresh.kt`: a `CoroutineWorker` that refreshes and redraws; `schedule` as unique periodic work every 15 minutes with `KEEP` and a connected-network constraint; `now` as unique one-time work with `KEEP`; `redraw` using `TileService.getUpdater` and `ComplicationDataSourceUpdateRequester.requestUpdateAll()`. Call `schedule` from an `Application` subclass. JUnit tests for `resetLabel`, and a CI workflow running `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### What to check in Claude's answer

1. The setup screen appears only when no topic is saved, and the list refreshes when it appears.
2. Each refresh, in the app and in the worker, ends with a redraw of the tile and the complication.
3. Periodic work is unique by name with `KEEP`, and requires a connected network.
4. The one-time refresh is unique too, so repeated calls queue one job.
5. `resetLabel` returns "reiniciado" for a past reset and nothing for a missing one, and has a test for each case.
6. The intent extras are optional: a normal launch changes nothing, and a missing `key` extra keeps the saved key.
7. Nothing logs the topic or the key.

If a check fails, tell Claude what you see: "after I tap Actualizar the app shows the new state, but the tile still shows the old one", which means the redraw is missing from the app's refresh.

### How the author asked for it

No recorded request exists for the app or the refresh. This is a reconstruction from the commit history:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations". The app, the refresh, the application class, the CI workflow and the tests all arrive in this one commit. Its message ends the list of surfaces with "an app listing every open conversation".
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family". The first README already had both ways to set the topic and key, under "Set up". This commit renames it "Settings", adds a Security section that says where the topic and key are kept, and the line about updating: "pull the latest version of this repository and run the same command again: the settings are kept."

The comment above `setupFrom` keeps the reason for the `adb` path in the code itself: "Setup from the PC, without typing on the watch".

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

The refresh and its start, written for this guide and adapted from `sync/Refresh.kt` and `NarsilApplication.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). It uses the same WorkManager, Tiles and complications calls, and assumes your own `StatusRepository`, tile service and complication service:

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

Name the application class in the manifest's `<application android:name=...>`, as [guide 1](/en/watch/what-it-is/) shows. In your activity, read the setup extras before drawing, also written for this guide:

```kotlin
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Sync.now(this)
}
```

## Common mistakes and how to test it

- **Refreshing without redrawing.** The app shows the new state and the tile keeps the old one. End every refresh with `redraw`.
- **Scheduling with `REPLACE`.** Every process start would cancel the scheduled job and enqueue a new one. `KEEP` leaves the existing schedule alone, so starting often changes nothing.
- **Asking for less than 15 minutes.** WorkManager's periodic work does not repeat faster, as the code's comment says.
- **No network constraint.** The job runs offline only to fail, and the next chance is 15 minutes away.
- **Sending the `adb` command to an open app.** The extras are read only in `onCreate`. Close the app first.
- **Trusting the percent after a reset.** If the row says `reiniciado`, the percent above it is from before the reset.
- **A real key in a shared terminal.** It stays in the shell history. Use the setup screen, or clear that line.
- **Logic inside composables.** Wording and colors in `Display.kt` are tested on the JVM; inside a composable, they could only be tested on a device.

To run the same checks as the CI, from the repository:

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

On the watch:

1. Open the app with no topic: it shows `Configurar`.
2. Send the topic from the computer with the `adb shell am start` command above, using your own topic in a private terminal. Open the app: the list appears and refreshes.
3. Run `/narsil movil prueba` in Claude Code and tap `Actualizar`. The age reads `ahora`, and the tile and complication change at once.
4. Set a wrong key under `Configurar`. With a sealed state, the note says the state is sealed. Put the right key back and it opens again.
5. To see the periodic job, connect the watch and wait: the age on the tile resets after the next refresh, if the mod has published since.

### Where the code and the README differ

- The README says the watch reads the state "every 15 minutes, and whenever you open the app or the tile". Opening the app always refreshes. The tile queues a refresh only when the last check is more than 15 minutes old.
- The README's Settings section shows `--es topic narsil-... --es key ...` together. The code takes the key as optional: leave `--es key` out and the saved key stays; pass it empty and the key is removed. The README does not say this.
- The README's Development section lists the test and build commands but not the CI. The workflow runs exactly those two tasks.

## Going further

- Read `presentation/`, `sync/` and `.github/workflows/ci.yml` in [narsil-watch](https://github.com/davshn/narsil-watch).
- Handle `onNewIntent` too, so the `adb` setup works while the app is open.
- Validate the topic on the setup screen. The mod's topics are `narsil-` followed by 20 hex characters, as `newTopic` in narsil-pet's `hooks/phone.ts` makes them.
- Add a test for the setup extras with a fake repository, or move them into a pure function that returns what to save.
- The mod's side of the topic and the key: [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/). The whole path from the start: [What Narsil Watch is](/en/watch/what-it-is/), [Reading Narsil's state](/en/watch/reading-the-state/), [The tile](/en/watch/tile/) and [The complication](/en/watch/complication/).
