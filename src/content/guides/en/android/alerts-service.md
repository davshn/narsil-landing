---
title: Alerts from a foreground service
description: 'How AlertService keeps one connection to ntfy.sh open, catches up on missed alerts with since, and how Alert and Notifier turn each message into a notification on the right channel.'
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

## What it does

While you write to Claude Code through Remote Control, the Narsil mod posts to your ntfy.sh topic when a conversation finishes, needs you, or fails. The app shows each one as a notification, with Narsil in her current stage and in the alert's pose:

| Alert                  | How it arrives                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| A question or an error | On the **Te necesita** (needs you) channel: it pops up over what you are doing and buzzes its own long pattern. |
| A finished turn        | On the **Terminó** (finished) channel: a short buzz, and it shows quietly in the shade.                         |

- **A tap** opens Claude Code inside the app. Until then, every alert stays in the shade.
- **The alert's links** show as buttons, two at most. `claude.ai` ones open in the app, any other in your browser. The mod sends one, `Abrir Claude` (open Claude).
- **The app can be closed.** A connection to ntfy.sh stays open in a foreground service, with a quiet notification of its own: "Narsil escucha tus avisos" (Narsil is listening for your alerts), and under it `Topic <your topic> · toca para cambiarlo` (tap to change it). A tap on it opens the settings.
- **After a restart** of the phone, or an update of the app, the service starts again on its own.
- **Missed alerts arrive late, not never.** If the phone was off or offline, the alerts sent meanwhile arrive once it is back, as long as ntfy.sh still keeps them (12 hours, the code says).

You no longer need the ntfy app.

> **Experimental.** The app as a whole relies on the structure of the `claude.ai` page and its internal requests, which a Claude update can break. This part does not touch `claude.ai`, but it has fragile points of its own: it depends on ntfy.sh's free public service and on Android letting one app keep a connection open all day. Some phone makers close background apps anyway, and then the alerts arrive late or stop until you open the app.

## How it works inside

### The path of an alert

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

Each step is a small file with one job. `NtfyStream` knows ntfy.sh, `Alert` knows the rules and has no Android code (so `AlertTest.kt` tests it on the computer), and `Notifier` knows Android's notifications.

### A foreground service, and why `specialUse`

Android stops background work it cannot see. To keep a connection open for hours, an app must run a **foreground service**: a service that shows a notification for as long as it runs, so you always know it is there. Since Android 14, each foreground service also declares a type that says what it is for.

The obvious type, `dataSync`, does not fit: the task log's decision records that "Android 15 caps `dataSync` at 6 h a day". The app declares `specialUse` instead, with the reason Android asks for in the manifest:

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

That excerpt is from `AndroidManifest.xml` in narsil-android (MIT). The same decision explains what the app does not use: "no Firebase, no ntfy app needed". Push services like Firebase Cloud Messaging need a server that sends to them; here the only server is ntfy.sh, and the app listens to it directly.

The service itself is short. From `AlertService.kt` (MIT):

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

- **No topic, no service.** It stops itself and asks not to be restarted.
- **The quiet notification first.** `startForeground` must be called soon after the service starts, or Android stops it. The type goes in only on Android 14 (`UPSIDE_DOWN_CAKE`) and later, where types exist.
- **One stream per topic.** The service can be started many times: from the app's launch, from **Guardar y recibir avisos** in the settings, and after a restart. If the topic is the same and a stream runs, nothing changes. If you saved a new topic, the old stream stops and a new one starts.
- **`START_STICKY`** asks Android to start the service again if it ever has to kill it.

The quiet notification lives on its own channel, **Conexión** (connection), at the lowest importance, with no badge, so it sits at the bottom of the shade without sound. Its text includes your topic, which is worth knowing if others see your screen.

### `NtfyStream`: one connection, kept open

ntfy.sh can send a topic as a JSON stream: an HTTP response that never ends, with one JSON object per line ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). Each message line has `"event": "message"`; ntfy.sh also sends `open` and `keepalive` lines. `NtfyStream` reads that stream on a thread of its own. The reading part, from `NtfyStream.kt` (MIT):

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

The numbers have reasons. The class comment says "ntfy.sh sends a keepalive every 45 s, so a read that waits 90 s found a dead connection": a phone that changed networks may keep a socket that will never deliver again, and the 90-second read timeout is how the app notices. A line that is not JSON is skipped. A message that fails to show is logged and does not stop the stream. And after each message, `since` moves to its id.

Around `read()`, `follow()` keeps it going:

- **When the stream ends normally** (ntfy.sh or a proxy closed it), it waits one second and reads again, from `since`.
- **When it fails** (no network, a timeout, an answer other than 200), it waits one second, then two, four, and so on, up to a minute, and resets to one second after a read that worked.
- **`stop()`** clears a flag, disconnects the open connection and interrupts the thread, so it ends at once even in the middle of a wait.

The thread is a daemon thread, so it never keeps the app's process alive on its own; the foreground service does that.

### Catching up with `since`

ntfy.sh keeps the messages of a topic for a while (12 hours, says the comment in `AlertService.kt`), and its `since` parameter asks for the ones after a given message id ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). The app uses it to resume where it left off:

1. After each alert it shows, `AlertService.take` saves the message's id as `lastAlertId` in the settings.
2. When the service starts, after a reboot for example, it opens the stream with `since=<lastAlertId>`.
3. ntfy.sh first sends what it kept after that id, then goes on live.

So an alert sent while the phone was off arrives when it comes back. Three limits follow from the code:

- **The first time there is nothing to resume from.** With no saved id, `since` is `null` and the stream starts "from now on". Alerts sent before your first one are not fetched.
- **A new topic starts over.** Saving a different topic removes `lastAlertId` (the setter does it), so you do not get an id that belongs to another topic.
- **Past 12 hours, they are gone** from ntfy.sh, and so from the app.

There is a quiet safety in the notification's tag. If Android kills the app between showing an alert and saving its id, the alert comes again on the next start, but with the same message id, and so the same tag, so it replaces itself instead of appearing twice.

### `Alert.kt`: the rules

`Alert.of` turns a message, already opened if it was sealed, into what a notification shows. From `Alert.kt` (MIT):

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

| Rule    | What the code does                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Urgent  | ntfy priority 4 or 5. The mod sends 4 for a question or an error, 3 for a finished turn.                                                         |
| Tag     | A finished turn with a `conv-…` tag gets `done-conv-…`, so the next one of that conversation replaces it. Anything else, its own id.             |
| Buttons | Only ntfy `view` actions with an address, at most two, labeled `Abrir` (open) when they have no label.                                           |
| Tap     | The message's `click` address only if it is `claude.ai`; otherwise `https://claude.ai/code`.                                                     |
| Picture | Only an `icon` that starts with `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`.                                              |
| Title   | The message's title, or `Narsil`.                                                                                                                |
| Sealed  | When the key could not open it: "🔒 Aviso cifrado: pon la clave en los ajustes de la app." (encrypted alert: put the key in the app's settings). |

The picture rule has a reason in a comment: "Without a key anyone who knows the topic can publish on it: a picture only comes from Narsil's own assets." The same goes for the tap. Button addresses are not checked beyond being present: one that is not `claude.ai` opens in whatever app handles it, after you tap it.

### What the mod sends

The rules above match what the mod posts. From `hooks/phone.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

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

`PRIORITY` is 3 for `done` and 4 for `question` and `error`. `TAGS` holds one emoji tag per kind (`white_check_mark`, `raising_hand`, `warning`). `phoneIcon` builds the picture's address from Narsil's stage and the alert's pose: the hatchling's pictures sit at the root of `assets/`, each later stage in an `etapaN/` folder, and the pose is `terminado`, `necesita` or `error`, always in the dark variant (`-oscuro.png`). `OPEN_CLAUDE` is the one button, `Abrir Claude`, to `https://claude.ai/code`. The body may end with the list of open conversations and, on the 200th message of the day, `(último aviso de hoy: mañana sigo)` (last alert today: I go on tomorrow). [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) covers when the mod sends.

Notice what the mod does not send: a `conv-` tag or a `click` address. So, with today's mod, every finished turn is its own notification, and every tap opens `claude.ai/code`, where Remote Control lists your conversations.

### `Notifier.kt`: channels and the notification

Since Android 8, every notification belongs to a channel, and the person decides per channel whether it sounds, buzzes or shows. The app creates three. From `Notifier.kt` (MIT):

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

`IMPORTANCE_HIGH` is what makes an alert pop up over what you are doing. The two buzz patterns are the "own way" each buzzes: `NEEDS_BUZZ` is `0, 300, 120, 300, 120, 600` (three pulses, the last long), `DONE_BUZZ` is `0, 200`. Once a channel exists, Android lets you change its sound and vibration in the app's notification settings, and the app's values are only the start.

`show` builds each notification:

- It returns at once if notifications are off for the app (the comment: "the person may have turned notifications off").
- Title and body as given, with `BigTextStyle` so a long body can be expanded. Category `REMINDER` for urgent ones, `STATUS` for the rest, and `setAutoCancel(true)`, so a tap dismisses it.
- **The tap and the buttons** are `PendingIntent`s built by `open`: a `claude.ai` address becomes an explicit intent to `MainActivity`, any other an `ACTION_VIEW` for whatever app handles it. They are immutable (`FLAG_IMMUTABLE`), so no other app can change where they lead.
- **The picture** is downloaded from the `icon` address with 5-second connect and read timeouts, and becomes the large icon. If it does not arrive in time, the notification goes without it. This runs on the stream's thread, which can afford to wait.
- `manager.notify(alert.tag, 0, ...)`: the tag decides replacement. The same tag replaces the earlier notification; a new tag adds one.

Nothing in `show` sets a timeout or makes a notification ongoing, so every alert, urgent or not, stays in the shade until you tap it (`setAutoCancel`) or swipe it away. What sets the urgent ones apart is that their channel makes them pop up over what you are doing and buzz the long pattern.

### The tap, back into the app

When you tap an alert, Android sends the explicit intent to `MainActivity` with the address. The activity is `singleTask`, so if it is already open it receives the address in `onNewIntent` and loads it; otherwise `onCreate` loads it instead of the default page. In both cases `claudeIn` accepts only `claude.ai` addresses ([guide 2](/en/android/webview-host/)).

### `BootReceiver`: after a restart or an update

A restart kills every service. The app listens for two broadcasts, `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED`, and on either it calls `AlertService.start`, which starts the service only if a topic is saved. The second one fires after you run `./gradlew installDebug` again, so an update does not leave you without alerts. The first needs the `RECEIVE_BOOT_COMPLETED` permission, which the manifest asks for.

### The battery: Doze and aggressive phones

Android's Doze mode cuts network access to apps while the phone sleeps, and wakes them only in short windows. A foreground service helps, but the connection can still be cut. The fix is an exemption from battery optimizations, which only you can grant.

The settings screen's second button does it. While the app is not exempt (`PowerManager.isIgnoringBatteryOptimizations` says no), **Permitir en segundo plano** is enabled; a tap opens Android's own dialog (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) for this app. Once granted, the button turns into **Ya funciona en segundo plano** and greys out. The code silences the lint warning `BatteryLife` for this call, which warns that Google Play allows that request only for some kinds of apps; this app is installed from source.

Some phone makers go further and close background apps on their own. The README names Infinix, Xiaomi and Huawei. The task log's tests ran on an Infinix X6730B with Android 15. If the alerts stop arriving, check **Permitir en segundo plano**, then the phone's own battery or app-launch settings for Narsil.

## Build it with Claude

Ask Claude for the service and the rules separately: a pure Kotlin function from an ntfy message to what a notification shows, tested on the computer, and a foreground service that follows one topic and hands each message to it. The one idea it must get right is resuming: the stream must start from the last message shown, and only addresses that cannot harm get the tap and the picture.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Android app (Kotlin, `minSdk 29`, `targetSdk 36`), add a foreground service of type `specialUse` (with `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` in the manifest) that follows `https://ntfy.sh/<topic>/json` on a daemon thread with `HttpURLConnection`, a 15 s connect and 90 s read timeout, one JSON object per line, keeping only `event == "message"`. Resume with `?since=<id>` from the last message shown, saved in `SharedPreferences` after each one, and cleared when the topic changes. Reconnect after one second when the stream ends, and with a doubling wait up to 60 s after a failure. Put the rules in a pure `Alert.of(JSONObject)`: priority 4 or more goes to a high-importance channel, a `conv-` tag on a non-urgent alert becomes the replacement tag, at most two `view` actions become buttons, the tap opens the `click` address only when it is `https://claude.ai`, and a large icon is accepted only from one fixed URL prefix. Start the service again on `BOOT_COMPLETED` and `MY_PACKAGE_REPLACED`. Add a button that asks for the battery-optimization exemption. Test `Alert.of` with JUnit.

### What to check in Claude's answer

1. `startForeground` is called at the start of `onStartCommand`, with the `specialUse` type only on Android 14 and later.
2. The stream resumes from a saved id, and saving a new topic clears that id.
3. A read timeout longer than ntfy.sh's 45-second keepalive detects a dead connection.
4. Failures wait longer each time, up to a cap, and a working read resets the wait.
5. The tap address and the picture are restricted; buttons are capped at two.
6. Each notification is posted with a tag, so a repeated message replaces itself.
7. `PendingIntent`s are `FLAG_IMMUTABLE`.
8. The rules have no Android code, and their tests run with `./gradlew testDebugUnitTest`.

If a check fails, tell Claude what you see: "after the phone was off for an hour, the alerts from that hour never arrived".

### How the author asked for it

The owner's first message, recorded in `odd/tasks/android-app.md` as L1, asked for "una app movil completa, que reciba las notificaciones" (a full mobile app that receives the notifications). The rest of this guide's rules are the agent's, recorded in the spec and the log, not the owner's words. Spec S5 says the alerts "keep the PWA's rules" (the earlier web app's): "sealed messages opened with the key (`narsil1:`), priority >= 4 stays until touched and buzzes its own way, a "done" replaces the previous one of its `conv-` tag, ntfy "view" actions as buttons, a tap opens Claude Code inside the app." The decision on the service type is quoted above.

The log records two checks on the phone. With a throwaway topic: "two done alerts of conv-a left one notification (tag done-conv-a, importance 3) and a priority 4 one its own (importance 4); accents arrive intact; a tap opened MainActivity on claude.ai/code." And with the real topic and key, on 2026-11-24 at 00:44: "The alert showed as an app notification on the urgent channel (importance 4)".

The commits (a project name in a subject is replaced by a description in brackets):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep". `Alert.kt` and its tests.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service". Its message: "alerts follow <topic> from the last one shown, also after a reboot."
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification".
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key".

## Reference code

This is one correct answer, written for this guide (MIT). Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

Two JUnit tests for `Alert.of` with messages shaped like the mod's own, with invented ids and text. Put them next to `AlertTest.kt`:

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

The second test documents today's behavior with the mod: no `conv-` tag, so no replacement. To see the replacement itself, publish two alerts with a `conv-` tag to an invented topic you put in the settings ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Tags: white_check_mark,conv-demo" -d "Primera" https://ntfy.sh/narsil-0000000000example0
curl -H "Tags: white_check_mark,conv-demo" -d "Segunda" https://ntfy.sh/narsil-0000000000example0
curl -H "Priority: 4" -H "Actions: view, Abrir Claude, https://claude.ai/code" -d "¿Sigo?" https://ntfy.sh/narsil-0000000000example0
```

You should see one **Terminó** notification reading "Segunda", and one **Te necesita** that pops up, buzzes three times and has an `Abrir Claude` button.

## Common mistakes and how to test it

- **A `dataSync` service.** On Android 15 it is stopped after six hours a day. Declare the type that fits, with its reason.
- **Starting the stream from now on every restart.** Alerts sent while the phone was off are lost. Resume from the last id.
- **No read timeout.** A connection that died with a network change waits forever. Pick one longer than the keepalive.
- **Retrying at once, forever.** Without a growing wait, a phone with no network spins. Cap it at a minute.
- **Trusting the topic.** Without a key, anyone with its name can post an alert. Restrict the tap, the picture, and the number of buttons.
- **Posting without a tag.** Use the message's own id as the tag, so a message delivered twice replaces itself.
- **Skipping the battery exemption.** Alerts arrive in bursts when the phone wakes, minutes late.
- **Expecting the replacement with today's mod.** The mod sends no `conv-` tag, so finished turns stack.

To test the rules, run `./gradlew testDebugUnitTest`: `AlertTest.kt` checks that a question or an error is urgent, that a done with a `conv-` tag replaces and one without does not, the sealed text, the default title, the two-button cap, the `click` rule (an address on another site falls back to `claude.ai/code`), and the picture rule. To test the service, publish to an invented topic as above, then turn on airplane mode, publish twice, and turn it off: both should arrive within a minute. `adb logcat -s NarsilNtfy` shows the stream's failures and its waits ("ntfy.sh stream failed, again in 4 s").

### Where the code and the README differ

- The README says each finished turn "takes the place of the previous one of the same conversation". The app does replace them when a message carries a `conv-` tag, as the task log's test with `conv-a` showed, but narsil-pet's `phoneMessage` sends no such tag today, only `white_check_mark`, `raising_hand` or `warning`. With the real mod, each finished turn is its own notification.
- The README says alerts missed while the phone was off arrive "once it is back, as ntfy.sh keeps them for 12 hours". True once the app has shown at least one alert from the topic. Before that, and right after a topic change, there is no saved id and the stream starts from the moment it connects.
- The README says a question or an error "stays until you touch it", as if a finished turn did not. In the code, no notification is ongoing or timed: both kinds stay until you tap or swipe them, and the urgent channel adds the pop-up and the long buzz.
- The class comment of `NtfyStream.kt` says it follows the stream "as the band's lib/stream.js follows it". There is no `lib/stream.js` in this repository; the comment refers to the earlier extension.

## Going further

- [Guide 7](/en/android/encryption-and-settings/) opens `Seal.unseal`, the first step of `take`, and explains the settings screen and its buttons.
- [Guide 3](/en/android/conversation-band/) reuses `NtfyStream` for `<topic>-estado`, from `since=12h`.
- On the mod's side, [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) explains when the mod sends, the daily limit of 200, and the topic.
- [Narsil Watch](/en/watch/what-it-is/) shows Narsil's state on a Wear OS watch, from the same `-estado` topic.
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
