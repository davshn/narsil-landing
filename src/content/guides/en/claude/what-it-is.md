---
title: What Narsil in Claude is
description: 'The browser extension that brings Narsil into claude.ai on Android: what it shows, why it is experimental, which browsers run it, its options and how it is built.'
route: claude
order: 1
updated: 2026-11-18
---

## What it does

Narsil in Claude ("Narsil en Claude" in its own name) is a browser extension for Firefox and Vivaldi on Android. It brings Narsil into `claude.ai`, so you can see how your conversations are doing without leaving the page where you talk to Claude. It adds four things:

- **A band above the message box**, in every conversation on `claude.ai/code`: Narsil in the pose of the conversation's state, the state itself (`TRABAJANDO`, `TE NECESITA`, `TERMINADA` or `EN REPOSO`), the context used, the cache countdown and the last thing Claude said. [Guide 2](/en/mods/claude/conversation-band/) covers it.
- **A block in the side menu**, under Search: Narsil's level and experience, the 5-hour and weekly usage limits, and the day's ntfy count. [Guide 3](/en/mods/claude/sidebar/) covers it.
- **Narsil's colors** on the whole page, light by day and dark by night, from the night sea palette of [Narsil Skin](https://github.com/davshn/narsil-skin). [Guide 4](/en/mods/claude/colors-and-icon/) covers it.
- **Narsil's icon**, when you add `claude.ai` to the home screen with the extension active. Also in [guide 4](/en/mods/claude/colors-and-icon/).

The extension works on top of the real Claude web app. Nothing is replaced: you still read the whole conversation, approve permissions and answer Claude's questions as always. The extension only adds what it draws around them.

> **Experimental.** The extension relies on the structure of the `claude.ai` page and on internal addresses the page itself uses, not on a public API. A Claude update can break it at any time. When that happens, the band or the block simply stop showing; they cover nothing. It only reads: it never writes to your account or sends your conversations anywhere, though the extension loads Narsil’s pictures from GitHub and reads its status topic from ntfy.sh. Its code is not public, so this path explains how it is built and gives small examples of your own.

The extension is part of the Narsil family. The level and the ntfy count come from [Narsil for Claude Code](https://github.com/davshn/narsil-pet), the mod on your computer; everything else works without it.

## How it works inside

### Why an extension, and why on Android

Claude Code on your computer already shows Narsil in its band and floating window. When you drive a conversation from the phone through Remote Control, you are on `claude.ai/code` in a mobile browser, and Narsil is out of sight. The Claude app for Android cannot be extended, but a page in a browser can: a browser extension runs its own scripts inside the page you open.

So the extension is the only way to put Narsil on the same screen as the conversation, and the reason it supports only two mobile browsers:

| Browser                | Band and block      | Colors     | Icon       |
| ---------------------- | ------------------- | ---------- | ---------- |
| Vivaldi for Android    | Yes                 | Yes        | Not tested |
| Firefox for Android    | Yes                 | Yes        | Yes        |
| Firefox on the desktop | Not tested          | Not tested | Not needed |
| Chrome for Android     | Takes no extensions | No         | No         |
| The native Claude app  | No                  | No         | No         |

It needs **Firefox 142 or later** or **Vivaldi 8.2 or later**. Firefox's minimum comes from the manifest (`strict_min_version` set to `142.0`, for both Firefox and Firefox for Android); Vivaldi's from the README, which says Vivaldi on Android loads Chrome extensions from a folder since 8.2.

### The parts of the extension

The extension is plain JavaScript, with no build step and no libraries. Its folder holds:

- **`manifest.json`**, the description every browser extension starts from ([MDN: manifest.json](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)). It is a Manifest V2 file for Firefox. It asks for two permissions only: `storage`, for the options, and `https://ntfy.sh/*`, to read the mod's status. It also declares `data_collection_permissions` as `none`, Firefox's way for an extension to say it collects no data.
- **Two groups of content scripts**, both matching `https://claude.ai/*` ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). The first runs at `document_start`, before the page draws, with the colors (`skin.css`, `mode.js`) and the icon (`app-icon.js`). The second runs at `document_idle`, once the page has loaded, with the band and the block (`content.js` and `band.css`).
- **A background script**, `background.js`. It is the only part that talks to ntfy.sh. In Firefox it is a background page; in the Chromium package for Vivaldi, a service worker loads the same files.
- **The options page**, `options.html` and `options.js`, where you write your topic and key.
- **Small modules in `lib/`**, each loaded where it is needed: `live.js` (what the band and the limits make of `claude.ai`'s data), `state.js` (what is kept and shown of the mod's status), `seal.js` (opening sealed messages), `stream.js` (following ntfy.sh's stream), `watch.js` (the one page observer), `mode.js` (which mode each hour gets), `manifest.js` (the home screen icon), `restore.js` (putting styles and scripts back in Vivaldi) and `browser.js` (lets the code say `browser` in Chromium too).

The split follows one rule: **the page sees nothing secret**. The content scripts run inside `claude.ai` and draw; the background script holds the topic and the key, reads ntfy.sh, and sends the page only the status it already opened. The code says it plainly: the topic and the key "never reach the page".

### The options: your topic and your key

The options page has two fields and a Save button:

- **Topic**, the one `/narsil movil` gives you in Claude Code ([Alerts on your phone and watch](/en/mods/pet/phone-and-watch/) explains how the mod creates it). The page accepts only letters, numbers, `-` and `_`, up to 64 characters, and refuses anything else.
- **Key**, only if you created one with `/narsil movil clave`. It is a password field.

Both are saved with `storage.local` ([MDN: storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)), the extension's own storage on the phone. They never go into the package that is signed, and never into the page. When either changes, the background script notices (`storage.onChanged`) and starts reading again with the new values.

If the block in the side menu shows `Toca y escribe tu topic` ("tap and write your topic") or `🔒 Toca y pon la clave` ("tap and enter the key"), a tap on it opens the options page.

### What it needs from the mod, and what works without it

| Part                           | Needs narsil-pet? | Where it comes from                |
| ------------------------------ | ----------------- | ---------------------------------- |
| The band above the message box | No                | `claude.ai` itself                 |
| The 5-hour and weekly limits   | No                | `claude.ai` itself                 |
| The colors and the icon        | No                | The extension                      |
| Narsil's level and experience  | Yes               | The mod's status topic on ntfy.sh  |
| The day's ntfy count           | Yes               | The mod's status topic on ntfy.sh  |
| Narsil's stage in the pictures | Yes               | The picture the mod's status names |

For the rows that need the mod, `/narsil movil` must be on. Without it, the block in the side menu shows only the limits, and the band shows the extension's own icon where Narsil's picture at her stage would be.

### What goes over the network

The extension only reads. Every request it makes, from its code:

- **To `claude.ai`**, with your session, as the page itself does: the list of your active and paused conversations, the last events of the one you have open, and your account's usage. Only `GET` requests. Nothing is written to your account.
- **To ntfy.sh**, from the background script: it reads the mod's status topic (your topic with `-estado` at the end). Reading a topic needs its name in the address, so ntfy.sh sees the topic and your phone's network. Nothing is published.
- **To GitHub**, for Narsil's pictures: the band and the block show her art from the narsil-pet repository, so the phone downloads those images. The file name says her pose and stage, such as the working or the waiting pose.
- **The home screen icon** points at the icons of the author's phone web app, which the browser downloads only when you add `claude.ai` to the home screen.

None of these sends what the page shows (your conversations, your usage, your topic or key) anywhere else.

### Installing it

The code is not public, so these are the steps the author follows, and the steps that apply to an extension you build yourself. [Guide 5](/en/mods/claude/android-packaging/) explains the packaging in detail.

**In Vivaldi**, the extension loads from a folder on the phone, with no signature:

1. Build the Chromium package (Manifest V3) from the Firefox extension and copy it to the phone's `Download` folder over USB.
2. In Vivaldi, open `vivaldi://extensions` and turn on **Developer mode**.
3. Tap **Load unpacked**, choose the folder, then **Use this folder** and **Allow**.
4. Open the extension's options and write your topic, and the key if you have one.
5. Open `claude.ai` and reload it.

**In Firefox**, an extension must be signed by Mozilla. The signature is _unlisted_: it does not publish the extension on the add-on store.

1. Create API credentials on [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) and sign the extension with Mozilla's `web-ext sign --channel=unlisted` ([Extension Workshop: web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)). The result is an `.xpi` file.
2. Copy the `.xpi` to the phone.
3. In Firefox, open **Settings → About Firefox** and tap the logo five times to show the hidden menu.
4. Back in **Settings**, use the option to install an extension from a file.
5. Open the extension's settings and write your topic, and the key if you have one.

### Uninstalling it

In Firefox, open the menu, go to **Extensions**, choose **Narsil en Claude** and remove it. In Vivaldi, remove it from `vivaldi://extensions`. Claude goes back to its own colors. The home screen icon stays until you install the app again, because the browser fixes it at install time.

To stop the level and the count without removing anything, clear the topic in the options. To stop the mod from sending the status at all, run `/narsil movil off` on your computer.

## How it was asked of the AI

### Recorded: about this path, not about the extension

The extension's own requests to the AI were not recorded. What is recorded is how the author asked for it to appear on this site. In phase 2 of the site's task log:

> "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien"

In English: also add the information about narsil-claude; mark it as experimental, although I have tested it a lot and it works quite well.

And for this path, on 2026-11-18:

> "hay otra cosa, no metimos la guia de narsul claude en celular, pusimos que era experimental pero que explicariamos como hacerlo, falta esa guia, el repositorio es narsil-claude"

In English: there is one more thing, we did not add the guide for narsil claude on the phone; we said it was experimental but that we would explain how to make it; that guide is missing; the repository is narsil-claude. The author asked for a "Ruta corta", a short path, which is this one.

### Reconstruction from the commit history

The rest is reconstructed from the extension's commit history; the requests themselves were not kept. The first day built most of it:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android". Its message explains the goal: "so the state is on the same screen as Claude", reading ntfy.sh from the background page, with the topic and key in the extension's storage.
- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night".
- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla".
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox".
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt".
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar".
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package".

The order shows a design that narrowed: it began as one panel in the side menu fed by ntfy.sh, and ended split in two, with ntfy.sh used only for what the page cannot know.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> Build a Firefox extension (Manifest V2, plain JavaScript, no build step) for Firefox for Android that adds a small status band to `https://claude.ai/*`. Use two content script groups: one at `document_start` for styles, one at `document_idle` that draws the band. Add an options page (`options_ui`) with a "topic" field, validated as `[-_A-Za-z0-9]{1,64}`, saved with `browser.storage.local`. Only the background script may read the topic and talk to `https://ntfy.sh`; the content script receives the status over `runtime.connect` and never sees the topic. Ask for no permission beyond `storage` and `https://ntfy.sh/*`. Insert every piece of text with `textContent`, never as HTML. Use only APIs documented on MDN, and list each one you used with its MDN page.

## The minimal code

A skeleton of the same shape, written for this guide (MIT). It is a Manifest V2 extension for Firefox with one content script, a background script and an options page; [guides 2](/en/mods/claude/conversation-band/) and [3](/en/mods/claude/sidebar/) fill them in.

`manifest.json`:

```json
{
  "manifest_version": 2,
  "name": "My band on claude.ai",
  "version": "0.1.0",
  "browser_specific_settings": {
    "gecko": {
      "id": "my-band@example.com",
      "strict_min_version": "142.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  },
  "permissions": ["storage", "https://ntfy.sh/*"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["band.js"],
      "css": ["band.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true }
}
```

`options.html` holds a form with a `topic` input, a submit button and a `status` paragraph, and loads `options.js`:

```js
const form = document.getElementById('form')
const input = document.getElementById('topic')
const status = document.getElementById('status')

browser.storage.local.get('topic').then(({ topic }) => {
  input.value = topic ?? ''
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const topic = input.value.trim()
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic)) {
    status.textContent = 'Only letters, numbers, - and _.'
    return
  }
  await browser.storage.local.set({ topic })
  status.textContent = 'Saved.'
})
```

Try it with an invented topic such as `narsil-0123456789abcdef0123`. The APIs are on MDN: [`storage.local`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), [`options_ui`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui) and [`browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Common mistakes and how to test it

- **Expecting it in the Claude app.** The native app takes no extensions, and neither does Chrome for Android. Use Firefox or Vivaldi, on `claude.ai` in the browser.
- **An unsigned extension in Firefox.** Release Firefox installs only signed extensions. Each new signature also needs a new `version` in the manifest.
- **The topic in the package.** Never write it into the code: the package goes to Mozilla to be signed. Keep it in `storage.local`.
- **A topic with spaces or a slash.** The options page refuses it. Copy the topic exactly as `/narsil movil` printed it.
- **Nothing after installing.** Reload `claude.ai`, as the last installation step says, so the page loads with the extension's scripts.
- **A band and no level.** The level needs the mod on your computer with `/narsil movil` on, and it updates when the mod sends a status (guide 3).

To test the skeleton on a desktop first, load it as a temporary add-on in `about:debugging` ([Extension Workshop: test and debug](https://extensionworkshop.com/documentation/develop/debugging/)), open the options from `about:addons`, save an invented topic, and read it back with `browser.storage.local.get('topic')` in the extension's console. For a phone, `web-ext run --target=firefox-android` runs it on a device connected over USB ([web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)).

## Going further

- Read [guide 2](/en/mods/claude/conversation-band/) for the band, which needs nothing from the computer.
- Read [Context and limits](/en/mods/pet/context-and-limits/) and [The cache clock](/en/mods/pet/cache-clock/) to see how Narsil shows the same numbers inside Claude Code.
- [Narsil Skin](https://github.com/davshn/narsil-skin) is the public theme the extension's colors come from.
