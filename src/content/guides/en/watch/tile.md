---
title: The tile
description: 'How the Narsil · Claude tile draws the 5-hour and weekly limits as two rings in Narsil colors, with Narsil in the pose of your most important conversation and how old the reading is.'
route: watch
order: 3
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/tile/NarsilTileService.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/usage.ts
---

## What it does

Swipe sideways from the watch face and you reach the **Narsil · Claude** tile. In one glance it answers three questions: how much of Claude's limits is spent, whether a conversation is waiting for you, and how old that information is.

From the outside in:

- **The outer ring** is the 5-hour limit. The used part is drawn in its color, starting at the top and going clockwise; the rest is a dark track.
- **The inner ring**, thinner, is the weekly limit, drawn the same way.
- **Narsil in the middle**, in her current stage, in the pose of your most important conversation: working, waiting for you, done, idle or failed.
- **Four short lines under her**, for example:

```text
5 h 62%
sem 90%
1 te necesita
hace 12 min
```

The first two are the limits ("sem" for "semana", week), each in its own color. The third is about your conversations: `1 te necesita` (1 needs you), `2 te necesitan` (2 need you), or, when none is waiting, the state of the first one in lowercase, such as `trabajando` (working). With no conversations it says `sin conversaciones` (no conversations). The last line is the age of the reading: `ahora` (now), `hace 12 min` (12 minutes ago), `hace 3 h`, `hace 2 d`.

Before the watch has any state, the limits read `5 h –` and `sem –`, the rings are empty, and the last line says `configúrame` (set me up). A tap anywhere on the tile opens the app.

> **Experimental.** The tile draws the last state the watch kept, and that state is only as fresh as the mod's last publication: the mod publishes only while you work away from the computer, within ntfy.sh's free daily room. The tile asks for a new reading at most every 15 minutes. Read the age line before the numbers.

## How it works inside

Everything lives in `tile/NarsilTileService.kt`, with the wording and colors in `domain/Display.kt`. The pose and the colors are decided by the mod on your computer; the tile only draws them.

### A TileService that answers with a layout

A Wear OS tile is not a screen you program with Compose. It is a service, `TileService`, that the system asks for a description of the layout, built with the ProtoLayout library. The system draws it and calls the service again when it wants a new one. The manifest declares it with the `BIND_TILE_PROVIDER` permission and action, the label `@string/tile_label` ("Narsil · Claude") and a preview image, `@drawable/narsil_preview`.

The service answers two requests: the tile (its layout) and its resources (the images it names). Both return a `ListenableFuture`, and the code writes them as Kotlin coroutines with `SuspendToFutureAdapter.launchFuture`. From `NarsilTileService.kt` in narsil-watch (GPL v3):

```kotlin
override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
    SuspendToFutureAdapter.launchFuture {
        if (System.currentTimeMillis() - repo.checkedAt > STALE_MS) Refresh.now(this@NarsilTileService)
        val state = repo.cached()
        TileBuilders.Tile.Builder()
            .setResourcesVersion(resourcesVersion())
            .setFreshnessIntervalMillis(STALE_MS)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(state)))
            .build()
    }
```

### When it asks for a new reading

That first line matters. `STALE_MS` is 15 minutes. If the watch has not heard from ntfy.sh for longer than that, the tile calls `Refresh.now`, which queues one background refresh with WorkManager. It does **not** wait for it. It draws at once from `repo.cached()`, the state kept on the watch.

When the background refresh finishes, it asks the system to redraw the tile ([guide 5](/en/watch/app-and-refresh/)). The system calls `onTileRequest` again; by then `checkedAt` is fresh, so no second refresh is queued, and the tile draws the new state. Two passes, and the tile never shows a spinner.

`setFreshnessIntervalMillis(STALE_MS)` also tells the system the layout is worth asking for again after 15 minutes, so the age line moves even when nothing else happens.

### Two rings

Each ring is one ProtoLayout `Arc` with two `ArcLine`s: the used part and the track. From `NarsilTileService.kt` (GPL v3):

```kotlin
// A full ring: the used part in the limit's color, the rest as track.
private fun ring(limit: Limit?, thickness: Float): LayoutElement {
    val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
    val arc = LayoutElementBuilders.Arc.Builder()
        .setAnchorAngle(degrees(0f))
        .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
    if (used > 0f) arc.addContent(arcLine(used, thickness, limit?.let { parseColor(it.color) } ?: Palette.DIM))
    if (used < 360f) arc.addContent(arcLine(360f - used, thickness, Palette.TRACK))
    return arc.build()
}
```

Reading it:

- **Percent to degrees.** A full circle is 360 degrees, so 1 % is 3.6. The percent is clamped to 0–100 first, so a strange value never draws more than one turn.
- **Where it starts.** The anchor is 0 degrees, the top of the screen, and `ARC_ANCHOR_START` means the arc starts there and runs clockwise.
- **Two pieces, never an empty one.** At 0 % there is only track; at 100 %, only color.
- **No limit, no color.** Without a reading, `percent` counts as 0, so the whole ring is track.

The layout puts the rings inside each other. The outer `Box` fills the tile, has the dark background `Palette.BG`, and holds the 5-hour ring, 7 dp thick (`RING`). Inside it, a second `Box` with a padding of `RING + GAP` (7 + 3 dp) holds the weekly ring, 5 dp thick (`RING_INNER`), and the column in the middle. The padding is what keeps the inner ring 3 dp inside the outer one on any screen size.

### The colors: decided on the computer, read on the watch

The README says the rings are "colored as Narsil colors them: green, yellow from 60 %, and red from 85 %". Where that rule lives is worth knowing, because it is not on the watch.

The mod decides the color of each limit when it publishes the state. `levelColor` in narsil-pet's `hooks/usage.ts` (GPL v3):

```ts
export function levelColor(percent: number): string {
  return percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573'
}
```

`watchLimits` in `hooks/phone.ts` puts the result in each limit's `color` field ([guide 2](/en/watch/reading-the-state/)). The watch only turns that text into a color, with `parseColor` in `domain/Display.kt` (GPL v3):

```kotlin
// A #RRGGBB color as the PC sends it; dim for anything else.
fun parseColor(hex: String): Int {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return Palette.DIM
    val rgb = digits.toLongOrNull(16) ?: return Palette.DIM
    return (0xFF000000L or rgb).toInt()
}
```

So a 62 % limit is yellow on the watch because it is yellow on the computer. If the mod ever changes its thresholds, the watch follows with no update. A color that is not six hex digits becomes `Palette.DIM`, a muted gray, instead of an error; the test "reads a level color, and falls back to dim on noise" checks `#22B573` and the word `rojo` (red).

`Display.kt` holds the colors the watch decides itself. The comment at its top: "How the watch says things, in Narsil's words and colors (overlay.html, dark theme). Pure functions, so the tile, the complication and the app read the same." Its `Palette` has the background `0xFF16182A`, the text `0xFFECEBF3`, the dim gray `0xFF9A98AD`, the track `0xFF2A2D45` and the accent `0xFF7C6CF0`. Its `statusColor` gives each conversation state the color Narsil uses for it: `working` blue `0xFF3B8BFF`, `idle` gray `0xFF8A90A6`, `waiting` yellow `0xFFF5B400`, `done` green `0xFF22B573` and `error` red `0xFFF0435A`. An unknown status falls back to the idle gray.

### Narsil in the middle: the drawing

The column in the middle starts with an `Image` 40 dp wide and 66 dp tall, which names a resource, `ART_ID` (`"narsil"`). The picture itself comes from `onTileResourcesRequest`:

- **If the watch has downloaded a drawing**, `repo.art()` returns its bytes, and they go in as an inline image resource.
- **If not yet**, the tile uses the drawing that ships with the app, `R.drawable.narsil_preview`.

The drawing comes from the [narsil-pet](https://github.com/davshn/narsil-pet) repository on GitHub. `StatusRepository` downloads the URL in the state's `art` field, only if it starts with `https://raw.githubusercontent.com/davshn/narsil-pet/`, and keeps it as `art.png` ([guide 2](/en/watch/reading-the-state/)). The README credits it: "Narsil's art is © its author and comes from the narsil-pet repository."

The system caches resources by a version string, so the tile must change the version whenever the picture changes. `resourcesVersion()` is the hash of the picture's bytes, or `"preview"` without one:

```kotlin
private fun resourcesVersion(): String = repo.art()?.contentHashCode()?.toString() ?: "preview"
```

New pose, new bytes, new version, and the system asks for the resources again. Same pose, same version, and nothing is reloaded.

### Which pose: the most important conversation

The tile does not choose the pose. The mod does, and names it in the URL. In `sendStatus` (`hooks/register.tsx` in narsil-pet):

```ts
art: artUrl(POSE[list[0]!.status], stageOf(levelOf(earned).level)),
```

Three pieces decide that URL:

1. **The list is ranked.** `list` comes from `fleetOf` in `hooks/fleet.ts`, which sorts every open conversation by `RANK`, with the comment "An error first, then what needs you, what works, what finished": `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Between two of the same rank, the one that changed most recently goes first. So `list[0]` is the most important conversation: any error beats a question, any question beats work in progress.
2. **The pose is the state's.** `POSE` in `hooks/sprite.ts` names the pictures: `trabajando`, `parada`, `necesita`, `terminado`, `error`.
3. **The stage is Narsil's growth.** `stageOf` in `hooks/xp.ts` gives stage 1 to 5 from her level, starting at levels 1, 5, 10, 20 and 35.

`artUrl` in `hooks/phone.ts` joins them: the base `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets`, then `etapa<stage>/` for stages 2 to 5 ("etapa" is "stage"), then `<pose>-oscuro.png`. The watch always gets the dark (`oscuro`) drawing, which suits the tile's dark background. A conversation that failed, at stage 3, is `.../assets/etapa3/error-oscuro.png`.

### The four lines of text

Under the drawing, four `Text` elements, each one line (`setMaxLines(1)`):

```kotlin
.addContent(text(limitLine(fiveHour, "5 h"), 13f, fiveHour?.let { parseColor(it.color) } ?: Palette.DIM, bold = true))
.addContent(text(limitLine(week, "sem"), 11f, week?.let { parseColor(it.color) } ?: Palette.DIM))
.addContent(text(fleetLine(state), 11f, fleetColor(state)))
.addContent(text(state?.let { ageLabel(it.at, System.currentTimeMillis() / 1000) } ?: "configúrame", 9f, Palette.DIM))
```

Those lines are from `NarsilTileService.kt` (GPL v3). The sizes give the hierarchy: the 5-hour figure at 13 sp and bold, because it changes fastest and runs out first; the week and the conversations at 11 sp; the age at 9 sp in gray.

- **`limitLine`** writes `5 h 62%`, with the percent cut to a whole number (`toInt()`), or `5 h –` without a limit.
- **`fleetLine`** counts the conversations that need you with `needsYou` from `Display.kt`, which is `sessions.count { it.status == "waiting" }`. One gives `1 te necesita`, several give `2 te necesitan`. With none waiting, it shows the first conversation's label in lowercase; with no conversations, `sin conversaciones`.
- **`fleetColor`** colors that line with the first conversation's state color, so a red line means the most important conversation failed.
- **`ageLabel`** measures from `at`, the moment the computer sent the state, not the moment the watch read it. That is the honest age: a state read a minute ago but sent three hours ago says `hace 3 h`.

`ageLabel`, from `Display.kt` (GPL v3):

```kotlin
// How old the state is: the PC publishes only while you are away.
fun ageLabel(at: Long, nowSeconds: Long): String {
    val minutes = (nowSeconds - at).coerceAtLeast(0) / 60
    return when {
        minutes < 1 -> "ahora"
        minutes < 60 -> "hace $minutes min"
        minutes < 24 * 60 -> "hace ${minutes / 60} h"
        else -> "hace ${minutes / (24 * 60)} d"
    }
}
```

`coerceAtLeast(0)` protects against a watch clock a little behind the computer's: a state "from the future" reads `ahora`, not a negative age.

### A tap opens the app

The outer `Box` has a `Clickable` whose action is a `LaunchAction` for `MainActivity`, in the app's own package. The whole tile is one large target, which suits a small round screen.

## Build it with Claude

Ask Claude for a tile that draws limits as rings from a stored state. The ideas it must get right are that the tile never waits on the network, and that the color comes from the state rather than from thresholds on the watch.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Wear OS app `my-watch`, add a `TileService` with ProtoLayout. It reads the stored state from my `StatusRepository.cached()` (a `NarsilState` with `limits` of `key` `fiveHour` and `week`, each with `percent` and a `#RRGGBB` `color`, and `sessions` with `status` and `label`). Draw the 5-hour limit as an outer ring 7 dp thick and the week as an inner ring 5 dp thick, 3 dp inside it; each ring is an `Arc` anchored at 0 degrees with `ARC_ANCHOR_START`, the used part `percent × 3.6` degrees in the limit's color and the rest in a track color. In the middle, an image resource with the stored picture, falling back to a bundled drawable, with the resources version set to a hash of the picture's bytes. Under it, `5 h 62%`, `sem 90%`, how many sessions have status `waiting`, and the age from the state's `at` field. If the last check is older than 15 minutes, queue a background refresh without waiting for it. A tap opens `MainActivity`. Put the wording and the color parsing in pure functions with JUnit tests.

### What to check in Claude's answer

1. `onTileRequest` draws from the stored state and never awaits a network call.
2. The ring's degrees are the percent, clamped to 0–100, times 3.6, and neither `ArcLine` is added with a length of 0.
3. The color comes from the limit's `color` field through a parser that falls back to a neutral color, not from thresholds hard-coded in the tile.
4. The resources version changes when the picture changes.
5. The age is measured from the state's `at`, not from when the watch read it.
6. Without a state, the tile still draws: empty rings, dashes and a hint to set it up.

If a check fails, tell Claude what you see: "the tile shows the old pose even after the app shows the new one", which points to a resources version that does not change.

### How the author asked for it

No recorded request exists for the tile. This is a reconstruction from the commit history:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch". It adds `limits` with each limit's `color` from `levelColor`, and `sessions` ranked by importance, which is what lets the tile take both from the state.
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations". Its message opens with the tile: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose".

The file's own comment is the shortest statement of the design: "The tile: the 5-hour limit as the outer ring, the week as the inner one, Narsil in the middle in her current pose, and who needs you."

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A reduced tile with one ring and one line, written for this guide and adapted from `NarsilTileService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). It uses the same ProtoLayout and Tiles calls as that file, and assumes the `StatusRepository`, `Limit`, `Palette` and `parseColor` from the repository's `data/` and `domain/` folders:

```kotlin
package com.example.mywatch.tile

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.degrees
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.domain.Palette
import com.example.mywatch.domain.parseColor
import com.google.common.util.concurrent.ListenableFuture

class LimitTileService : TileService() {
    private val repo by lazy { StatusRepository(this) }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        SuspendToFutureAdapter.launchFuture {
            val fiveHour = repo.cached()?.limits?.find { it.key == "fiveHour" }
            TileBuilders.Tile.Builder()
                .setResourcesVersion("1")
                .setFreshnessIntervalMillis(15 * 60_000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(fiveHour)))
                .build()
        }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        SuspendToFutureAdapter.launchFuture {
            ResourceBuilders.Resources.Builder().setVersion(requestParams.version).build()
        }

    private fun layout(limit: Limit?): LayoutElement {
        val color = limit?.let { parseColor(it.color) } ?: Palette.DIM
        val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
        val arc = LayoutElementBuilders.Arc.Builder()
            .setAnchorAngle(degrees(0f))
            .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
        if (used > 0f) arc.addContent(arcLine(used, color))
        if (used < 360f) arc.addContent(arcLine(360f - used, Palette.TRACK))
        val label = LayoutElementBuilders.Text.Builder()
            .setText(limit?.let { "5 h ${it.percent.toInt()}%" } ?: "5 h –")
            .setMaxLines(1)
            .setFontStyle(LayoutElementBuilders.FontStyle.Builder().setSize(sp(13f)).setColor(argb(color)).build())
            .build()
        return LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(ModifiersBuilders.Background.Builder().setColor(argb(Palette.BG)).build())
                    .build(),
            )
            .addContent(arc.build())
            .addContent(label)
            .build()
    }

    private fun arcLine(length: Float, color: Int) =
        LayoutElementBuilders.ArcLine.Builder()
            .setLength(degrees(length))
            .setThickness(dp(7f))
            .setColor(argb(color))
            .build()
}
```

It has no image, so its resources are empty and the version never changes. To add Narsil, follow the real file: an `Image` with a resource id in the layout, the bytes in `onTileResourcesRequest`, and a version that is the hash of those bytes. Declare the service in the manifest as [guide 1](/en/watch/what-it-is/) shows.

## Common mistakes and how to test it

- **Awaiting the network in `onTileRequest`.** The system expects an answer quickly. Draw from the stored state and refresh in the background.
- **Refreshing on every tile request.** Each swipe would cost a request. The 15-minute check keeps it to one per window.
- **A fixed resources version.** The picture never updates, because the system keeps the cached one.
- **Hard-coding 60 and 85 on the watch.** It works until the mod changes its rule. Paint the color the state carries.
- **A zero-length arc.** Add the used part only when it is above 0 degrees, and the track only below 360.
- **Measuring the age from the read.** The age that matters is since the computer sent it.
- **Forgetting the empty state.** Before the first reading, the tile must still draw and tell you to set it up.

To test the logic without a watch, run the unit tests:

```bash
./gradlew :app:testDebugUnitTest
```

`DisplayTest.kt` covers what the tile prints and paints: "counts the conversations that need you" (two `waiting` among four), "says how old the state is" (`ahora`, `hace 12 min`, `hace 3 h`, `hace 2 d`), "colors a status as Narsil does" and "reads a level color, and falls back to dim on noise". The layout itself has no automated test.

On the watch: install the app, add the tile, and run `/narsil movil prueba` in Claude Code. Open the app once so it refreshes, then swipe to the tile. It should show the new age, and the pose of your most important conversation.

### Where the code and the README differ

- The README says the watch reads the state "whenever you open the app or the tile". The tile asks only when the last check is more than 15 minutes old, and draws the kept state before the new one arrives.
- A comment in `NarsilTileService.kt` says "the art Narsil publishes is 91 x 150", and declares the inline image with those sizes (`ART_W`, `ART_H`). The dark drawings in narsil-pet's `assets/` today are all 150 pixels tall, but between 91 and 106 pixels wide, depending on the pose and stage. The bundled `narsil_preview.png` is 91 x 150. The tile shows the picture in a fixed 40 x 66 dp box either way.
- The README says Narsil sits "above how many conversations need you". When none needs you, the line shows the first conversation's state instead, which the README does not mention.

## Going further

- Read `tile/NarsilTileService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch).
- The ring could mark where the limit resets: the state carries `resetsAt` for each limit, and the tile does not use it yet.
- Since the count of conversations that need you comes from at most 8 sessions, a computer with many failed conversations could push a waiting one off the list. The ranking puts errors first, so that would take nine or more conversations.
- How the state reaches the watch: [Reading Narsil's state](/en/watch/reading-the-state/). The mod's side: [Alerts on your phone and watch](/en/mods/pet/phone-and-watch/).
- Next: [The complication](/en/watch/complication/), the 5-hour limit on any watch face.
