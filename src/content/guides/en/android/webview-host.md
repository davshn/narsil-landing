---
title: The WebView host
description: 'How MainActivity hosts claude.ai: WebView settings, the kept session, files and microphone, where links go, and how PageScript and host.js run Narsil at the start of each page.'
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

## What it does

The host is everything the app does so that `claude.ai` runs inside it with Narsil on top. It lives mostly in one file, `MainActivity.kt`, with two helpers: `PageScript.kt`, which builds the script that runs at the start of each page, and `assets/host.js`, the part of that script that plays the role of a browser for Narsil's page scripts.

From the outside, you only notice the results:

- Claude opens at `claude.ai/code`, full screen, between the system bars and above the keyboard.
- You sign in once, and the session survives Android closing the app.
- The **+** button opens the phone's file picker, and dictation can use the microphone.
- `claude.ai` stays in the app. Any other link opens in your browser, and Google's and Apple's sign-ins show a message instead.
- The back button goes back in Claude, and from Claude's first page it sends the app to the background.
- Narsil's colors and band are on every `claude.ai` page from its very first moment.

> **Experimental.** The host runs Narsil's scripts inside a page it does not control. They depend on the structure of `claude.ai` and on its internal requests, not on a public API, so a Claude update can break them. The host is built so that, when that happens, Claude itself keeps working: each script runs on its own, and an error in one is logged and leaves the others running.

## How it works inside

### The WebView's settings

`onCreate` builds the WebView in code, inside a `FrameLayout`, and sets what `claude.ai` needs. This excerpt is from `MainActivity.kt` in narsil-android (MIT):

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

JavaScript and DOM storage are off by default in a WebView, and `claude.ai` is a JavaScript app that keeps state in storage, so both go on. Media can play without a tap. Popups are allowed, but only so the app can catch them (below). Cookies are accepted, third-party ones too; the code does not say which page needs those.

Two more lines matter for the screen. Android 15 draws apps edge to edge, under the status bar, the navigation bar and the keyboard. The activity calls `enableEdgeToEdge()` and then pads its frame by the system bars and the keyboard (`WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()`), so the page sits between them. The manifest also lists every configuration change the app handles itself (`orientation|screenSize|...|uiMode|density`), so rotating the phone does not rebuild the activity and reload Claude.

### Signing in once: flushing the cookie

Your session with `claude.ai` is a cookie. The WebView's `CookieManager` keeps cookies in memory and writes them to disk when it decides to. If Android kills the app before that, the session is lost and you sign in again. So the app writes them itself each time it goes to the background:

```kotlin
    // The session's cookie reaches the disk now, not when Android gets to it: a killed app keeps its sign-in.
    override fun onPause() {
        CookieManager.getInstance().flush()
        web.onPause()
        super.onPause()
    }
```

`onPause` runs whenever the app stops being in front: you switch apps, lock the phone, or open the settings. That is the last moment the app is sure to run before Android may close it. The spec S3 asked for exactly this: "login once and the session stays (cookies flushed to disk)".

### Where each link goes

Every navigation the page asks for reaches `shouldOverrideUrlLoading`, which asks `Links.isInApp` ([guide 1](/en/android/what-it-is/) quotes `Links.kt` whole). Returning `false` lets the WebView load it; returning `true` stops it, and `goOut` decides what happens instead:

- **Google's and Apple's sign-ins** (`accounts.google.com`, `appleid.apple.com`): nothing opens, and a long toast says to sign in with an email.
- **Anything else**: Android's `ACTION_VIEW` with the `BROWSABLE` category, which opens your browser or the app that handles the address. If nothing does, the app logs "Nothing opens" and the address.

Popups need their own path. Google's button opens one, and a WebView with no window to give it drops it, which is why the sign-in used to hang. Now `onCreateWindow` hands the page a throwaway WebView that never shows. Its only job is to hear the first address the popup wants: a `claude.ai` address loads in the main WebView, anything else goes to `goOut`, and the throwaway is destroyed. In the code's words, "The popup's opener sees it closed."

Addresses also come from outside: an alert's tap, or a `claude.ai` link Android hands the app. Both arrive as an `Intent`, at launch or in `onNewIntent`, since the activity is `singleTask` and only one copy of it exists. `claudeIn(intent)` keeps the address only when `Links.isClaude` accepts it, so another app cannot make this one load a page that is not Claude.

### Files and the microphone

When the page asks for a file, the WebView calls `onShowFileChooser`. The app opens Android's document picker (`ActivityResultContracts.OpenMultipleDocuments`) with the types the page accepts, or `*/*` when it names none, and hands the chosen addresses back to the page. A request still waiting is answered with `null` first, so the page never waits for a picker that is gone.

The microphone is the only device the page may use:

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

Two permissions are at play. The page asks the WebView, and the WebView asks the app (`onPermissionRequest`). The app itself needs Android's `RECORD_AUDIO`, which you grant once, the first time. A request from anything but `https://claude.ai`, or for anything but audio, is denied, and even a request for audio and video gets only audio.

### What the app calls itself

Every request a WebView sends carries its user agent, a text that names the engine and, on Android, marks it as a WebView with `; wv`. Some sign-ins and bot checks turn WebViews away by that mark.

The history shows the author tried both ways. The commit `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" removed `; wv` and `Version/4.0` from the user agent, with the comment "As Chrome on Android". Seven minutes later, `38cb33c` undid it: "The user agent is the WebView's own again: the app does not pass itself off as Chrome to get past a sign-in's check." Today the code does not touch `userAgentString` at all, and the README's Security section says: "The app pretends nothing: Claude, Google, and Cloudflare see it as the Android app it is." That is also why Google's sign-in is not forced to work: the honest answer is the email message.

### Looking inside: debug inspection and logcat

A WebView's page can be inspected from a desktop Chrome's DevTools only if the app allows it. The app allows it for debug builds only:

```kotlin
        // A debug build's page can be inspected from a computer, at chrome://inspect.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
```

`./gradlew installDebug` installs a debug build, so with the phone connected by USB, `chrome://inspect` on the computer lists the page. The task log's evidence was gathered this way: "through DevTools the page has narsilHostLoaded, a live narsilWatch, both style marks and the night ground rgb(15, 26, 44)". Remember what this means: whoever has your unlocked phone on a computer with USB debugging allowed can see your Claude page.

The page's console also reaches Android's log: `onConsoleMessage` writes each message to logcat with the tag `NarsilWeb`, with its level, file and line. `adb logcat -s NarsilWeb` shows them, including the `narsil: <file>` errors described below.

### PageScript: one script, in order

The band's scripts were written as extension content scripts, which a browser runs in groups and in a fixed order. A WebView has no such thing: it takes one script per registration. So `PageScript.build` stitches everything into one script, in the order the scripts expect. From `PageScript.kt` in narsil-android (MIT):

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

Read it top to bottom as the page runs it:

1. **A guard.** Leave at once in a frame that is not the top window, if the script already ran in this document, or if the app's channel (`narsilHost`) is missing.
2. **`run`**, a wrapper that catches any error, logs it as `narsil: <file>`, and carries on. Each file runs inside its own function, so one broken file cannot stop the rest.
3. **`NARSIL_CSS`**, both stylesheets joined as one JavaScript string.
4. **`host.js`**, which builds the stylesheet, puts it on the page, and defines `browser` (below).
5. **The first group, at once**: the page observer (`lib/watch.js`) and the light or dark mode (`lib/mode.js`, `mode.js`). These must act before the page paints, which [guide 5](/en/android/colors-and-mode/) explains.
6. **`self.narsilWatch(adopt)`**: on every change the observer sees, put the stylesheet back if the page removed it.
7. **The second group, once the document is parsed**: the band's scripts. If the document is still loading, they wait for `DOMContentLoaded`, close to when an extension's `document_idle` group would run: the page's markup is there to find.

`jsString` turns a file into a JavaScript string literal by escaping backslashes, quotes, line breaks, and the two characters U+2028 and U+2029, which older JavaScript treated as line breaks inside strings. `read` is a function passed in, so the tests can build the script from fake files. `PageScriptTest.kt` checks that every file is present and in order, that the second group waits for the document, that both styles go in as one quoted string, and that the guard is there.

### At document start, only on `claude.ai`, only in the top frame

`MainActivity.host()` registers the script and the channel. From `MainActivity.kt` (MIT):

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

Both calls come from `androidx.webkit` and take the same origin rule, `https://claude.ai`:

- **`addDocumentStartJavaScript`** runs the script in every matching document before any of the page's own scripts, which is what lets the colors win from the first frame.
- **`addWebMessageListener`** puts an object named `narsilHost` into matching frames. The page calls `narsilHost.postMessage(text)`; the app gets the text, the origin, whether it came from the main frame, and a reply proxy to answer on.

The checks are layered. The WebView itself gives neither the script nor `narsilHost` to any other origin. The script's guard leaves any frame that is not the top window. And the listener drops a message that does not come from the main frame of `https://claude.ai`, or that is not JSON. The README sums it up: "The band's scripts and the channel to the app run only on `https://claude.ai`, in the page itself and not in its frames."

When a new page starts loading (`onPageStarted`), the app forgets its reply proxy and stops the state feed, since the old page is gone.

### Serving Narsil's files from `claude.ai/__narsil__/`

The band shows the app's own icon when it has no picture of Narsil. A page cannot load a file from the app's assets directly, and `claude.ai`'s Content Security Policy limits where images may come from. The app uses `WebViewAssetLoader` to answer requests for `https://claude.ai/__narsil__/` from its own assets:

```kotlin
        private val files = WebViewAssetLoader.Builder()
            .setDomain("claude.ai")
            .addPathHandler("/__narsil__/", WebViewAssetLoader.AssetsPathHandler(this@MainActivity))
            .build()
```

The request never reaches the network: `shouldInterceptRequest` answers it with the asset. For the page, the file comes from its own origin, "where the page's own policy lets them load", as the class comment says. Everything else under `claude.ai` passes through untouched.

### `host.js`: a browser for the page scripts

Narsil's page scripts were written for an extension. They call `browser.runtime.getURL`, open a port with `browser.runtime.connect`, send `browser.runtime.sendMessage`, and check `browser.runtime.id` to know whether their extension is still alive. `host.js` gives them a `browser` object with exactly those parts, and answers each one:

| The scripts call               | `host.js` answers                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `runtime.id`                   | Always `'narsil-android'`, so the scripts never think they are orphaned.                                            |
| `runtime.getURL(path)`         | `https://claude.ai/__narsil__/page/` plus the path.                                                                 |
| `runtime.getManifest()`        | Only what the scripts read from it: one group whose styles are `skin.css` and `band.css`.                           |
| `runtime.connect({ name })`    | A port. It sends `connect` to the app; messages from the app arrive on its `onMessage`; `postMessage` sends `port`. |
| `runtime.sendMessage(message)` | For `narsil-missing` (the scripts noticed the styles are gone), it puts the stylesheet back. Always answers `true`. |
| `runtime.onMessage`            | A list of listeners the app never calls; the scripts register on it, and nothing else happens.                      |

The styles go on as a constructed stylesheet: `host.js` creates a `CSSStyleSheet`, fills it with `replaceSync(NARSIL_CSS)`, and adds it to `document.adoptedStyleSheets`. The file's comment gives the reason: constructed style sheets are ones "which the page's CSP does not govern", whereas a `<style>` element added by a script could be refused. The page sometimes replaces its own adopted sheets, so `adopt()` checks and puts Narsil's back on each change the observer sees.

`host.js` adds one thing an extension did not need. The app has no browser menu to reach its settings from, so a tap anywhere on Narsil's picture or level in the side-menu block (`#narsil-band .narsil-head`) sends `{ kind: 'settings' }`. It listens in the capture phase, so the tap is seen before the page can stop it.

### The channel, message by message

All messages are JSON text.

| Direction  | Message                     | What happens                                                                       |
| ---------- | --------------------------- | ---------------------------------------------------------------------------------- |
| Page → app | `{ kind: 'connect', name }` | The app keeps this reply proxy and starts following `<topic>-estado`.              |
| Page → app | `{ kind: 'disconnect' }`    | If it is the current proxy, the app stops following.                               |
| Page → app | `{ kind: 'port', message }` | Only `message.type === 'settings'` does anything: it opens the settings.           |
| Page → app | `{ kind: 'settings' }`      | Opens the settings.                                                                |
| App → page | `{ type: 'model', model }`  | The newest state the band should show ([guide 3](/en/android/conversation-band/)). |
| App → page | `{ type: 'no-topic' }`      | There is no topic yet: the block asks you to tap and write one.                    |

The band also sends `{ type: 'awake' }` on its port every 25 seconds, a habit from the extension, where it kept a sleeping background worker awake. The app ignores it.

### The bridge as a security boundary

A channel between a web page and native code is a door, and the question is always what can come through it. Here, very little:

- **Into the app, the page can do three things**: ask to start following the state, ask to stop, and open the settings screen. Any other message is ignored. No message carries a URL to open, a file to read or a value to store.
- **Out of the app, the page gets only the opened state**: the JSON the mod sent to `-estado`, after decryption. The topic and the key stay in Kotlin. They are part of the address and the decryption that the app does itself, and they are never posted.
- **Any script on the main frame of `claude.ai` can use `narsilHost`**, `claude.ai`'s own code included, since it shares the page with Narsil's scripts. The worst it can do is read the same state the band shows and open the settings.

The opposite direction matters too. What arrives from ntfy.sh could have been written by anyone who knows your topic, so the page scripts treat it as untrusted: text goes in with `textContent`, and a picture only from Narsil's own folder on GitHub.

## Build it with Claude

Ask Claude for a minimal host first: a WebView that runs one script at document start on one origin, with a message channel the script can talk through. Then grow it. The one idea it must get right is that the script and the channel exist only on `https://claude.ai`, only in the top frame, and that the app checks this again on every message.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Android app (Kotlin, `androidx.webkit` 1.18), the main activity shows `https://claude.ai/code` in a WebView. If `WebViewFeature` supports `WEB_MESSAGE_LISTENER` and `DOCUMENT_START_SCRIPT`, register a web message listener named `myHost` and a document-start script, both for the origin rule `https://claude.ai` only. Build the script in a pure Kotlin object from asset files: a guard that returns unless `window.top === window` and `self.myHost` exists and it has not run yet; each file wrapped in its own `try/catch` that logs the file's name; the CSS joined into one escaped string literal. In the listener, drop anything not from the main frame of `https://claude.ai` or not JSON, and act only on a fixed list of `kind` values. Serve `https://claude.ai/__mine__/` from the assets with `WebViewAssetLoader`. Never send any setting to the page. Add JUnit tests for the script builder's order and escaping.

### What to check in Claude's answer

1. Both `addWebMessageListener` and `addDocumentStartJavaScript` receive the same narrow origin set, not `"*"`.
2. The listener checks `isMainFrame` and the origin itself, even though the origin rule already filters.
3. The script's first line returns in iframes and on a second run.
4. Each file runs in its own `try/catch`, so one error does not stop the others.
5. The string escaping handles `\`, `"`, `\n`, `\r`, U+2028 and U+2029, and a test proves it.
6. There is a feature check with a clear log line, and Claude still loads when it fails.

If a check fails, tell Claude what you see: "the script runs twice inside the Cloudflare frame".

### How the author asked for it

The owner's words are recorded in the task log, `odd/tasks/android-app.md`. The first, L1, asked for a web view that "muestre la web de claude y modifique sus estilos como lo hace esta extension" (shows Claude's web and changes its styles the way this extension does). L3 added: "recuerda que los estilos que va a inyectar seran los de la extension […]" (remember that the styles it injects will be the extension's; the name of the earlier project is left out here). The agent's spec S2 turns that into the design of this guide: "the extension's content scripts and CSS run unchanged inside the WebView, with a `browser` shim the app answers natively."

The rest is reconstructed from the commit history (a project name in a subject is replaced by a description in brackets):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep". Its message: "host.js answers the extension's browser calls; the styles go on as a constructed style sheet."
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service". `MainActivity` is born.
- `bfa379a` (2026-11-24) "fix: present the WebView as Chrome, and let a debug build's page be inspected".
- `38cb33c` (2026-11-24) "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging". Popups and the honest user agent.
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification". Its message: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic."
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces". `assets/extension` became `assets/page` and `ExtensionScript` became `PageScript`, following the owner's L4.

## Reference code

This is one correct answer, written for this guide (MIT). Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A minimal host with the same shape as `MainActivity`: one origin, a document-start script, a channel, and a link rule. It reuses `Links` from the app.

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

Declare the activity in the manifest as the launcher, then open the page in `chrome://inspect` (with `WebView.setWebContentsDebuggingEnabled(true)` in a debug build) and look at the `<html>` element: it should carry `data-my-host="hi from the app"`. Load any other site in the same WebView and `self.myHost` is `undefined` there. `startActivity` throws `ActivityNotFoundException` when no app can open an address; the real `goOut` catches it, and yours should too before you ship it.

## Common mistakes and how to test it

- **`"*"` as the origin rule.** The channel and the script would reach every page and every frame the WebView ever loads, ads and sign-in pages included. Name the one origin.
- **Trusting the origin rule alone.** Frames of the same origin also get the object. Check `isMainFrame` in the listener.
- **One `try` around everything.** A single error, say in the band after a Claude update, would also take the colors down. Wrap each file.
- **Forgetting `flush()`.** The session works until Android kills the app in the background, and then you sign in again.
- **Popups ignored.** With `setSupportMultipleWindows(false)`, a sign-in button that opens a popup does nothing at all. Catch it in `onCreateWindow`.
- **Faking the user agent.** It may get past a check today and fail tomorrow, and it hides what the app is. The app gave it up in `38cb33c`.
- **Sending a setting to the page.** Any script on the page could then read it. Keep the topic and the key on the Kotlin side.
- **Granting every permission request.** Grant the microphone only, and only to `claude.ai`.

To test it on the phone, install a debug build, open `chrome://inspect` on the computer, and in the page's console check `self.narsilHostLoaded` (should be `true`), `typeof narsilHost` (`object`), and `document.adoptedStyleSheets.length` (at least one). In an iframe of the page, `self.narsilHostLoaded` should be `undefined`. Then `adb logcat -s NarsilWeb` shows the page's console; a line starting with `narsil:` names a script that threw.

To test the script builder without a phone, run `./gradlew testDebugUnitTest`: `PageScriptTest` builds the script from fake files and checks the order, the waiting group, the quoting and the guard.

### Where the code and the README differ

- The README says "A debug build's page can be inspected from a computer at `chrome://inspect`; its console goes to logcat with the `NarsilWeb` tag." The inspection is limited to debug builds in the code; the console is not: `onConsoleMessage` writes to logcat in any build. Since the only documented install is `installDebug`, the difference shows only if you build a release yourself.

## Going further

- [Guide 3](/en/android/conversation-band/) follows the state from the app's channel into the band above the message box.
- [Guide 5](/en/android/colors-and-mode/) explains why the first script group runs at once and how the colors avoid a flash.
- [Guide 7](/en/android/encryption-and-settings/) covers the settings the bridge opens, and why the topic and the key stay out of the page.
- On the mod's side, [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) describes the `-estado` state the channel carries.
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
