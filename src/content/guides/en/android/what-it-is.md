---
title: What Narsil for Android is
description: 'An experimental Android app that hosts claude.ai in a WebView with Narsil colors, band and side-menu block, and turns the mod alerts from ntfy.sh into notifications.'
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

## What it does

Narsil for Android is a phone app that puts two things in one place: Claude's web app, `claude.ai`, and the alerts the [Narsil mod](/en/mods/pet/phone-and-watch/) sends to your phone. You open it like any app. Inside, you see the real `claude.ai`, signed in with your account, so you can approve permissions, answer questions, upload files and read whole conversations as always. On top of it, Narsil adds her own touches:

- **Narsil's colors.** Claude wears the night-sea palette of Narsil Skin, light from 6:00 to 17:59 and dark the rest of the day, whatever appearance you chose in Claude ([guide 5](/en/android/colors-and-mode/)).
- **The band.** Just above the box where you write, a strip shows the open conversation: Narsil in its state's pose, the state (`TRABAJANDO` (working), `TE NECESITA` (needs you), `TERMINADA` (done) or `EN REPOSO` (at rest)), the context used, the cache countdown and the last thing Claude said ([guide 3](/en/android/conversation-band/)).
- **The side-menu block.** Under the search in Claude's side menu: Narsil's level and experience, your 5-hour and weekly limits, and the day's ntfy.sh count ([guide 4](/en/android/sidebar/)).
- **Alerts.** When a conversation finishes, needs you or fails, a notification arrives, even with the app closed and after a restart ([guide 6](/en/android/alerts-service/)).
- **Encryption.** With a key from `/narsil movil clave`, the app opens what the mod sealed ([guide 7](/en/android/encryption-and-settings/)).
- **Sign in once.** The session is kept until Claude ends it or you clear the app's data.
- **Files and voice.** Claude's **+** button opens the phone's file picker, and the microphone works for dictation.

> **Experimental.** The app relies on the structure of the `claude.ai` page and on its internal requests, not on a public API. The band finds the message box and the side menu by the page's markup, the colors replace the page's own design variables, and the limits and conversation data come from addresses the page uses for itself. A Claude update can break any of these; when it does, that part stops showing, and Claude itself keeps working. It is also a personal project, installed from source with a debug build.

The app is open source under the MIT license, and it is not affiliated with Anthropic. Its interface and Narsil's words are in Spanish; this path keeps the labels as they appear, with their English meaning in parentheses.

## How it works inside

### Why an app with a WebView

You cannot add anything to the native Claude app: it runs its own code and offers no way to load yours. On a computer, the usual way to change a web page is a browser extension, but Chrome on Android takes no extensions. The earlier browser extension that drew Narsil in `claude.ai` therefore needed a browser that does, which is one more app to install and keep signed in.

A WebView solves both problems. It is Android's built-in web engine, the same Chromium that powers Chrome, embedded in an app's window. The app that owns the WebView decides what runs in it: here it loads `claude.ai`, runs Narsil's scripts and styles at the start of every page, and answers them from Kotlin. The owner's first message, recorded in the task log, asked exactly that: a full mobile app that receives the notifications and, inside a web view, shows Claude's web and changes its styles the way the extension did.

The scripts that draw the band, the block and the colors are the same ideas the extension had, and much of their code is the same: they still talk to a `browser` object, as extension scripts do. The app gives them one, written in `host.js`, and answers each call natively. [Guide 2](/en/android/webview-host/) explains that host.

### The pieces

All the app's code is in one Gradle module, `app`, with the package `io.github.davshn.narsil`:

| File                                                          | What it does                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `MainActivity.kt`                                             | The WebView: settings, cookies, files, microphone, popups, and where each link goes.             |
| `PageScript.kt` and `assets/host.js`                          | Builds the one script that runs at the start of each `claude.ai` page, and the page's "browser". |
| `assets/page/`                                                | Narsil's colors (`skin.css`, `mode.js`) and the band (`content.js`, `band.css`, `lib/`).         |
| `StateFeed.kt` and `StateModel.kt`                            | Follow `<your topic>-estado` for the band, and keep the newest state.                            |
| `AlertService.kt`, `NtfyStream.kt`, `Alert.kt`, `Notifier.kt` | Follow your topic in the background and turn each message into a notification.                   |
| `BootReceiver.kt`                                             | Starts the alerts again after a restart or an update.                                            |
| `Seal.kt`                                                     | Opens what the mod sealed with `/narsil movil clave`.                                            |
| `Settings.kt` and `SettingsActivity.kt`                       | The topic, the key and what the app remembers, in private storage.                               |
| `Links.kt`                                                    | Which addresses stay in the app.                                                                 |

There is no server of its own, no Firebase and no analytics: the module depends on three AndroidX libraries (`core-ktx`, `webkit` and `activity`), and on JUnit and `org.json` for the tests.

### What it needs from the Narsil mod

The app reads two topics on [ntfy.sh](https://ntfy.sh), both created by the Narsil mod in Claude Code on your computer:

- **Your topic**, such as `narsil-0000000000example0`, where the mod posts an alert when a conversation finishes, needs you or fails.
- **`<your topic>-estado`** ("state"), where the mod posts a silent state as a turn ends and with each question: Narsil's level, her picture at her stage, how long a cache lasts and ntfy.sh's count of the day's messages.

The mod sends both only while you write to Claude through Remote Control, that is, from the phone or the web. As soon as you write at the desk again, it stops. It also caps itself at 200 messages a day, under ntfy.sh's free room. [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) explains the mod's side in full.

Without the mod, the app still works as Claude in Narsil's colors, and the band still shows each conversation's state, context, cache and last event, and the block your limits: those come from `claude.ai` itself. What you lose is what only your computer knows: the alerts, Narsil's level, her stage in the pictures (the app's own icon stands in), the ntfy.sh count, and the real cache length (the band assumes 60 minutes).

### Supported systems

| What                   | Needed                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Android                | 10 or later (`minSdk = 29`); built for Android 16 (`targetSdk = 36`)                       |
| Android System WebView | One that can run scripts at the start of a page and talk to the app; any recent one        |
| Sign-in                | Your Claude account's email; Google's and Apple's buttons do not work here                 |
| iPhone                 | Not available                                                                              |
| To build it            | A computer with JDK 17 or later and the Android SDK (`ANDROID_HOME`); Gradle comes with it |

The WebView check is in code. `MainActivity` asks `WebViewFeature` for two features, `WEB_MESSAGE_LISTENER` and `DOCUMENT_START_SCRIPT`. If either is missing, it logs "This WebView cannot run the band: update Android System WebView" and loads Claude without Narsil. The fix is to update Android System WebView from Google Play.

### Installation

There is no store listing: you build the app from its repository and install it over USB.

1. On the phone, turn on developer options and **USB debugging**, then connect it to the computer.
2. On the computer, clone [narsil-android](https://github.com/davshn/narsil-android) and, in its folder, run:

```bash
./gradlew installDebug
```

Gradle downloads itself (the wrapper is pinned to Gradle 9.9.2), builds a debug APK and installs it. To update later, pull the repository and run the same command again: Android replaces the app in place and keeps its data, so the session and the settings stay.

A debug build has one property you should know about: its page can be inspected from a computer at `chrome://inspect`, as [guide 2](/en/android/webview-host/) explains. That is handy for learning and for fixing things, and it is also a reason to keep USB debugging off when you do not need it.

### Signing in: with your email

Open **Narsil** and sign in **with your email**: the one of your Claude account, even if you created the account with Google. Claude sends you a code or a link, and you are in.

Google's and Apple's sign-in buttons do not work inside an app's WebView. Both providers refuse to run there, and opening them in the phone's browser would not help: as `Links.kt` puts it, "in the phone's browser they would sign the browser in, not the app". So when the page tries to go to `accounts.google.com` or `appleid.apple.com`, the app goes nowhere and shows a message instead:

> "Google y Apple no dejan iniciar sesión dentro de una app como esta. Escribe tu correo (el mismo de tu cuenta) y entra con el código o el enlace que te llega."

(Google and Apple do not allow signing in inside an app like this one. Write your email, the same as your account's, and enter with the code or the link you get.)

This came from a real failure. Before the commit `38cb33c`, Google's button opened a popup that the WebView dropped, and the sign-in just hung.

If the sign-in link arrives by email, it opens in your browser by default. To have `claude.ai` links open in the app, go to Android's **Settings → Apps → Narsil → Open by default → Add link** and turn on `claude.ai`. The manifest explains why this is manual: Android "cannot verify a domain that is not ours".

### First setup

1. In Claude Code on your computer, run `/narsil movil`. It turns the alerts on and answers with your topic.
2. If you want the alerts encrypted, run `/narsil movil clave` ("key") too. It answers with a new key.
3. In the app, open the settings: tap Narsil in the side-menu block (or the notice `Toca y escribe tu topic` (tap and write your topic)), or long-press the app's icon and choose **Ajustes** (settings).
4. Write the topic and, if you made one, the key, and tap **Guardar y recibir avisos** (save and receive alerts). Allow notifications when Android asks.
5. Tap **Permitir en segundo plano** (allow in the background). Without it, Android cuts the connection while the phone sleeps and the alerts arrive late. Once allowed, the button reads **Ya funciona en segundo plano** (already runs in the background).

Back in Claude, the band shows Narsil once the mod has sent a state. To check the whole chain at once, run `/narsil movil prueba` ("test") on the computer: it sends a test alert and a state, wherever you are writing from.

The mod's own answers were written before this app existed. `/narsil movil` still tells you to install the ntfy app, and `/narsil movil clave` to put the key in "las opciones de la extensión de Firefox" (the Firefox extension's options). With this app, you need neither: the key goes in the app's settings.

### The privacy model

The app talks to four places, each for one reason:

| Who                             | Talks to                                    | Why                                                                                         |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| The WebView                     | `claude.ai` and `challenges.cloudflare.com` | Claude itself, and the Cloudflare check that may come before it. Nothing else opens inside. |
| The band's scripts, in the page | `claude.ai`                                 | The same `GET` requests the page makes, with your session: conversations and limits.        |
| The page and the notifications  | `raw.githubusercontent.com`                 | Narsil's pictures, only from narsil-pet's own `assets/` folder.                             |
| The app's Kotlin code           | `ntfy.sh`                                   | Your topic for the alerts, and `<your topic>-estado` for the band.                          |

Three rules follow from the code:

- **The topic and the key never reach the page.** They live in the app's private storage, and only Kotlin reads ntfy.sh. The page gets the opened state, nothing more. `host.js` says it plainly: "the topic and the key never reach the page".
- **ntfy.sh is a public service.** Without a key, anyone who knows your topic can read it and publish on it, and ntfy.sh sees everything. With a key, they see that a message went and a few details, not its text. [Guide 7](/en/android/encryption-and-settings/) goes through what is and is not hidden.
- **Nothing from ntfy.sh is trusted as markup.** It goes into the page and the notifications as text, and a picture is accepted only from Narsil's own folder.

The app also sets `android:allowBackup="false"`, so its data, session included, does not travel to Android's backups.

## Build it with Claude

Ask Claude for the skeleton first: a Gradle project with one activity that shows `claude.ai` in a WebView, decides where each link goes, and has a settings screen for a topic. The one idea it must get right is the boundary: `claude.ai` and nothing else opens inside the app, and the secrets stay in Kotlin, never in the page.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> Create an Android app in Kotlin (Gradle Kotlin DSL, `minSdk 29`, JDK 17, no Compose) whose main activity shows `https://claude.ai/code` in a full-screen WebView with JavaScript and DOM storage on. Keep only `https://claude.ai` and `https://challenges.cloudflare.com` inside the WebView; open any other `https` address in the phone's browser with `ACTION_VIEW`. When the page goes to `accounts.google.com` or `appleid.apple.com`, open nothing and show a toast saying to sign in with an email. Handle popups in `onCreateWindow` with a throwaway WebView that only reads the address it wants. Flush cookies in `onPause`. Add a settings activity with a topic field validated as `^[-_A-Za-z0-9]{1,64}$`, saved in private `SharedPreferences`, and a launcher shortcut to it. Put the link rules in a pure Kotlin object with JUnit tests, including `http://claude.ai`, `https://claude.ai.evil.example/` and a string that is not a URL.

### What to check in Claude's answer

1. Hosts are compared exactly after parsing the address, and only for `https`: `https://claude.ai.evil.example/` and `http://claude.ai` must not count as Claude.
2. Google's and Apple's sign-in addresses open nothing; they show a message.
3. Popups do not open a second visible window: their first address goes where any link goes.
4. `CookieManager.getInstance().flush()` is called in `onPause`, so the session survives Android killing the app.
5. The topic is validated before it is saved, and nothing secret is written into the page or the code.

If a check fails, tell Claude what you see: "Google's button does nothing and the screen stays white".

### How the author asked for it

This one is recorded. The task log of narsil-android, `odd/tasks/android-app.md`, quotes the owner's messages in its log entries L1 to L3.

The idea, on 2026-11-23 (L1):

> "se me ocurrio crear una app movil completa, que reciba las notificaciones y que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension, eso es viable?"

In English: it occurred to me to create a full mobile app that receives the notifications and, inside a web view, shows Claude's web and changes its styles the way this extension does; is that viable?

The scope, on 2026-11-24 (L2):

> "seria para reemplazar la pwa, la friccion que me dices para iniciar sesion seria igual solo una vez, no? ... (igual seria para mi uso personal)"

In English: it would be to replace the PWA (the earlier web app for the alerts); the sign-in friction you mention would be only once anyway, right? (It would be for my personal use anyway.) And in the same entry: "hazlo en un proyecto nuevo y probemos a ver que tal, el repositorio seria publico, te dejo conectado el celular para que la instales" (do it in a new project and let's try it; the repository would be public; I am leaving the phone connected so you can install it).

From L3: "no olvides ir haciendo commits al repositorio a medida que vas trabajando el repo se va a llamar narsil-android" (do not forget to commit to the repository as you work; the repo will be called narsil-android).

The spec turns these into rules: S3 "login once and the session stays (cookies flushed to disk)", and S4 "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings". The log's last entry, L4, records the owner's decision to retire the earlier extension and web app in favor of this app ("[…] los voy a deprecar en favor de esta app"), which is why the band's scripts became the app's own.

The commits, all on 2026-11-24, show the order of the build (a project name in a subject is replaced here by a description in brackets):

- `9051a31` "feat: open what the mod seals, as [the earlier extension]'s seal.js does"
- `3bcea35` "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep"
- `53c55c1` "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service"
- `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected"
- `38cb33c` "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging"
- `9e514dd` "feat: open the settings from Narsil in the band and from the service's notification"
- `5ad4577` "refactor: make the band's scripts the app's own, and stop naming the projects it replaces"

## Reference code

This is the whole of `Links.kt`, from `app/src/main/java/io/github/davshn/narsil/` in [narsil-android](https://github.com/davshn/narsil-android) (MIT). It is short, and every navigation in the app passes through it: the WebView's links, its popups, the addresses an alert carries, and the addresses Android hands the app.

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

Three details make it safe. `hostOf` returns `null` unless the scheme is `https`, so an `http` address is never Claude. It compares the parsed host exactly, so `claude.ai.evil.example` is not `claude.ai`. And a string that does not parse throws inside `URI`, which the `try` turns into `null`. `LinksTest.kt` checks all three.

A small test of your own, written for this guide (MIT), in the same style as the app's:

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

The second assertion passes because `hostOf` lowercases the host. The last one holds because an address without a scheme has no `https` scheme, so it has no host for the app.

## Common mistakes and how to test it

- **Tapping Continue with Google.** It cannot work here. Use the email of your account, even if you made it with Google.
- **No background permission.** Without **Permitir en segundo plano**, the alerts can arrive many minutes late while the phone sleeps. Some phones (the README names Infinix, Xiaomi and Huawei) also need their own battery saver to let Narsil run.
- **Expecting alerts at the desk.** The mod sends nothing while your last message came from the terminal or the desktop app. Write to Claude through Remote Control, or use `/narsil movil prueba`.
- **A topic copied with a space or a typo.** The settings refuse anything but letters, digits, `-` and `_` with "Ese topic no es válido" (that topic is not valid). A topic that is valid but wrong just stays silent: compare it with the answer of `/narsil movil`.
- **Installing from a second computer.** A debug build is signed with the computer's own debug key, and Android refuses an update signed with another key. Uninstalling to get around it clears the session and the settings.
- **An old Android System WebView.** Claude loads, but without the colors or the band. Update it from Google Play.

To test the app's logic, run its JVM tests on the computer:

```bash
./gradlew testDebugUnitTest
```

They cover the link rules, the script that loads the band, the alert rules, the state the band keeps, and the encryption against a message sealed the way the mod seals it. To test the whole chain without touching your real topic, put an invented one such as `narsil-0000000000example0` in the settings and publish to it from the computer ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Title: Narsil prueba" -d "Hola desde el ordenador" https://ntfy.sh/narsil-0000000000example0
```

A notification should arrive within a second or two. Then write your real topic back.

### Where the code and the README differ

- The README lists no way to stop the alerts in the app, and the code has none: `AlertService.stop` exists but nothing calls it, and the settings refuse an empty topic. To stop them, run `/narsil movil off` on the computer, or turn off the app's notifications in Android's settings.
- The README says you no longer need the ntfy app. That is true of the app; the mod's `/narsil movil` answer still tells you to install it (see First setup).

## Going further

- [Guide 2](/en/android/webview-host/) opens the WebView host: how the scripts are put together and how the page talks to the app.
- [Guide 6](/en/android/alerts-service/) follows an alert from ntfy.sh to the notification shade.
- [Guide 7](/en/android/encryption-and-settings/) explains the key, the settings, and what a reader of your topic can still see.
- The mod's side is in [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/). The same `-estado` state also feeds [Narsil Watch](/en/watch/what-it-is/).
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
