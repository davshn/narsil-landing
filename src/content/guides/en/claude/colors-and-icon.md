---
title: Narsil's colors and icon
description: "How Narsil in Claude dresses claude.ai in Narsil Skin's night sea colors, light by day and dark by night on the phone's clock, and gives the home screen app her icon."
route: claude
order: 4
updated: 2026-11-18
---

## What it does

With the extension active, the whole `claude.ai` page wears the night sea palette of [Narsil Skin](https://github.com/davshn/narsil-skin): deep blues by night, pale sea blues by day. It changes:

- **The page's colors**: backgrounds, panels, text, borders, accents and the side menu.
- **The code blocks**, in both the chat and the code diffs, so they match the rest.
- **A few details**: the message box gets a thin border that takes the accent color when you write, the text you select takes the accent color, all the text is bold as in the theme, and the orange spark that shows while Claude works turns purple.

It is light from 6:00 to 17:59 and dark from 18:00 to 5:59, by the phone's clock, whatever appearance you chose in Claude's own settings.

And when you add `claude.ai` to the home screen with the extension active, the app gets Narsil's icon instead of Claude's.

> **Experimental.** The colors work by overriding the design variables the `claude.ai` page declares for itself, and the mode by rewriting an attribute of the page. Neither is a public API, so a Claude update can rename them and the page goes back to Claude's own colors, with nothing broken. The extension only changes how the page looks on your phone: it writes nothing to your account. To show the home screen icon, the browser downloads it from the address of Narsil's phone web app, `narsil-pwa.vercel.app`, only when you install the app.

## How it works inside

The colors and the icon are the first group of content scripts in the manifest, the one that runs at `document_start`, before the page draws anything ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). It holds one stylesheet, `skin.css`, and four small scripts: `lib/watch.js` (the page observer [guide 2](/en/mods/claude/conversation-band/) describes), `lib/mode.js` and `mode.js` (the hour), and `lib/manifest.js` and `app-icon.js` (the icon).

Running that early matters: a stylesheet that arrived after the page drew would show Claude's own colors for a moment first. The code's comment says it plainly: the page's own colors "never flash first".

### Only the page's variables, not a new design

The `claude.ai` page does not hard-code its colors. It declares them as CSS custom properties, such as `--cds-page-bg` for the page background and `--cds-text-primary` for the main text, and every part of the page reads them ([MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)). It has two sets, one for each mode, chosen by a `data-mode` attribute.

So `skin.css` does not restyle buttons, menus and panels one by one. It gives those same variables new values, one block for `data-mode="dark"` and one for `data-mode="light"`, each marked `!important` so it wins over the page's own declarations. The dark block is built on the theme's night blues, such as `#0f1a2c` for the page; the light block on its pale sea blues, such as `#c9e7f1`. Secondary and muted text are the primary text mixed with transparency (`color-mix()`), so they keep the same hue.

There is a catch the stylesheet's comments explain: the page does not declare the variables only on `<html>`. Each part it mounts with its own root declares them again for itself, so a rule on `<html>` alone lasts only until that part appears. The rules cover those roots too.

A few things do not take the variables, and get their own rules: the side menu's background, the code diffs, and the chat's code blocks.

### Why only colors and styles, with no animated background

Narsil Skin on the desktop can draw a live wallpaper behind Claude. The extension keeps none of it. The comment at the top of `skin.css` says it takes "only the page's own design variables and a few parts", and none of the theme's wallpaper, waves or stars; the README says the same: only the theme's colors and styles, with no animated backgrounds.

Neither says why. A likely reason is the phone itself: an animated layer behind a page that already redraws many times a second while Claude writes would cost battery and frames, and the extension's later work (below) was all about making the page lighter. Changing variables costs almost nothing, because the page already reads them.

### The code blocks in light mode

The chat's code blocks were a special case. Their tokens are colored inline, in each `<pre>`, with the page's dark palette, even when the light mode is forced. In light mode, pale tokens on a pale background could barely be read.

Commit `127ca62` (2026-11-13) "style: darken code block tokens in light mode" fixes it with a filter, not a new palette. It matches only light mode code blocks whose inline base color is the dark palette's, inverts them and rotates the hue by half a turn ([MDN: filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)). Inverting turns pale into dark; rotating the hue by 180 degrees turns each color back to its own hue, so a pale blue keyword becomes a darker blue, not an orange one. A little extra saturation keeps them from looking washed out.

The code diffs work differently: they live inside a shadow root, which page rules cannot reach. But custom properties pass into a shadow root, and a rule on the element that hosts it beats the shadow root's own rules, so `skin.css` sets the diff's background and text variables on that host.

### Light by day, dark by night, on the phone's clock

The rule is in `lib/mode.js`: an hour from 6 up to 17 is day and gets `light`; any other hour gets `dark`. Its comment says it follows the same hours as Narsil Skin's automatic theme.

`mode.js` applies it. It looks for every element whose `data-mode` is `light`, `dark` or `system`, and sets it to the mode of the current hour. Not every `data-mode`: the page also uses `data-mode="code"` for something else, and that one is left alone. It writes only when the value differs, so the page observer is not woken up for nothing.

Since Claude's own appearance setting works through the same attribute, the extension's mode wins over it: whatever you chose, the next run puts the hour's mode back.

It runs again:

- **When the page changes**, through the single page observer, which also listens for changes to `data-mode` itself. When the page mounts a new part with its own `data-mode`, or sets it back to your Claude setting, it is corrected within a frame.
- **Every minute**, because the hour can turn at 6:00 or 18:00 with no change on the page.
- **When the page becomes visible again**, since a hidden page runs no frames and the phone may have slept through the change.

### Faster conversations

On 2026-11-11, commit `ce7d17e` "perf: lighten the styles and the page observers so claude.ai switches conversations faster" found that the colors themselves were slowing the page. Its message names three changes:

1. **Two muted color variables** used to be set on every element. A custom property set on every element makes each one carry its own copy, and every style recalculation pays for it. They are now set only on the elements where the page itself declares them, and inherited from there.
2. **The bold rule** used to exclude Narsil's own parts with a `:not()` of descendants, which makes the browser walk each element's ancestors on every recalculation. It became a plain rule for all text, and the band's own stylesheet sets its weights back.
3. **One observer** for all the content scripts, run at most once a frame, instead of one per script.

### When Vivaldi skips the colors or the mode

Vivaldi for Android brought two problems of its own, explained in [guide 5](/en/mods/claude/android-packaging/): after Android closes Vivaldi and it opens again, it may load the band without its stylesheets, or skip the whole `document_start` group, so `mode.js` never runs and the page keeps Claude's own mode.

The fixes let the page notice what is missing and ask for it:

- **`a1e01b6`** (2026-11-18): each stylesheet ends by setting a mark of its own on `:root`, a custom property such as `--narsil-css-skin: 1`. When the band starts, it reads the marks with `getComputedStyle`; a stylesheet whose mark is empty did not arrive.
- **`8e31a1d`** (2026-11-18): the band also checks that `lib/mode.js` left its function on the page. If not, the first group did not run.

In both cases the band asks the background for the missing pieces, and the background puts back only the manifest's own stylesheets and groups, styles first.

### The home screen icon

When you add a page to the home screen, the browser reads its web app manifest, the file the page names in a `<link rel="manifest">` ([MDN: Web application manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)). Its `icons` member says which pictures the app gets ([MDN: icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)).

So the extension does not touch the home screen. It changes which manifest the page offers:

1. **`lib/manifest.js` builds a manifest** that is Claude as it is: the name `Claude`, standalone display, start and scope at `https://claude.ai/`, the night sea blue as background and theme color, and two icons, 192 and 512 pixels.
2. **It turns it into an address** of its own: a `data:` URL with the type `application/manifest+json` and the JSON encoded in it. Nothing is downloaded for the manifest itself.
3. **`app-icon.js` points the page's link at it**: it finds the `<link rel="manifest">` and replaces its `href`, if it is not already that one. The page observer listens for changes to `href`, so if the page puts its own manifest back, the next run swaps it again.

The icons are not inside the extension. A `data:` manifest has no address of its own to resolve a relative icon path against, so the icons need full addresses, and they point at where Narsil's phone web app already serves them: `https://narsil-pwa.vercel.app`. The browser downloads them only when you install the app.

### Why the icon is fixed at install time

The browser copies the icon when it creates the home screen app; it does not ask the page again each time you open it. Commit `083c03d`'s message says it: "The icon is set at install, so an app already installed has to be installed again."

That has two consequences the README spells out:

- **If you already had `claude.ai` on the home screen**, remove it and add it again with the extension active.
- **If you remove the extension**, the app keeps Narsil's icon. Nothing is running to change it back; it stays until you install the app again.

The icon was tested in Firefox for Android, where the extension adds it from the menu with **Install** or **Add to Home screen**. In Vivaldi it has not been tested.

## Build it with Claude

Ask Claude for a content script group that runs at `document_start`, with one stylesheet and two small scripts. The one idea it must get right is to change only what the page already reads, its design variables and its `data-mode` attribute, instead of restyling the page part by part.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Firefox extension for `https://claude.ai/*`, add a content script group at `document_start` with one stylesheet and two scripts. The stylesheet overrides only the page's own CSS custom properties, one block for `[data-mode="dark"]` and one for `[data-mode="light"]`, with `!important`; no backgrounds, images or animations. The first script sets every element whose `data-mode` is `light`, `dark` or `system` to `light` from 6:00 to 17:59 local time and `dark` otherwise, writing only when the value differs; it runs from one `MutationObserver` throttled with `requestAnimationFrame`, every 60 seconds and on `visibilitychange`. The second script replaces the `href` of the page's `<link rel="manifest">` with a `data:application/manifest+json` URL holding a manifest with absolute icon URLs on `https://example.com`. Keep the hour rule in its own module and test it with `node --test`.

### What to check in Claude's answer

1. The stylesheet loads at `document_start` and overrides only the page's CSS custom properties, one block for dark and one for light, with `!important`, and no backgrounds, images or animations.
2. The mode script touches only elements whose `data-mode` is `light`, `dark` or `system`, never `data-mode="code"`, and writes only when the value differs.
3. The hour rule lives in its own module: 5, 6, 17 and 18 give `dark`, `light`, `light` and `dark`.
4. The mode runs again from one observer throttled with `requestAnimationFrame`, every 60 seconds, and on `visibilitychange`.
5. The manifest is a `data:application/manifest+json` URL with full icon addresses, not relative paths, so the browser downloads the icons only when you install the app, and the link's `href` changes only when it differs.

If a check fails, tell Claude what you see: "after 18:00 the page stays light until I reload it".

### How the author asked for it

No request for the colors or the icon was recorded. The owner's words recorded for this path are about the site ([guide 1](/en/mods/claude/what-it-is/) quotes them). The following is reconstructed from the extension's commit history:

- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night". Its message describes the approach: it overrides the page's own design variables with the night sea palette, "without its wallpaper", and follows the same hours as the theme's automatic mode.
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox". It offers Firefox a manifest with her icons in place of the page's own.
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster".
- `127ca62` (2026-11-13) "style: darken code block tokens in light mode".
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them".
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it".

The history reads as a first day that got the look right, followed by work on what the look cost: speed on a long page, legibility in one corner, and Vivaldi's habit of loading only part of the extension.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

The same three pieces, written for this guide (MIT). The variable names are the ones the `claude.ai` page declares today; the colors are two from the night sea palette; the icon address is a placeholder for your own.

`skin.css`:

```css
html[data-mode='dark'],
[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
  --cds-text-primary: #dce6fa !important;
}

html[data-mode='light'],
[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
  --cds-text-primary: #0f2f47 !important;
}
```

`mode.js`:

```js
const modeAt = (hour) => (hour >= 6 && hour < 18 ? 'light' : 'dark')
const themed = '[data-mode="light"],[data-mode="dark"],[data-mode="system"]'

function applyMode() {
  const mode = modeAt(new Date().getHours())
  document.querySelectorAll(themed).forEach((element) => {
    if (element.dataset.mode !== mode) element.dataset.mode = mode
  })
}

const icons = [192, 512].map((size) => ({
  src: `https://example.com/icons/icon-${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
}))
const manifest = { name: 'Claude', display: 'standalone', start_url: 'https://claude.ai/', icons }
const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`

function applyIcon() {
  const link = document.querySelector('link[rel~="manifest"]')
  if (link && link.getAttribute('href') !== manifestUrl) link.setAttribute('href', manifestUrl)
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    applyMode()
    applyIcon()
  })
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['data-mode', 'href'],
})

setInterval(applyMode, 60_000)
document.addEventListener('visibilitychange', applyMode)
applyMode()
applyIcon()
```

In the manifest, both go in one content script entry with `"run_at": "document_start"` and `"matches": ["https://claude.ai/*"]`. At `document_start` the page has no body yet, which is why everything waits for the observer ([MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)): the observer fires as the page builds itself, and each run fixes what has appeared. The `attributeFilter` keeps attribute changes down to the two the script cares about.

## Common mistakes and how to test it

- **Loading the colors at `document_idle`.** The page draws in Claude's colors first, then changes. Load the stylesheet at `document_start`.
- **Styling the parts instead of the variables.** Every button and panel needs its own rule, and each Claude update breaks some. Override the variables the page already reads.
- **Setting the variables only on `<html>`.** Parts of the page declare them again on their own roots. Cover those roots too, and check that a newly opened panel keeps the colors.
- **Setting a custom property on every element.** It works, and it slows every style recalculation. Set it where the page declares it and let it inherit.
- **Rewriting every `data-mode`.** The page uses `data-mode="code"` for something else. Match only `light`, `dark` and `system`.
- **Writing when nothing changed.** Each write wakes the observer, which writes again. Compare first.
- **Waiting for the page to change at 18:00.** It may not. Check the hour on a timer, and when the page becomes visible.
- **A relative icon path in a `data:` manifest.** It has nothing to resolve against. Use full addresses.
- **Expecting the icon to change on an app already installed.** It was fixed at install time. Remove the app and add it again.

To test the hour rule, keep it in a module with no DOM and check the edges: 5, 6, 17 and 18 should give `dark`, `light`, `light` and `dark`. To test the page, change the phone's time to 17:59 and wait for 18:00, or set the hour by hand in the rule while developing: the page should switch within a minute without a reload. Then change Claude's own appearance setting: the page should go back to the hour's mode at once. For the icon, open `claude.ai` with the extension active, add it to the home screen, and check that the new app shows your icon; remove the extension and check that it stays.

## Going further

- [Guide 5](/en/mods/claude/android-packaging/) explains why Vivaldi sometimes loads the extension in pieces, and how the background puts the styles back.
- [Narsil Skin](https://github.com/davshn/narsil-skin) has the full night sea theme for the desktop, wallpaper included, and other themes whose variables could be carried over the same way.
- The hours could follow sunrise and sunset instead of a fixed 6:00 and 18:00. The rule lives in one small function, so only that function would change.
