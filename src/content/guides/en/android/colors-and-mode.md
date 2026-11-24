---
title: Narsil colors, by day and by night
description: 'How skin.css dresses claude.ai in the Narsil Skin night-sea palette, how mode.js picks light or dark by the hour whatever Claude says, and how the bars follow without a flash.'
route: android
order: 5
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/skin.css
  - repo: android
    path: app/src/main/assets/page/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
---

## What it does

Inside the app, Claude wears Narsil's colors: the night-sea palette of [Narsil Skin](https://github.com/davshn/narsil-skin), the author's color themes for the Claude desktop app. Backgrounds, text, borders, code blocks and the glow while Claude works all change:

- **By night**, from 18:00 to 5:59, a deep navy ground (`#0f1a2c`), pale blue text and a bright blue accent.
- **By day**, from 6:00 to 17:59, a pale sea-blue ground (`#c9e7f1`), dark blue text and a teal accent.
- **The orange spark** Claude shows while it works turns purple.
- **All the text is bold**, as the theme has it.

The hour decides, on the phone's own clock, whatever appearance you picked in Claude: the app does not read your setting and does not change it. The status bar and the navigation bar follow, with the same ground behind them and dark or light icons to match. And the colors go on at the very start of each page, so Claude's own never flash first.

> **Experimental.** The skin replaces `claude.ai`'s own design variables and styles a few of its parts by class names and attributes of the page's current markup. None of these are a public API. A Claude update can rename them; when it does, some parts of the page go back to Claude's colors, or, rarely, a part becomes hard to read until the skin is updated. Claude itself keeps working.

## How it works inside

Three files do the work, and one setting in Kotlin finishes it:

| File                       | Job                                                                               |
| -------------------------- | --------------------------------------------------------------------------------- |
| `assets/page/skin.css`     | The palette, as values for Claude's design variables, and a few rules of its own. |
| `assets/page/lib/mode.js`  | Which mode an hour wears: one rule, shared by the page scripts.                   |
| `assets/page/mode.js`      | Sets the page's light or dark mode by the hour, and keeps it set.                 |
| `MainActivity.paintBars()` | Paints the ground behind the system bars and picks their icons' color.            |

### Painting with the page's own variables

A modern web app does not write colors into each rule. It defines them once, as CSS custom properties, and every component reads them. `claude.ai` does this with a family of variables whose names start with `--cds-` (page ground, surfaces, text, borders, accents), plus an older family of `--bg-*`, `--text-*` and `--accent-*` values written as HSL triples.

That makes the skin small. Instead of restyling hundreds of components, `skin.css` gives those variables new values, and the page repaints itself. The start of the dark half, from `skin.css` in narsil-android (MIT):

<!-- prettier-ignore -->
```css
/* Each .cds-root the app mounts declares these again for itself, so setting
   them on html alone lasts only until it has mounted. */
html[data-mode="dark"],
html[data-mode="dark"] .cds-root:not([data-mode="light"]),
html[data-mode="dark"] #static-composer,
.cds-root[data-mode="dark"],
.cds-dark-scope {
  --cds-page-bg: #0f1a2c !important;
  --cds-surface-0: #0b1422 !important;
  --cds-surface-1: #0f1a2c !important;
  --cds-surface-2: #16243b !important;
  --cds-surface-3: #1a2a44 !important;
  --cds-surface-panel: #16243b !important;
  --cds-surface-popover: #22344f !important;
  --cds-text-primary: #dce6fa !important;
  --cds-text-secondary: color-mix(in srgb, #dce6fa 68%, transparent) !important;
```

Three details in those few lines explain the whole file:

- **The selectors repeat.** As the comment says, each `.cds-root` that the page mounts declares the variables again for itself, and a closer declaration wins over the one on `html`. So the skin sets them on every place the page sets them: `html`, each `.cds-root`, the static composer, and the dark scopes.
- **`!important` everywhere.** The page's own declarations would otherwise win when they are as specific as the skin's. An important declaration beats a normal one regardless of order.
- **Shades from one color.** Secondary and muted text are the primary text mixed with transparency (`color-mix(in srgb, #dce6fa 68%, transparent)`), so every shade stays in the same hue.

The palette's main values side by side:

| Variable              | Night (`dark`)      | Day (`light`)          |
| --------------------- | ------------------- | ---------------------- |
| `--cds-page-bg`       | `#0f1a2c`           | `#c9e7f1`              |
| `--cds-surface-0`     | `#0b1422`           | `#b7deed`              |
| `--cds-surface-2`     | `#16243b`           | `#d6eef5`              |
| `--cds-text-primary`  | `#dce6fa`           | `#0f2f47`              |
| `--cds-text-accent`   | `#5aaeff`           | `#1f83a8`              |
| `--cds-border-strong` | 26 % of a pale blue | 26 % of the text color |

### What the variables do not reach

A few parts of the page do not take their colors from those variables, and `skin.css` styles them one by one:

- **The side menu**, painted with `--cds-surface-0`.
- **Code blocks in diffs**, which live in a shadow root, where outside rules do not reach. Custom properties do pass inside, and a rule on the shadow host beats the component's own, so the skin sets `--diffs-light-bg`, `--diffs-dark-bg` and their text colors on `diffs-container`.
- **Chat code blocks in light mode.** They color their tokens inline with the page's dark palette even when light mode is forced, so pale tokens would sit on a pale ground. The skin finds them by their inline base color and turns them with `filter: invert(1) hue-rotate(180deg) saturate(1.3)`: inverting flips light to dark, and turning the hue by half a circle puts each token's hue back.
- **The selection**, the message box's border (stronger when it has focus), and **the spark**: `[data-cds="Spark"]` and `[data-cds="WorkingMark"]` get `filter: hue-rotate(262deg) saturate(1.3)`, which turns Claude's orange purple.
- **Bold text**: `body, body *` get `font-weight: 700 !important`. The comment explains why it is a plain rule and not a `:not()` that spares Narsil's own parts: a `:not()` of descendants "would walk every element's ancestors on each recalculation". Instead, `band.css` sets the band's weights back with `!important` of its own.

The comments also care about speed. Two variables the page inherits are set "Only where the page declares them", because on every element "they would make each one carry its own copy and slow every style recalculation". On a phone, while Claude streams an answer and the page changes many times a second, that matters.

At its end, `skin.css` sets `--narsil-css-skin: 1` on `:root`. It changes nothing visible: it is a mark the band's scripts read to know the stylesheet reached the page ([guide 3](/en/android/conversation-band/) explains what they do when it is missing).

### How the styles reach the page

`skin.css` and `band.css` are joined by `PageScript.kt` into one JavaScript string, `NARSIL_CSS`, and `host.js` turns it into a constructed stylesheet:

<!-- prettier-ignore -->
```js
const sheet = new CSSStyleSheet()
sheet.replaceSync(NARSIL_CSS)

// The page sets adoptedStyleSheets of its own at times: the sheet goes back on each change the watch sees.
function adopt() {
  if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}
adopt()
```

That excerpt is from `host.js` in narsil-android (MIT). A constructed sheet is not an element in the page, so the page's markup changes cannot remove it, and the file's comment notes that the page's Content Security Policy does not govern it, where a `<style>` added by a script could be refused. The page may replace its own list of adopted sheets, so `PageScript` registers `adopt` with the page observer: after any change, Narsil's sheet goes back on.

### Light by day, dark by night

The rule for the hour is one line, in `lib/mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Which mode claude.ai wears at each hour, as narsil-skin's auto theme does.

self.narsilMode = (() => {
  const isDay = (hour) => hour >= 6 && hour < 18
  const modeOfHour = (hour) => (isDay(hour) ? 'light' : 'dark')
  return { modeOfHour }
})()
```

It mirrors Narsil Skin's automatic theme on the desktop, so the phone and the computer change at the same time.

`claude.ai` marks its mode with a `data-mode` attribute: `light`, `dark` or `system`, on the `<html>` element and on some of its components. That attribute is what your appearance setting writes, and what the skin's selectors read. So `mode.js` does not fight the page's styles; it simply writes the attribute. The whole file, from `mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Light by day and dark by night, whatever claude.ai's own setting says: its
// data-mode attribute, on every element that carries one, as the page sets it
// again whenever it mounts one. Not every data-mode: data-mode=code means
// something else.

(() => {
  const MODES = '[data-mode=light],[data-mode=dark],[data-mode=system]'
  const CHECK_MS = 60_000
  function apply() {
    const mode = self.narsilMode.modeOfHour(new Date().getHours())
    for (const element of document.querySelectorAll(MODES)) if (element.dataset.mode !== mode) element.dataset.mode = mode
  }

  self.narsilWatch(apply)

  // The hour turns with no change on the page; a hidden page runs no frames.
  const timer = setInterval(apply, CHECK_MS)
  const onVisibility = () => apply()
  document.addEventListener('visibilitychange', onVisibility)
  self.narsilWatch.onStop(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
  apply()
})()
```

Each part has a reason:

- **Only three values.** `data-mode=code` exists on the page and "means something else", so the selector names `light`, `dark` and `system` and leaves the rest alone.
- **Every element that carries one,** not just `<html>`. The page mounts components with their own `data-mode`, and sets it again when it mounts them.
- **On every page change,** through `self.narsilWatch(apply)`. The page observer of `lib/watch.js` watches attributes too, with `attributeFilter: ['data-mode', 'href']`, so the page setting `data-mode` back is itself a change that wakes it.
- **Every 60 seconds,** because the hour turns with nothing changing on the page.
- **On `visibilitychange`,** because, as the comment says, "a hidden page runs no frames": the observer's callbacks wait for a frame, and timers slow down in a hidden page. When the screen comes back after a night in your pocket, the right mode is there at once, not up to a minute later.
- **Only when different.** Writing the attribute is a change the observer sees, so `apply` writes only when the value differs. Otherwise each write would wake the observer, which would write again.

The app never touches your Claude setting. `mode.js` only rewrites the attribute in the page in front of you. On your computer, or in Claude's own app, your setting is as you left it.

### Before the first paint

The README promises that "The colors go on from the very start of each page, so Claude's own never flash first." Three things make that true:

1. **The script runs at document start.** `addDocumentStartJavaScript` runs it before any of `claude.ai`'s own scripts ([guide 2](/en/android/webview-host/)). By then the stylesheet is adopted, so its rules are waiting for the page's markup.
2. **The mode goes in the first group.** `PageScript` runs `lib/watch.js`, `lib/mode.js` and `mode.js` at once, not after the document is parsed, which is when the band's scripts run.
3. **The observer works before paint.** It runs its callbacks with `requestAnimationFrame`, and a browser runs those callbacks just before it paints the frame. So when the page sets `data-mode` to its own value, `mode.js` has written Narsil's back before that frame reaches the screen.

The task log records the check on a real phone, through DevTools: "both style marks and the night ground rgb(15, 26, 44)", which is `#0f1a2c`.

### The system bars

The page sits between the system bars ([guide 2](/en/android/webview-host/) explains the padding), so what shows behind them is the activity's own frame. `MainActivity` paints it with the page's ground and picks the icons' color. From `MainActivity.kt` (MIT):

```kotlin
    // Behind the system bars, the page's own ground, light by day and dark by night as the band's mode.js sets it.
    private fun paintBars() {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val isDay = hour in 6..17
        frame.setBackgroundColor(Color.parseColor(if (isDay) "#c9e7f1" else "#0f1a2c"))
        WindowCompat.getInsetsController(window, frame).apply {
            isAppearanceLightStatusBars = isDay
            isAppearanceLightNavigationBars = isDay
        }
    }
```

`hour in 6..17` is the same rule as `lib/mode.js`, written in Kotlin: 6:00 to 17:59. The two colors are `--cds-page-bg` of each mode. `isAppearanceLightStatusBars = true` asks for dark icons, which a light ground needs; at night they turn light.

The rule lives twice, once in JavaScript and once in Kotlin, because the page and the activity cannot easily share code. The values must change together, which is worth a test of your own (see the reference code).

`paintBars` runs in `onResume`, each time the app comes to the front. It does not run on a timer, as `mode.js` does.

## Build it with Claude

Ask Claude for a skin in two parts: a stylesheet that gives the page's own design variables new values under `html[data-mode=…]`, and a small script that sets that attribute by the hour and keeps it set. The one idea it must get right is that the skin follows the page's own mechanism instead of fighting it: it writes variables and the mode attribute, and lets the page repaint itself.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> My Android app runs a script at document start on `https://claude.ai` and adopts one constructed stylesheet. Write the stylesheet: under `html[data-mode="dark"]`, each `.cds-root` without `data-mode="light"`, and `.cds-root[data-mode="dark"]`, give the page's `--cds-page-bg`, `--cds-surface-0` to `-3`, `--cds-text-primary` and `--cds-text-accent` a navy palette with `!important`, and a pale sea-blue palette for `light`. Then write a script that, on every element with `data-mode` set to `light`, `dark` or `system` (never `code`), writes `light` from 6:00 to 17:59 and `dark` otherwise, by the phone's local hour. Run it at once, on each change a single `MutationObserver` (throttled with `requestAnimationFrame`, also watching the `data-mode` attribute) sees, every 60 seconds, and on `visibilitychange`; write only when the value differs. In Kotlin, in `onResume`, paint the frame behind the system bars with the same ground and set light or dark bar icons by the same hours. Test the hour rule in both languages.

### What to check in Claude's answer

1. The variables are set on every element the page declares them on, not only on `html`.
2. The mode script leaves `data-mode=code` alone.
3. It writes the attribute only when the value differs, so the observer does not loop.
4. The observer watches the `data-mode` attribute, so the page setting it back is caught.
5. There is a timer for the hour and a `visibilitychange` listener for the screen coming back.
6. The Kotlin rule and the JavaScript rule agree at 5, 6, 17 and 18 o'clock.
7. Nothing changes the person's Claude setting; only the attribute in the page.

If a check fails, tell Claude what you see: "at 18:00 the page turns dark but the status bar stays light".

### How the author asked for it

The owner's words are recorded in `odd/tasks/android-app.md`. L1 asked for a web view that "modifique sus estilos como lo hace esta extension" (changes its styles the way this extension does), and L3: "recuerda que los estilos que va a inyectar seran los de la extension […]" (remember that the styles it injects will be the extension's; the name of the earlier project is left out here). So the colors were not designed again for the app: `skin.css`, `mode.js` and `lib/mode.js` came from the earlier extension as they were, and the app's work was to put them on the page early enough.

The rest is reconstructed from the commit history (a project name in a subject is replaced by a description in brackets):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep". Its message: "the styles go on as a constructed style sheet."
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service". `paintBars` arrives with `MainActivity`.
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces".

## Reference code

This is one correct answer, written for this guide (MIT). Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

The hour rule and the bar colors in one Kotlin object, so the activity and its test share them:

```kotlin
package io.github.davshn.narsil

object DayNight {
    const val DAY_GROUND = "#c9e7f1"
    const val NIGHT_GROUND = "#0f1a2c"

    fun isDay(hour: Int): Boolean = hour in 6..17

    fun groundOf(hour: Int): String = if (isDay(hour)) DAY_GROUND else NIGHT_GROUND
}
```

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DayNightTest {
    @Test
    fun theDayRunsFromSixToFiveFiftyNine() {
        assertFalse(DayNight.isDay(5))
        assertTrue(DayNight.isDay(6))
        assertTrue(DayNight.isDay(17))
        assertFalse(DayNight.isDay(18))
    }

    @Test
    fun theGroundIsThePagesOwn() {
        assertEquals("#c9e7f1", DayNight.groundOf(12))
        assertEquals("#0f1a2c", DayNight.groundOf(23))
    }
}
```

And the smallest possible skin for one variable, to see the mechanism on its own. Put it in a constructed sheet and set `data-mode` by hand in DevTools to watch the page follow:

```css
html[data-mode='dark'],
html[data-mode='dark'] .cds-root:not([data-mode='light']),
.cds-root[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
}

html[data-mode='light'],
html[data-mode='light'] .cds-root:not([data-mode='dark']),
.cds-root[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
}
```

## Common mistakes and how to test it

- **Variables on `html` only.** The first component that mounts declares its own and the page goes back to Claude's colors in patches. Set them wherever the page does.
- **A `<style>` element from the script.** A page's Content Security Policy may refuse it. A constructed stylesheet, as the app uses, or an extension's own stylesheet, is the way in.
- **Rewriting every `data-mode`.** `data-mode=code` means something else on this page; overwriting it breaks that part.
- **Writing the attribute on every run.** The observer wakes on its own write and never rests. Compare first.
- **No timer.** The page does not change at 18:00, so without one the mode waits for your next tap.
- **Bold everywhere, Narsil's band too.** `body *` reaches the band. Give your own parts their weights back.
- **Code blocks unreadable in light mode.** Inline colors ignore the variables. Look for them, as `skin.css` does with its filter.
- **Expecting Claude's appearance setting to matter.** In the app, the hour wins. That is the design, not a bug.

To test it, open the page from `chrome://inspect` on a debug build and run, in the console: `document.documentElement.dataset.mode` (`light` or `dark` by the hour), `getComputedStyle(document.documentElement).getPropertyValue('--narsil-css-skin')` (`1`), and `getComputedStyle(document.documentElement).getPropertyValue('--cds-page-bg')` (`#0f1a2c` at night, `#c9e7f1` by day). Then type `document.documentElement.dataset.mode = 'system'`: within a frame it should read the hour's mode again. To try the other half of the day, set the phone's clock by hand in Android's date and time settings, and come back to the app: the page changes on `visibilitychange`, the bars on `onResume`.

### Where the code and the README differ

- The README says the system bars follow the colors' change by the hour. The page follows within a minute; the bars follow only when the app comes back to the front, since `paintBars` runs in `onResume` and nowhere else. With the app open across 6:00 or 18:00, the bars keep the old ground until you leave and return.

## Going further

- [Guide 3](/en/android/conversation-band/) shows the page observer the mode shares with the band, and the style marks the band checks.
- [Guide 2](/en/android/webview-host/) explains document-start scripts and the order `PageScript` builds.
- [Narsil Skin](https://github.com/davshn/narsil-skin) has the full theme for the desktop app, with its wallpapers, which the app leaves out: the comment at the top of `skin.css` says it takes "none of that theme's wallpaper, waves or stars".
- The source is at [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
