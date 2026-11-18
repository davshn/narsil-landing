---
title: One source, two Android packages
description: 'How Narsil in Claude ships one source as two packages: a signed unlisted .xpi for Firefox for Android, and a Manifest V3 folder for Vivaldi that puts its styles back when reloaded.'
route: claude
order: 5
updated: 2026-11-18
---

## What it does

Narsil in Claude is written once, in one folder, and reaches the phone in two forms:

| Browser             | Package                                   | How it gets on the phone                                       |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Firefox for Android | The folder as it is, Manifest V2          | Signed by Mozilla as an unlisted `.xpi`, installed from a file |
| Vivaldi for Android | A copy with a Manifest V3 derived from it | Copied to the phone over USB, loaded unpacked, unsigned        |

It needs **Firefox 142 or later** or **Vivaldi 8.2 or later**, as the README says. Chrome for Android takes no extensions, so Vivaldi is the Chromium browser that runs it.

The Vivaldi package also does something the Firefox one does not need: when Vivaldi reloads the extension, or Android closes Vivaldi and it opens again, the page can lose the extension's styles or scripts. The Chromium package notices, and puts them back without a page reload.

> **Experimental.** The extension relies on the structure of the `claude.ai` page, not on a public API, so a Claude update can break it. Loading an unpacked extension in Vivaldi on Android is a developer feature, and the browsers can change how it works. The extension only reads `claude.ai`: it never writes to your account or sends your conversations anywhere, though it loads Narsil's pictures from GitHub and reads its status topic from ntfy.sh. Signing for Firefox needs API credentials of your own on addons.mozilla.org; this guide shows only placeholders for them.

## How it works inside

### The source: a Firefox extension

The folder `extension/` is a complete Firefox extension: plain JavaScript, no build step, no libraries. Its `manifest.json` is **Manifest V2**, with a background page (`"persistent": true`) that loads `background.js` and its modules ([MDN: background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)).

Firefox reads one key no other browser needs, `browser_specific_settings` ([MDN: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)):

- **`gecko.id`**, the extension's id, in the form of an email address. Each new signed version keeps the same id, so Firefox treats it as the same extension.
- **`gecko.strict_min_version`** and **`gecko_android.strict_min_version`**, both `142.0`. A Firefox older than that does not install the extension. The first version asked for 121; commit `40be528` raised both to 142 when it added the next key. Its message does not say why.
- **`gecko.data_collection_permissions`**, with `required` set to `none`: the extension declares that it collects and transmits no data. MDN says this key is mandatory for new extensions submitted to addons.mozilla.org from November 3, 2025.

### Firefox: signing as unlisted

Firefox for Android installs only extensions signed by Mozilla. Signing does not mean publishing: the **unlisted** channel signs the extension "for self-distribution", in the words of the `web-ext` reference, and it never appears on the add-on store ([Extension Workshop: web-ext sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)).

The signing is Mozilla's own `web-ext` tool, run as `web-ext sign --channel=unlisted`. Two files tell it what to do:

- **`web-ext-config.mjs`**, at the root, which `web-ext` finds by itself ([Extension Workshop: getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)). It sets two options: the source folder is `./extension` and the artifacts folder is `./dist`. So only the extension's folder is packed, never the tests or scripts, and the signed `.xpi` lands in `dist/`, which git ignores.
- **`scripts/sign.ps1`**, which `npm run sign` runs. Commit `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" explains its purpose: it "asks for the API credentials and keeps them only in its own process".

The credentials are the **JWT issuer** and the **JWT secret** you generate on [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/). `web-ext` reads them from `--api-key` and `--api-secret`, or from the environment variables `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`. The script asks for both when it runs, the secret as hidden input, puts them in those two variables only for its own process, runs `web-ext`, and removes them when it ends, even if signing fails. They never go into a file, the shell's history or the repository.

Mozilla signs each version once, so every new signature needs a new `version` in `manifest.json`.

### Firefox: installing the signed file

The `.xpi` is a signed zip of the extension folder. To install it, copy it to the phone and use Firefox's hidden menu: **Settings → About Firefox**, tap the logo five times, then go back to **Settings** and use the option to install an extension from a file. [Guide 1](/en/mods/claude/what-it-is/) lists the steps.

While developing there is a quicker path that needs no signature: `npm run phone` runs `web-ext run --target=firefox-android` with the phone connected over USB. Firefox loads the folder as a temporary extension and reloads it on each change, for as long as the command runs ([Extension Workshop: web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)). `npm run lint` runs `web-ext lint`, which checks the manifest and the code for problems before you sign.

### Vivaldi: the Chromium package

Vivaldi is a Chromium browser, and since version 8.2 its Android version loads Chrome extensions from a folder on the phone, with no store and no signature. Commit `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" added the second package.

It is not a second copy of the code. `scripts/chromium.mjs` copies `extension/` to `dist/chromium` and writes two files into the copy:

1. **A Manifest V3 `manifest.json`**, derived from the Firefox one.
2. **`background-worker.js`**, a service worker of one line that loads, with `importScripts()`, the same background scripts the Firefox background page loads.

The derived manifest changes what Manifest V3 requires ([Chrome: migrate to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)):

| Firefox, Manifest V2                                 | Vivaldi, Manifest V3                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `manifest_version: 2`                                | `manifest_version: 3`                                                         |
| `browser_specific_settings`                          | Removed: Firefox's own                                                        |
| A background page with `scripts`                     | `background.service_worker`, the one-line worker                              |
| Addresses inside `permissions` (`https://ntfy.sh/*`) | Moved to `host_permissions`, with `https://claude.ai/*` added                 |
| `storage`                                            | `storage` and `scripting`                                                     |
| `web_accessible_resources` as a list of files        | A list of objects, each with its `resources` and the pages that may load them |
| Content scripts as they are                          | The same, with `lib/browser.js` loaded first in each group                    |

Everything else, the content scripts, the options page, the icons, carries over unchanged.

### One code for two APIs

Firefox calls the extension API `browser`; Chromium calls it `chrome`. In Manifest V3 both answer with promises, so the code only needs one name. `lib/browser.js`, which exists only to be loaded first in the Chromium package, sets `browser` to `chrome`. The rest of the code says `browser` everywhere.

The background needed one real change. A service worker has no `EventSource`, so the background follows ntfy.sh's stream with `fetch` and a stream reader instead, in both browsers. And Chromium stops an idle service worker after 30 seconds ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), so the block in the side menu sends it a word every 25 seconds while it shows. [Guide 3](/en/mods/claude/sidebar/) covers both.

### Vivaldi: loading it from `Download/narsil-chromium`

`npm run phone:chromium` builds the package and, with `--push`, copies it to the phone with Android's `adb`: it deletes `Download/narsil-chromium` on the phone and pushes the new folder there. With more than one device connected, the `ANDROID_SERIAL` environment variable picks one. The phone needs USB debugging turned on.

Then, in Vivaldi:

1. Open `vivaldi://extensions` and turn on **Developer mode**.
2. Tap **Load unpacked**, go to **Download → narsil-chromium**, tap **Use this folder**, then **Allow**.
3. Open the extension's options and write your topic, and the key if you have one.
4. Open `claude.ai` and reload it.

The folder stays on the phone: Vivaldi loads the extension from it each time.

### When Vivaldi reloads the extension

This is where the two browsers differ most. When the extension goes away with `claude.ai` open, because Vivaldi reloads or updates it or Android unloads it, Chromium takes its styles off the page and never puts its scripts back. Meanwhile, the old content script was still on the page, without its extension, placing the band without its styles. Firefox puts everything back by itself.

Three fixes, over a week, make the Chromium package put itself back together.

**1. The old scripts stop** (`1d9db3d`, 2026-11-11, and `6b24ccb`, 2026-11-17). The page observer every content script shares, in `lib/watch.js`, checks on each run whether its extension still exists: once it is gone, `browser.runtime.id` is empty or throws. Then the observer stops, and every script that used it stops with it: timers cleared, band removed. A newer copy of the scripts also stops the old one, by firing an event on the page's document, the only thing two copies share. `1d9db3d` also loads `lib/watch.js` in both groups of content scripts, since Vivaldi sometimes ran only the second group, and the band asked for an observer that did not exist yet.

**2. The background puts the scripts back** (`6b24ccb`). Each time the background starts, `lib/restore.js` asks every open `claude.ai` tab whether its scripts still answer. The content script answers a message of its own with `true`. A tab that does not answer gets the manifest's content script groups again, in order, each stylesheet with `scripting.insertCSS` and each group of scripts with `scripting.executeScript` ([Chrome: chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)). That needs the `scripting` permission and host access to the pages, which is why the Chromium manifest adds both. A tab it cannot reach, discarded or still loading, gets them on its next load anyway.

**3. The page asks for what it lacks** (`a1e01b6` and `8e31a1d`, 2026-11-18). After Android closes Vivaldi and it opens again, Vivaldi can run the content scripts without the stylesheets, or skip the whole first group. The scripts that ran still answer, so step 2 skips the tab. So the page checks itself: each stylesheet sets a mark on `:root`, and the band checks the marks and whether the first group left its mode function on the page ([guide 4](/en/mods/claude/colors-and-icon/) describes both). What is missing, it asks the background for. The background accepts only stylesheets and group numbers from its own manifest, never an arbitrary file, and inserts them into that tab and frame only.

In Firefox none of this runs: its manifest asks for no `scripting` permission, so `browser.scripting` does not exist there, and the restore code returns at once.

### Updating and uninstalling

**In Firefox**, change `version` in `manifest.json`, sign again, and install the new `.xpi` the same way. The manifest declares no update address, so Firefox does not look for new versions by itself. **In Vivaldi**, run `npm run phone:chromium` again and tap **Update** in `vivaldi://extensions`, as the README says.

To uninstall from Firefox, open the menu, go to **Extensions**, choose **Narsil en Claude** and remove it. From Vivaldi, remove it in `vivaldi://extensions`; the `Download/narsil-chromium` folder can then be deleted. In both, the topic and key in the extension's storage go with it, and Claude goes back to its own colors. The home screen icon stays ([guide 4](/en/mods/claude/colors-and-icon/) explains why).

If you no longer sign anything, revoke the API credentials on the same addons.mozilla.org page where you created them.

## How it was asked of the AI

No request for the packaging was recorded. The owner's words recorded for this path are about the site ([guide 1](/en/mods/claude/what-it-is/) quotes them). The following is reconstructed from the extension's commit history:

- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla". The same day as the first version, so it could be installed in Firefox for Android at all.
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package". Its message describes the derived Manifest V3, the service worker that loads the same background scripts, `lib/browser.js`, and the move from `EventSource` to `fetch`; and it says "The Firefox manifest stays V2".
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away".
- `6b24ccb` (2026-11-17) "fix: restore the styles and the band when Vivaldi brings the extension back".
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them".
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it".

The second browser took one day to add and a week to settle: each fix after `11dadb3` answers a way Vivaldi on Android loaded the extension only in part, found by using it.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> My Firefox extension lives in `extension/` with a Manifest V2 `manifest.json`. Write a Node script, with no dependencies, that copies the folder to `dist/chromium` and writes a Manifest V3 `manifest.json` there: drop `browser_specific_settings`, move URL patterns from `permissions` to `host_permissions` and add the content scripts' `matches` to them, add the `scripting` permission, turn the background scripts into a one-line service worker that calls `importScripts()` with them, put a file that sets `self.browser = self.chrome` first in each content script group, and convert `web_accessible_resources` to the V3 object form. Export the manifest conversion as a function and test it with `node --test`. Then, in the background, on start, send each matching tab a ping with `tabs.sendMessage`; where nothing answers, insert the manifest's content script CSS and JS again with `scripting.insertCSS` and `scripting.executeScript`. Use only APIs documented on MDN and developer.chrome.com.

## The minimal code

Three pieces, written for this guide (MIT): the conversion, the restore on start, and the signing.

`build-chromium.mjs`, run with `node build-chromium.mjs`:

```js
import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'))
const isAddress = (permission) => permission.includes('://')
const pages = source.content_scripts.flatMap((group) => group.matches)

const target = {
  manifest_version: 3,
  name: source.name,
  version: source.version,
  icons: source.icons,
  options_ui: source.options_ui,
  permissions: [...source.permissions.filter((p) => !isAddress(p)), 'scripting'],
  host_permissions: [...new Set([...source.permissions.filter(isAddress), ...pages])],
  background: { service_worker: 'worker.js' },
  content_scripts: source.content_scripts.map((group) => ({
    ...group,
    js: ['shim.js', ...(group.js ?? [])],
  })),
}

fs.rmSync('dist/chromium', { recursive: true, force: true })
fs.cpSync('extension', 'dist/chromium', { recursive: true })
fs.writeFileSync('dist/chromium/manifest.json', JSON.stringify(target, null, 2))
fs.writeFileSync('dist/chromium/shim.js', 'self.browser = self.chrome\n')
const scripts = ['shim.js', ...source.background.scripts].map((file) => `'${file}'`)
fs.writeFileSync('dist/chromium/worker.js', `importScripts(${scripts.join(', ')})\n`)
```

At the end of the background script, the restore on start:

```js
async function restoreOpenPages() {
  if (!browser.scripting) return
  const groups = browser.runtime.getManifest().content_scripts ?? []
  const tabs = await browser.tabs.query({ url: groups.flatMap((group) => group.matches) })
  for (const tab of tabs) {
    const alive = await browser.tabs.sendMessage(tab.id, 'ping').catch(() => false)
    if (alive === true) continue
    const target = { tabId: tab.id }
    for (const group of groups) {
      if (group.css) await browser.scripting.insertCSS({ target, files: group.css }).catch(() => {})
      if (group.js)
        await browser.scripting.executeScript({ target, files: group.js }).catch(() => {})
    }
  }
}

restoreOpenPages()
```

And in a content script, the answer:

```js
browser.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === 'ping') reply(true)
})
```

For the signing, a `web-ext-config.mjs` at the root:

```js
export default {
  sourceDir: './extension',
  artifactsDir: './dist',
}
```

Then, in a shell on your computer, with `dist/` in your `.gitignore`:

```sh
read -r -p 'JWT issuer: ' WEB_EXT_API_KEY
read -r -s -p 'JWT secret: ' WEB_EXT_API_SECRET
export WEB_EXT_API_KEY WEB_EXT_API_SECRET
npx web-ext sign --channel=unlisted
unset WEB_EXT_API_KEY WEB_EXT_API_SECRET
```

The issuer looks like `user:00000000:000` and the secret like `EXAMPLE-not-a-real-secret`; those two are placeholders, never real values. Typing them at a prompt keeps them out of the shell's history, which a command line with the values in it would not. If you would rather keep them in a file, keep it outside the repository or in a git-ignored file on your computer, never in a commit.

## Common mistakes and how to test it

- **Putting the AMO credentials in the repository.** Anyone with the issuer and secret can sign under your account. Type them when signing, or keep them in a git-ignored file. If one ever reaches a commit, revoke them at once on [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) and generate new ones; removing the commit is not enough.
- **Signing without changing the version.** Mozilla signs each version once. Change `version` first.
- **Choosing the `listed` channel.** That submits the extension to the public store. For your own phone, use `unlisted`.
- **Forgetting `gecko.id`.** For a Manifest V2 extension without one, `web-ext` generates an id and saves it in `.web-extension-id`; lose that file and the next signature is a different extension. Set the id in the manifest.
- **Keeping a background page in Manifest V3.** Chromium wants a service worker, which has no DOM and no `EventSource`.
- **Leaving URL patterns in `permissions`.** In Manifest V3 they belong in `host_permissions`.
- **Expecting Chromium to put the scripts back.** When the extension reloads, the open pages lose their styles and get no new scripts. Ask each tab, and inject again where nothing answers.
- **Old scripts that keep running.** A content script left without its extension still runs. Check `browser.runtime.id`, and stop when it is gone.
- **Injecting whatever a page asks for.** A page's message is not trusted. Inject only files from your own manifest.

To test the Firefox package before signing, run `web-ext lint` and `web-ext run --target=firefox-android` with the phone connected. To test the conversion, export it as a function and check a small Manifest V2 object: its URL patterns should end in `host_permissions`, `scripting` should be added, and every content script group should start with the shim. To test the restore, load the Chromium package in Vivaldi, open `claude.ai`, then tap **Update** in `vivaldi://extensions` and go back to the tab without reloading it: the colors and the band should come back within a moment.

## Going further

- [Guide 1](/en/mods/claude/what-it-is/) lists the extension's parts and what each one reads over the network.
- The Firefox package could update itself: an `update_url` in `browser_specific_settings` that points at a file of your own lets Firefox find new signed versions ([Extension Workshop: updating your extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/)).
- The same Chromium package could load in Chrome on a computer, as an unpacked extension, to test the band on a wider screen.
