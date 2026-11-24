---
title: The complication
description: 'How the Claude 5 h complication puts the 5-hour limit on any watch face, as a colored arc (RANGED_VALUE) or a short text, and how its data source is told to update.'
route: watch
order: 4
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/complication/LimitComplicationService.kt
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/res/values/strings.xml
  - repo: pet
    path: hooks/usage.ts
---

## What it does

A complication is the small piece of information a watch face shows besides the time: the date, the battery, the weather. Narsil Watch offers one, named **Claude 5 h**. It puts Claude's 5-hour limit on any watch face that has a free slot for it, so you see how much is spent every time you look at the time.

It comes in two forms, and the watch face chooses which:

- **An arc**, the `RANGED_VALUE` type: a ring or a bar filled from 0 to 100 %, with `62%` as its text and `5h` as its title. Its color goes from green to yellow to red as the limit fills.
- **A short text**, the `SHORT_TEXT` type: just `62%` with the title `5h`, in whatever style the watch face uses.

A tap on it opens the app. Before the watch has read a state with limits, it shows nothing: the watch face's "no data" look.

To add it, open the watch face editor on the watch, choose a complication slot, and pick **Claude 5 h** from the Narsil app's list.

> **Experimental.** The complication shows the 5-hour figure from the last state the watch kept, and it carries no age. The mod publishes that state only while you work away from the computer, within ntfy.sh's free daily room, and the watch asks for it at most every 15 minutes. A figure from yesterday still looks like a figure from now; open the app or the tile to see how old it is.

## How it works inside

All of it is in `complication/LimitComplicationService.kt`, 65 lines. It is a data source: the watch face asks it for data, and it answers from the state kept on the watch.

### A data source the system asks

On Wear OS, a watch face does not call your app. The system does, on behalf of the watch face, through a service your app declares. The manifest declares this one:

```xml
<service
    android:name=".complication.LimitComplicationService"
    android:exported="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/complication_label"
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
```

That excerpt is from `app/src/main/AndroidManifest.xml` in narsil-watch (GPL v3). Each part has a job:

- **`BIND_COMPLICATION_PROVIDER`**: only the system may bind the service. It is exported so the system can reach it, and protected so nothing else can.
- **`ACTION_COMPLICATION_UPDATE_REQUEST`**: the action the system uses to ask for data.
- **`SUPPORTED_TYPES`**: the two forms it offers, `RANGED_VALUE` and `SHORT_TEXT`. The watch face editor shows the complication only for slots that take one of them.
- **`UPDATE_PERIOD_SECONDS`**: 900 seconds, 15 minutes, the same rhythm as the refresh.
- **The label**, `@string/complication_label`, is `Claude 5 h` in `res/values/strings.xml`. That is the name in the editor's list.

### Answering from the stored state

The service extends `SuspendingComplicationDataSourceService`, from the complications data source library, so its answer is a Kotlin `suspend` function. From `LimitComplicationService.kt` in narsil-watch (GPL v3):

```kotlin
// Claude's 5-hour limit on the watch face: an arc that turns yellow at 60 %
// and red at 85 %, as Narsil colors it.
class LimitComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "fiveHour" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("fiveHour", "5 horas", 62.0, "#F5B400"))
```

Two things to notice:

- **No network.** `onComplicationRequest` reads `cached()`, the state kept by `StatusRepository` ([guide 2](/en/watch/reading-the-state/)). Like the tile, the complication never waits on ntfy.sh. The system may ask often, and the answer is always immediate.
- **No limit, no data.** Without a kept state, or with a state that has no `fiveHour` row (an older mod, or Claude Code has not reported it yet), the answer is `NoDataComplicationData()`. The watch face then shows its empty look instead of a false 0 %.

`getPreviewData` is what the watch face editor draws while you choose a complication: a made-up limit at 62 %, labeled `5 horas` (5 hours), in yellow. It is a fixed example, so the editor shows something meaningful even before the first reading.

### RANGED_VALUE or SHORT_TEXT

`data(type, limit)` builds the answer for the type the watch face asked for. The common parts first:

```kotlin
val percent = limit.percent.coerceIn(0.0, 100.0).toFloat()
val value = PlainComplicationText.Builder("${percent.toInt()}%").build()
val title = PlainComplicationText.Builder("5h").build()
val description = PlainComplicationText.Builder("Claude, límite de 5 horas: ${percent.toInt()} %").build()
```

- **The percent is clamped to 0–100** and turned into a `Float`, the type the ranged value takes.
- **`value`** is the text `62%`, a whole number.
- **`title`** is `5h`, short enough for the smallest slots.
- **`description`** is the content description, what a screen reader says: `Claude, límite de 5 horas: 62 %` (Claude, 5-hour limit: 62 %). Both builders require one. It is the accessible version of the complication.

A tap goes to the app through a `PendingIntent` for `MainActivity`, with `FLAG_IMMUTABLE` (no one can change the intent) and `FLAG_UPDATE_CURRENT`.

Then the two forms:

```kotlin
return when (type) {
    ComplicationType.RANGED_VALUE ->
        RangedValueComplicationData.Builder(percent, 0f, 100f, description)
            .setText(value)
            .setTitle(title)
            // seven equal steps (the most a ramp takes): green to 57 %,
            // yellow to 86 %, red after, close to Narsil's 60 / 85
            .setColorRamp(ColorRamp(intArrayOf(GREEN, GREEN, GREEN, GREEN, YELLOW, YELLOW, RED), false))
            .setTapAction(tap)
            .build()
    ComplicationType.SHORT_TEXT ->
        ShortTextComplicationData.Builder(value, description)
            .setTitle(title)
            .setTapAction(tap)
            .build()
    else -> null
}
```

Both excerpts are from `LimitComplicationService.kt` (GPL v3).

**`RANGED_VALUE`** takes a value, a minimum and a maximum: `percent`, `0f`, `100f`. The watch face draws the arc or bar itself, in its own style. What the app adds is a **color ramp**, the colors the filled part should take as the value grows.

**`SHORT_TEXT`** takes only the text and the description, with the title. No color: the watch face decides how text looks.

**Any other type** gets `null`. The manifest offers only these two, so the system should never ask for another, and `null` is the honest answer if it does.

### Why the ramp is close to, not exactly, 60 and 85

The tile paints each limit with the color the computer sent ([guide 3](/en/watch/tile/)). The complication cannot: a ranged value has no "color of this value" field. It takes a ramp, a list of colors spread across the range, and the watch face picks the color for the value.

The code's comment explains its choice. With `interpolated` set to `false`, the ramp is split into equal steps, one per color; seven is "the most a ramp takes". With seven steps over 0–100, each covers about 14.3 %. Four greens, two yellows, one red give:

| Range of the 5-hour limit | Color  | Hex          |
| ------------------------- | ------ | ------------ |
| 0 % to about 57 %         | Green  | `0xFF22B573` |
| About 57 % to about 86 %  | Yellow | `0xFFF5B400` |
| About 86 % to 100 %       | Red    | `0xFFF0435A` |

Narsil's own rule, `levelColor` in narsil-pet's `hooks/usage.ts`, turns yellow at 60 % and red at 85 %. So between 57 % and 60 %, the complication is already yellow while the tile is still green; and at exactly 85 %, the tile is red while the complication is still yellow. Three points at most, at the edges. The three colors themselves are the same hex values as `levelColor`'s, so the complication looks like the rest of Narsil.

The class comment, "an arc that turns yellow at 60 % and red at 85 %", describes the intent; the ramp comment beside it describes what the code does.

### How the complication is told to update

The system asks a data source for new data in two ways, and this app uses both.

1. **On a schedule.** `UPDATE_PERIOD_SECONDS` is 900 in the manifest, so the system may ask every 15 minutes. That is a request to the service, which answers from the kept state.
2. **On demand.** When the app has something new, it asks the system to call the service again. That is `Refresh.redraw` in `sync/Refresh.kt` (GPL v3):

```kotlin
fun redraw(context: Context) {
    TileService.getUpdater(context).requestUpdate(NarsilTileService::class.java)
    ComplicationDataSourceUpdateRequester
        .create(context, ComponentName(context, LimitComplicationService::class.java))
        .requestUpdateAll()
}
```

`ComplicationDataSourceUpdateRequester.create(...)` names this data source by its component, and `requestUpdateAll()` asks the system to request fresh data for every slot where it is shown, on every watch face. The same function asks the tile to redraw.

`redraw` is called at the end of each background refresh, by `RefreshWorker`, and after each refresh in the app ([guide 5](/en/watch/app-and-refresh/)). So the order is always: fetch the state, keep it, then tell the surfaces. When the system calls `onComplicationRequest`, the new state is already in `cached()`.

The schedule alone would be enough to keep the figure moving every 15 minutes. The on-demand request is what makes it change right away after you tap **Actualizar** (refresh) in the app.

## Build it with Claude

Ask Claude for a complication data source for one percentage. The ideas it must get right are that it answers from stored data, that it offers both a ranged value and a short text, and that "no data" is a real answer.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the author's prompt.

> In my Wear OS app `my-watch`, add a complication data source `LimitComplicationService` extending `SuspendingComplicationDataSourceService`. In `onComplicationRequest`, read the 5-hour limit from my `StatusRepository.cached()` (a `Limit` with `key` `fiveHour` and `percent`), and return `NoDataComplicationData()` when there is none. Support `RANGED_VALUE` (value clamped to 0–100, min 0, max 100, text like `62%`, title `5h`, a non-interpolated `ColorRamp` of seven colors: four green `0xFF22B573`, two yellow `0xFFF5B400`, one red `0xFFF0435A`) and `SHORT_TEXT` (the same text and title); return `null` for other types. Give both a content description, and a tap action that opens `MainActivity` with an immutable `PendingIntent`. Provide `getPreviewData` with a sample at 62 %. Declare it in the manifest with `BIND_COMPLICATION_PROVIDER`, `SUPPORTED_TYPES` `RANGED_VALUE,SHORT_TEXT` and `UPDATE_PERIOD_SECONDS` 900, and after each refresh call `ComplicationDataSourceUpdateRequester.create(...).requestUpdateAll()`.

### What to check in Claude's answer

1. `onComplicationRequest` reads the stored state and makes no network request.
2. Without a limit it returns `NoDataComplicationData()`, not a 0 %.
3. The value is clamped to 0–100 before it becomes the ranged value.
4. Each form has a content description, a screen reader's text.
5. The `PendingIntent` is `FLAG_IMMUTABLE`.
6. The manifest's `SUPPORTED_TYPES` lists exactly the types the code builds.
7. Something calls `requestUpdateAll()` after new data is kept, not before.

If a check fails, tell Claude what you see: "the complication says 0 % right after I install the app", which means "no data" is being answered as a zero.

### How the author asked for it

No recorded request exists for the complication. This is a reconstruction from the commit history:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations". The complication arrives with the rest of the app. Its message names it in one phrase: "a 5-hour complication".
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family". The README describes it: "The **Claude 5 h** complication shows the 5-hour limit on any watch face, as an arc (`RANGED_VALUE`) or as a short text."

Only the 5-hour limit got a complication. The code does not say why; the class comment calls it "Claude's 5-hour limit on the watch face", and it is the limit that changes fastest. The weekly limit is on the tile and in the app.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A complication for the weekly limit, written for this guide and adapted from `LimitComplicationService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). It uses the same library calls, assumes the repository's `StatusRepository` and `Limit`, and offers only the short text:

```kotlin
package com.example.mywatch.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.presentation.MainActivity

class WeekComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "week" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("week", "Semana", 40.0, "#22B573"))

    private fun data(type: ComplicationType, limit: Limit): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        val percent = limit.percent.coerceIn(0.0, 100.0).toInt()
        val tap = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return ShortTextComplicationData.Builder(
            PlainComplicationText.Builder("$percent%").build(),
            PlainComplicationText.Builder("Claude, límite semanal: $percent %").build(),
        )
            .setTitle(PlainComplicationText.Builder("sem").build())
            .setTapAction(tap)
            .build()
    }
}
```

Declare it in the manifest like the real one, with `SUPPORTED_TYPES` set to `SHORT_TEXT` only, and add it to `Refresh.redraw` with its own `ComplicationDataSourceUpdateRequester`.

## Common mistakes and how to test it

- **Fetching in `onComplicationRequest`.** The system calls it whenever it wants. Answer from the kept state.
- **Zero for "no data".** A false 0 % looks like plenty of room. `NoDataComplicationData()` is the truthful answer.
- **Types out of step.** If the manifest offers a type the code returns `null` for, the slot stays empty.
- **A ramp with too many colors.** The code's comment says seven is the most a ramp takes.
- **Expecting the exact thresholds.** With seven equal steps, the ramp changes at about 57 % and 86 %, not at 60 % and 85 %.
- **No content description.** The builders require one, and a screen reader depends on it.
- **Updating before keeping.** Call `requestUpdateAll()` after the new state is stored, or the system reads the old one.
- **Reading the figure as live.** It has no age. When it matters, open the tile or the app.

The complication has no automated test; the unit tests cover the state it reads ([guide 2](/en/watch/reading-the-state/)). On the watch:

1. Add **Claude 5 h** to a slot that takes a ranged value. The editor's preview shows 62 % in yellow.
2. Before any reading, the slot looks empty.
3. Run `/narsil movil prueba` in Claude Code, then open the app and tap **Actualizar**. The slot should change at once to your real 5-hour figure.
4. Try a slot that takes only short text: the same figure, without the arc.

### Where the code and the README differ

- The class comment says the arc "turns yellow at 60 % and red at 85 %". The ramp it builds changes at about 57 % and 86 %, as the comment next to the ramp says.
- The README says the complication shows the limit "as an arc (`RANGED_VALUE`) or as a short text". The watch face chooses which, by the type its slot takes.

## Going further

- Read `complication/LimitComplicationService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch).
- A `RANGED_VALUE` with `interpolated` set to `true` blends the colors smoothly instead of in steps. You would trade the clear thresholds for a gradient; try both on your watch face.
- The state carries `resetsAt` for the 5-hour limit. A complication could show "reinicia en 2 h" (resets in 2 h) instead of the percent, with `resetLabel` from `Display.kt`.
- Back to [the tile](/en/watch/tile/), or how the state is read: [Reading Narsil's state](/en/watch/reading-the-state/).
- Next: [The app and the refresh](/en/watch/app-and-refresh/), the list of conversations, the setup and the 15-minute job.
