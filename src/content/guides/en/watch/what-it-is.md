---
title: What Narsil Watch is
description: 'The Wear OS app that puts Claude limits and your open Claude Code conversations on your wrist: a tile, a complication and an app, with no server and no Claude token.'
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

## What it does

Narsil Watch is a Wear OS app. It puts two things on your wrist: how much of Claude's usage limits you have spent, and how your open Claude Code conversations are doing. It shows them in three places:

| Surface                         | Where you see it                                                    | What it shows                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| The **Narsil · Claude** tile    | Swipe sideways from the watch face                                  | Two rings, the 5-hour limit outside and the weekly one inside, Narsil in the middle, how many conversations need you, and how old the reading is. |
| The **Claude 5 h** complication | On any watch face that takes one                                    | The 5-hour limit, as an arc or as a short text such as `62%`.                                                                                     |
| The app, named **Narsil**       | From the watch's app list, or a tap on the tile or the complication | Every open conversation with its state, both limits with when they reset, and Narsil's level.                                                     |

The app speaks Spanish, like Narsil herself. The states it shows are hers: `TRABAJANDO` (working), `PARADA` (idle), `TE NECESITA` (needs you), `TERMINADA` (done) and `ERROR`.

It needs **no server** and **no Claude token**. It never talks to Claude. It reads a small state that the Narsil mod on your computer already publishes for your phone, on a private [ntfy.sh](https://ntfy.sh) topic. [Reading Narsil's state](/en/watch/reading-the-state/) explains that state, and [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) explains how the mod sends it.

> **Experimental.** The watch only knows what the mod last published, and the mod publishes only when a turn ends (or a question comes) while you are away from the computer, within ntfy.sh's free daily room. At your desk the watch keeps showing an old reading. It asks for a new one at most every 15 minutes, ntfy.sh keeps a message only for a while, and the app is a debug build you install yourself over `adb`, version `0.1.0`. Any change in the shape of the mod's state can break it.

Narsil Watch is open source under the GPL v3 (or any later version), at [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch). It is not affiliated with Anthropic.

## How it works inside

### One state, three surfaces

The code is small: ten Kotlin files under `app/src/main/kotlin/tech/davshn/narsilwatch/`. The README sums up the folders, and the split is worth copying:

- `domain/`: the state as Narsil publishes it (`NarsilState.kt`) and how the watch words and colors it (`Display.kt`). Pure Kotlin, no Android.
- `data/`: reading the ntfy topic (`StatusRepository.kt`, `StatusParser.kt`), opening the seal (`Seal.kt`), and keeping the last state.
- `tile/`, `complication/`, `presentation/`: the three surfaces.
- `sync/`: the 15-minute refresh with WorkManager, and the redraws.

The three surfaces never ask the network themselves while they draw. They all read the same last state that `StatusRepository` keeps on the watch, through `cached()`. Only the refresh asks ntfy.sh, and when it has something new it tells the tile and the complication to draw again. That is why the tile appears at once, even offline: it never waits for a request.

The comment at the top of `StatusRepository.kt` (GPL v3) says it in one line:

```kotlin
// Where the watch keeps the topic, the key, and the last state it read, so
// the tile and the complication draw at once, offline too.
```

### The data flow

The README draws the whole path in one line:

```text
Claude Code ── Narsil mod ──► ntfy.sh/<topic>-estado ──► Narsil Watch (tile, complication, app)
```

Step by step:

1. **Claude Code runs the Narsil mod** ([narsil-pet](https://github.com/davshn/narsil-pet)) on your computer. It already knows your conversations, their states, Narsil's level and, since release 3.10.0, Claude's 5-hour and weekly limits.
2. **The mod posts a JSON state** to `https://ntfy.sh`, on the topic `<your topic>-estado` ("estado" is "state"). Your topic is the one `/narsil movil` created, a name like `narsil-0000000000example0` (every topic in this path is a made-up example).
3. **ntfy.sh keeps the latest message** for a while. A comment in narsil-pet's `hooks/register.tsx` says it "keeps a message 12 h".
4. **The watch asks ntfy.sh for the latest message** on that topic, opens it with your key if it is sealed, and keeps it.
5. **The tile, the complication and the app** draw from what it kept.

Nothing goes the other way. The README's Security section is clear: "the watch only reads the topic: it never publishes on it."

### When the mod publishes, and what that means for freshness

This is the most important thing to understand about the watch. It is a window on the last message, not a live feed.

The mod's `sendStatus` in `hooks/register.tsx` runs when a turn of the main conversation ends and when a question comes, and `/narsil movil prueba` ("test") sends one too. Each time, `postToPhone` decides whether it actually goes. From its first lines:

```ts
const { phoneTopic, isPhoneOn, phoneKey } = await read($, prefs)
if (!isPhoneOn || !phoneTopic || (!force && !(await isAway($)))) return false
const day = dayOf(await $.clock.now())
const count = countOf(await $.store.get(PHONE_KEY).catch(() => undefined), day)
if (count.sent >= PHONE_DAILY) return false
```

That excerpt is from `hooks/register.tsx` in narsil-pet (GPL v3), with its indentation removed. In words, the state goes only when:

- **`/narsil movil` is on** and a topic exists.
- **You are away.** `isAway` reads where your last message came from. If it came through Remote Control (your phone or the web), you are away; if it came from the terminal or the desktop app, you are at the desk.
- **The day's room is not used up.** `PHONE_DAILY` is 200. The comment in `hooks/phone.ts`: "ntfy.sh takes 250 a day for free: Narsil stops short of it." The day is the UTC day, and the alerts and the states share the same 200.

So, in practice:

- **While you work from the phone**, a new state goes at the end of every turn. The watch picks it up at its next refresh.
- **At the desk**, nothing goes. The watch keeps the last reading it had. That is by design: at the desk you can see the band and the floating window, and sending would spend the daily room for nothing. The tile and the app show how old the reading is (`hace 2 h`, "2 hours ago") so you are never fooled.
- **On a busy day away**, the 200 can run out. After that, nothing new arrives until midnight UTC.
- **If nothing was published for more than about 12 hours**, ntfy.sh may have nothing left to give. The watch still shows what it kept.

The limits age too. A 5-hour figure read at noon says nothing certain about 5 p.m. The app shows when each limit resets ([guide 5](/en/watch/app-and-refresh/)), and the age label tells you how old it all is.

### Why alerts are not part of the app

You might expect a watch app to buzz when Claude needs you. This one does not, on purpose. The README explains: "Alerts (a question, a finished turn, an error) are not part of this app: Narsil for Android or the ntfy app on your phone already mirror them to the watch."

Wear OS already shows the phone's notifications on the watch. The mod already sends its alerts to your ntfy topic. So the alerts reach your wrist through the phone, with either:

- [Narsil for Android](/en/android/what-it-is/), which turns them into native notifications and opens sealed ones with your key, or
- the ntfy app, subscribed to your topic. The mod's own help text says a Wear OS watch "mostrará sus notificaciones si tienes activadas las de ntfy en la app del reloj" (will show its notifications if you have ntfy's turned on in the watch app).

A second alert path from the watch app would mean two buzzes for one event, and a second subscription that keeps the radio busy. The watch app does the one thing the phone cannot mirror: a glanceable summary of everything at once.

### What it reads from the network

From `AndroidManifest.xml`, the app asks for two permissions only, `INTERNET` and `ACCESS_NETWORK_STATE`. It marks itself as a standalone watch app (`com.google.android.wearable.standalone` is `true`), so it does not need a companion app on the phone. It sets `android:allowBackup="false"`, so the topic and key it keeps are not copied into a backup.

It talks to two places only, which the README's Security section lists and the code confirms:

- **`https://ntfy.sh`**, for the state.
- **`https://raw.githubusercontent.com/davshn/narsil-pet/`**, for Narsil's drawings. `StatusRepository` refuses any other address for the picture ([guide 2](/en/watch/reading-the-state/) explains why).

No Claude token and no Claude account reach the watch.

### Installing it over wireless adb

There is no store listing. You build the app on your computer and install it on the watch over Wi-Fi. From the README, you need:

- A watch with **Wear OS 3 or later**, with developer options and **wireless debugging** on.
- On the computer, **JDK 17 or later** and the **Android SDK**, with `ANDROID_HOME` pointing to it.

Pair the watch as its Wireless debugging screen explains, then, in a copy of the repository:

```bash
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

The address here is an example; use the IP and port your watch shows. `installDebug` builds the debug variant and installs it on the connected device. Then add the **Narsil · Claude** tile from the watch's tile editor, and the **Claude 5 h** complication from the watch face editor.

To update, pull the latest version of the repository and run the same command again. The README says the settings are kept.

The first time you open the app, it shows **Configurar** (set up): your topic and, if you use one, your key. You can type them on the watch, or send them from the computer with one `adb` command. [Guide 5](/en/watch/app-and-refresh/) shows both. In Claude Code, `/narsil movil` shows your topic and `/narsil movil clave` creates the key.

### The topic and the key: what they grant and how to change them

Both are secrets, so be precise about them:

- **Where they are stored on the watch.** In the app's private storage (Android `SharedPreferences` named `narsil`, in `MODE_PRIVATE`), as the README says. Not in a backup, since backups are off.
- **What the topic grants.** Anyone who knows its name can read every message on it, alerts and `-estado` alike, and can publish to it. The watch itself only reads.
- **What the key grants.** It opens sealed messages. Without it, a reader of the topic sees noise; with it, the full state.
- **How to rotate them.** `/narsil movil nuevo` ("new") creates a new topic; the old one receives nothing more. `/narsil movil clave` creates a new key each time you run it, and the old one no longer opens what is sent from then on. After either, give the watch the new value under **Configurar**.
- **How to remove them from the watch.** Clear the fields under **Configurar**, or uninstall the app.

The README adds a plain warning: "Without a key, anyone who knows your topic's name can read it. Use `/narsil movil clave` if that matters to you."

### Supported systems

From the README and `app/build.gradle.kts`:

| System         | Supported                                                                               |
| -------------- | --------------------------------------------------------------------------------------- |
| Wear OS        | 3 or later. The build sets `minSdk = 30` ("Wear OS 3 and later") and `targetSdk = 36`.  |
| Narsil mod     | A version that publishes `limits` and `sessions` in its state: release 3.10.0 or later. |
| Tizen, watchOS | Not available. It is an Android app.                                                    |

The build uses Java 17, Kotlin with Compose for the app, Wear's Tiles and ProtoLayout libraries for the tile, the complications data source library, and WorkManager. The versions live in `gradle/libs.versions.toml`.

An older mod still works, partly. `NarsilState` gives `limits` and `sessions` empty defaults, so a state from before 3.10.0 is read without them: the rings stay empty, and the list says `Sin conversaciones` (no conversations).

### Why it is experimental

Every reason comes from the code or the README:

- **It depends on the mod publishing.** No mod, `/narsil movil` off, or an older mod, and the watch has little or nothing to show.
- **Readings come only while you are away.** At your desk the state does not change.
- **ntfy.sh's free daily room.** The mod stops at 200 messages a day, shared with the alerts.
- **A 15-minute refresh.** WorkManager's shortest repeating interval, as the comment in `Refresh.kt` says.
- **A public service in the middle.** ntfy.sh keeps messages for a limited time and is a third party.
- **Sideloading.** It is installed as a debug build over `adb`, version `0.1.0`, with no store and no automatic updates.
- **Tests cover the logic, not the screens.** The unit tests check the parser, the wording and the seal; nothing tests the tile or the complication on a device.

## Build it with Claude

If you want your own watch app like this, ask Claude for the skeleton first: a Wear OS project with an app, a tile service and a complication service, all reading one stored state. The one idea it must get right is that the surfaces read a local copy and never wait on the network.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> Create a Wear OS 3+ app in Kotlin (`minSdk = 30`, Java 17) called `my-watch`, package `com.example.mywatch`. It reads one JSON state from the latest message of an ntfy.sh topic, `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest`, and never publishes. Split it into `domain/` (the state as a `@Serializable` data class and pure display functions), `data/` (a repository that keeps the topic and the last raw answer in private `SharedPreferences`, and a parser), `tile/` (a `TileService`), `complication/` (a `SuspendingComplicationDataSourceService` with `RANGED_VALUE` and `SHORT_TEXT`), `presentation/` (a Compose for Wear OS activity) and `sync/` (a WorkManager job every 15 minutes that refreshes and asks the tile and complication to redraw). The tile and complication only read the stored state. Mark the app standalone, disable backups, and ask only for `INTERNET` and `ACCESS_NETWORK_STATE`. Add JUnit tests for the parser and the display functions, and a GitHub Actions workflow that runs `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### What to check in Claude's answer

1. The tile and the complication read the stored state. Neither makes a network request while it draws.
2. The manifest declares the tile with `BIND_TILE_PROVIDER` and the complication with `BIND_COMPLICATION_PROVIDER`, its `SUPPORTED_TYPES` and an `UPDATE_PERIOD_SECONDS`.
3. The app has `com.google.android.wearable.standalone` set to `true` and `allowBackup` set to `false`.
4. Only `INTERNET` and `ACCESS_NETWORK_STATE` are asked for.
5. The repository keeps the last good answer and does not overwrite it with an empty or unreadable one.
6. The topic never appears in a log.

If a check fails, tell Claude what you see: "the tile stays blank for a few seconds when I swipe to it", which means it is waiting on the network.

### How the author asked for it

No task log or recorded request exists for this app. What follows is a reconstruction from the commit history of both repositories, not the author's words:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch". Its message: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them."
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations". The whole app in one commit. Its message: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose, a 5-hour complication, and an app listing every open conversation. It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed."
- narsil-pet `9437318` (2026-11-23) "chore(release): 3.10.0". The first release whose state the watch can fully read.
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family". The README gains the states table, the Security and Supported systems sections, and Narsil for Android next to the ntfy app as the way alerts reach the watch; the first README named only the ntfy app.

The order tells the story: the mod's side changed first, so the state carried what a watch needs, and then the watch was built to read it. Neither side needed a server.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A minimal manifest for an app of this shape, written for this guide and adapted from `app/src/main/AndroidManifest.xml` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). The class names belong to the example package `com.example.mywatch`:

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

Each line is there for a reason. The `uses-feature` keeps the app to watches. The two permissions are all a read over HTTPS needs. The tile and complication services are exported, because the system binds them, and protected by the binding permissions, so only the system can. `900` seconds matches the 15-minute refresh.

And the commands to build, test and install, from the README, with an example address:

```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

## Common mistakes and how to test it

- **Expecting live data at the desk.** The mod publishes only while you are away. The age label is the honest answer; read it before the numbers.
- **Turning `/narsil movil` off.** It stops the states as well as the alerts. The watch keeps its last reading and grows older.
- **An old mod.** Before 3.10.0 there are no `limits` or `sessions`. The rings stay empty and the list says `Sin conversaciones`.
- **The `-estado` topic in the alerts app.** Subscribe the ntfy app to your plain topic, not to `-estado`. The state topic is data, sent with priority 1, and the mod's comment says it is "not followed by push".
- **Waiting for alerts from the watch app.** They come through the phone. Check that the ntfy app or Narsil for Android shows them on the phone first.
- **No developer options.** On the watch, developer options must be on before wireless debugging appears.

To test the whole path end to end:

1. In Claude Code, run `/narsil movil`, note the topic, and enter it on the watch under **Configurar**.
2. Run `/narsil movil prueba`. It sends a test alert and, when that goes, a state, even from the desk.
3. Open the app on the watch. It refreshes on open. The age should read `ahora` (now).
4. Swipe to the tile. It shows the same reading, with the rings filled if the mod has read Claude's limits.

### Where the code and the README differ

- The README says the watch reads the latest message "every 15 minutes, and whenever you open the app or the tile". The app does refresh every time it opens. The tile, though, asks for a refresh only when the last check is more than 15 minutes old, and draws the kept state first ([guide 3](/en/watch/tile/)).
- The README says Narsil publishes the state "when a turn ends while you are away". The mod's code also publishes it with each question, and with `/narsil movil prueba`, which goes even from the desk.
- narsil-pet's own README still lists five fields for `-estado`. Its code sends seven since 3.10.0, `limits` and `sessions` included ([guide 2](/en/watch/reading-the-state/)).

## Going further

- Read the source at [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch).
- [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) covers the mod's side: the topic, the daily count and the key.
- [Narsil for Android](/en/android/what-it-is/) is the phone app that mirrors the alerts to the watch.
- Next in this path: [Reading Narsil's state](/en/watch/reading-the-state/), how the watch fetches, opens and keeps the state.
- Then [the tile](/en/watch/tile/), [the complication](/en/watch/complication/) and [the app and its refresh](/en/watch/app-and-refresh/).
