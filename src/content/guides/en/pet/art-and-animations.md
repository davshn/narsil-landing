---
title: Drawing and animations
description: 'How Narsil is drawn: one pose per state, light and dark art in one SVG, animated loops made from AI videos, and the 131072-character limit of the band.'
route: pet
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/art.ts
  - repo: pet
    path: tools/build-art.ps1
  - repo: pet
    path: tools/anim-sources.ps1
  - repo: pet
    path: tools/encode-anim.ps1
  - repo: pet
    path: tools/build-animated.ps1
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## What it does

Outside the terminal, the band above the prompt shows Narsil, a chibi sea serpent, in a pose that matches the state of the conversation. She greets a new conversation, dozes while it waits for you, works while Claude works, leans in when she needs you, celebrates when the turn is done and looks worried at an error.

Each pose is drawn twice, once for a light background and once for a dark one, and the band picks the right one from your system's color scheme. Each pose is also a short animated loop: she actually moves, breathes, blinks and sways, instead of being a still picture with effects around it.

Narsil also grows. As she earns experience she passes through five stages, from a hatchling to an adult, and each stage has its own set of poses. Level-ups and new stages get their own celebration over the picture.

On the terminal there is no picture. The band draws a small text face for each mood instead, such as `~(-ᴗ-)~ z` while she sleeps.

The drawing is the part people notice first, and it does real work: the pose and the colored glow around her say the state before you read a word.

## How it works inside

### Where the pictures come from

The art is painted pictures, not vector shapes. They live as image files in `assets/raw/<pose>-<claro|oscuro>.png` for the hatchling and in `assets/raw/etapa2` to `assets/raw/etapa5` for the later stages (`claro` is light, `oscuro` is dark). The poses are named after the states: `hola`, `parada`, `trabajando`, `necesita`, `terminado` and `error`, plus a `base` pose used as a fallback.

A mod cannot read image files at draw time, so the pictures are turned into code. `tools/build-art.ps1`, a Windows PowerShell script, removes each picture's plain background (white or transparent, working in from the edges), crops it to the character, scales it to 150 pixels high, and writes `hooks/art.ts` and the files under `hooks/art/` with every picture embedded as data. Its comments say it also removes "any fake 'transparency' checkerboard an image generator painted" and a light frame line "an image generator drew"; the repository does not record which image tool was used.

`hooks/art.ts` itself is short and generated: it imports one module per stage and theme and exposes `ART`, indexed by stage, then theme, then pose. Its first line says "do not edit by hand".

### Choosing a picture

`art` in `hooks/sprite.ts` picks the picture for a mood, a theme and a stage:

1. The wanted pose is `hola` for the greeting, and otherwise the pose of the mood's state (`POSE`).
2. If an animated loop exists for that stage, theme and pose (`ANIMATED`), it wins.
3. Otherwise it looks for the still picture, falling back to the stage's `base` pose, then to earlier stages, then to the other theme.

The fallback chain is the reason the art could be added stage by stage: a stage that was not drawn yet still showed something sensible.

### One SVG, two themes

`sprite` returns one SVG document that holds both themes. The light picture sits in a group with the class `th-claro`, the dark one in `th-oscuro`, and a CSS rule inside the SVG shows one or the other:

```css
.th-oscuro {
  display: none;
}
@media (prefers-color-scheme: dark) {
  .th-claro {
    display: none;
  }
  .th-oscuro {
    display: inline;
  }
}
```

The mod never needs to know the theme. The surface that draws the SVG applies the viewer's color scheme, so the same drawing is right on a light desktop and a dark phone at the same time.

### Making a still picture move

Before the animated loops existed, all the life came from CSS inside the SVG, and that code is still used for any pose without a loop. The comment at the top of `hooks/sprite.ts` lists the layers:

- The whole picture swims, bobs, leaps or trembles with CSS transforms, at a pace set by her stage (`STAGE_MOTION`, `motion`), with a shadow and splashes in step.
- Her body is cut across in nine bands that only meet (`cuts`, `bands`), and each band sways with a small lag, so a wave runs from the head to the tail. From the neck up she is one band, so no cut crosses her face.
- Around her: a pulsing aura in the state's color (`aura`), bubbles, water rings, confetti when she is done, and props for each mood.
- `@media (prefers-reduced-motion: reduce)` turns every animation off.

The commit history explains the "bands that only meet" rule. An earlier approach laid a second, warped copy of the picture over the first, and fixes such as `9f9cc75` "fix: draw Narsil as one sharp picture so no part of her shows twice" and `6ac340e` "fix: draw Narsil's head once instead of a turning copy over the body" removed the doubled look.

### The animated loops

Each pose now also has a real animated loop: an animated WebP image made from a short AI-generated video, embedded as data in `hooks/art/anim/` and gathered by `hooks/art/animated.ts`. When `art` finds a loop, `picture` draws it whole and skips the band cutting, because the loop already moves by itself. The aura, badge and effects still go around it.

### The size limit

Everything above has to fit in one string. The `Svg` element's `source` is, in the words of the 2.1.325 types, "The SVG document, `<svg ...>...</svg>`, at most 131072 characters." Both themes share that budget, because both are in the same drawing.

That limit shaped the loops:

- `tools/encode-anim.ps1` searches for the best quality that keeps a loop within 38 KB (`-TargetKB 38`).
- `tools/build-animated.ps1` refuses any loop over 40 KB (`$MAX_BYTES`). Embedded as base64 data, two 40 KB loops take about 109,000 characters, which leaves room for the rest of the drawing.
- A test in `tests/narsil.test.tsx` proves it: "two loops of the largest size tools/build-animated.ps1 lets in, one per theme, still fit the band at every stage and celebration".
- `tools/build-animated.ps1` writes one module per stage and theme because, as its comment says, "the engine reads no file over 1 MiB".

The floating window has no such limit, so it shows a sharper copy of each loop. `pictureDefs` marks a loop with `data-loop="<name>"`, and the window's page swaps it for a 200-pixel version that the local server serves from `assets/anim-hq`.

### Cost at draw time

A full drawing is large (the code says "some 100 KB"), and the band and the window ask for the same one again and again. `sprite` keeps the last eight drawings in a `Map` keyed by mood, stage and milestone, and `pushOverlay` in `hooks/register.tsx` sends the SVG to the window only when it changed (commit `19106d1` "perf: reuse Narsil's drawing and send it to the window only when it changes").

## Build it with Claude

Ask Claude for a function that builds one SVG drawing of your pet for the band, with a light and a dark picture inside. The one idea Claude must get right: the whole drawing, both themes included, must stay within the band's limit of 131072 characters.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not one of the prompts recorded in narsil-pet.

> In my Claude Code mod, add a function `petSvg(status)` that returns one SVG document for the `Svg` element of the `AbovePrompt` band. It holds a light and a dark version of my character (data URLs from `hooks/art.ts`), shows the right one with a `prefers-color-scheme` media query inside the SVG, and gives each status a small CSS animation (bob while working, slow breathing while idle, a short shake on error). Turn animations off under `prefers-reduced-motion`. Throw if the document is longer than 131072 characters, and add a test that every status, in both themes, fits. On the terminal, draw a text face instead, since the terminal has no `Svg`.

### What to check in Claude's answer

1. The SVG holds both pictures, and a `prefers-color-scheme` media query inside the SVG shows one of them. The mod itself never chooses the theme.
2. The code checks the length of the finished drawing against 131072 characters, and a test checks it for every status in both themes.
3. A `prefers-reduced-motion: reduce` rule turns every animation off.
4. On the terminal (`e.surface === 'terminal'`), the band draws a text face, because the terminal has no `Svg`.
5. The animation moves the picture itself, not a warped copy laid over it.

If a check fails, tell Claude what you see: "on a dark desktop the band shows the light picture", or "the band shows nothing for one status".

### How the author asked for it

There are two parts to this story. The still art and its CSS motion came first, and their requests were not recorded. The animated loops have a public task log, `odd/tasks/animated-poses.md` in narsil-pet, which quotes the author's requests word for word.

#### Reconstruction from the commit history (still art)

From `git log -- hooks/sprite.ts hooks/art.ts tools/build-art.ps1`:

- `d48c95c` (2026-10-30) "feat(art): add painted art for each state and its build tool", then `d31a6ba` "feat(sprite): draw Narsil from the art with layered animations".
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" and `7a964d1` "feat: draw Narsil as a hatchling at stage 1 and split the art per stage".
- On 2026-10-31, one commit per stage and theme, such as `ff02847` "feat: draw stage 3 dark art" and `eed13b0` "feat: draw stage 5 light art".
- `9f9cc75` and `6ac340e` (2026-10-31), the fixes for the doubled picture described above.
- `e79c512` (2026-11-09) "feat: make Narsil's body undulate and her rest less mechanical". Its message describes the bands that "only meet" and says that at rest she "only starts to snore after a minute".

#### The recorded request for the animated loops

The log's first entry, L1, dated 2026-11-15:

> "quiero cambiar las imagenes de narsil, por unas realmente animadas, donde tenga movimiento la serpiente, esto es posible? podriamos usar mi suscripcion de gemini plis para generar las animaciones, estoi haria que el mod consumiera demasiados recursos?"

In English: the author wants to replace Narsil's pictures with truly animated ones where the serpent moves, asks whether that is possible, suggests using their Gemini subscription to generate the animations, and asks whether this would make the mod use too many resources.

The specs of the same file quote the corrections that followed, and each one changed the result:

- Spec S2: "dile que no necesitas sonido, la oido sonar y chapoteando el agua y no es necesario" (tell it no sound is needed; the author heard it make noise and splash water, and that is not necessary). The prompt for the video now asks for silence, and the encoder drops any audio track.
- Spec S3: "me gustaria que tuviera el color original, y sobretodo que se viera en la banda de chat" (the author wants the original colors and, above all, to see it in the chat band). This made the 131072-character limit the main constraint.
- Spec S4: "la version idle que es la dormida parpadea, lo que es curioso" (the idle version, the sleeping one, blinks, which is odd). Each loop is now generated from its own pose's picture, and the sleeping pose's prompt says her eyes stay closed.
- Spec S5: "no podemos directamente generarla con menos tamano para ahorrar limite? se ve algomas delgado y algo pixelado" (could the video be generated smaller to save room? it looks thinner and pixelated). The log's answer: the video's output size does not change the cost; subtle motion and the encoder settings do.
- L4 (2026-11-15): "si me agrada, vamos a cambiar todos" (I like it, let's change all of them). That became 60 loops: six poses, five stages, two themes.
- L6 (2026-11-15): "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?" (in the external window, can we show the video uncut, so it looks sharper?). This produced the sharp copies in `assets/anim-hq`.

The log also records how the videos were made. At first the videos came from Veo in the Gemini app, and the quota ran out after two videos (L4). In L8 (2026-11-16) the author asked Claude to make the videos in their browser and to stop whenever Veo's limit came. In L9 (2026-11-16) the author asked "antes de continuar, no es posible avanzar en los videos usando flow?" (before going on, can we move forward on the videos with Flow?). Flow had its own credits, and its Frames mode, with her picture as both the first and the last frame, gave a closed loop. In L10 (2026-11-16) the author asked for better quality or more motion and then said "prioriza la nitidez y luego mas movimiento" (prioritize sharpness, then more motion). The result, as L10 records: all 60 loops made in Flow, 3 seconds at 360p, with prompts asking for clear motion of her body, head and fins while the water stays calm, because churning water cost the band's loop its sharpness.

#### The prompt given to the video model

The prompt that went to the video model is recorded too, because a script writes it. `tools/anim-sources.ps1` prepares, for each missing loop, her picture on pure green (`#00FF00`) and a text file with the prompt from `Get-Prompt`. The prompt begins:

> "Create a SILENT video from this image: no audio at all, no music, no sound effects, no water sounds. Animate this exact character as a seamless loop of ..."

and goes on to ask for calm water, an identical character, a locked camera, the same flat green background, and a last frame that matches the first. The middle part comes from a table of motions per pose; for the sleeping pose it says her eyes "stay CLOSED the whole time", which is spec S4 turned into an instruction.

Then `tools/encode-anim.ps1` keys out the green (`colorkey=0x00FF00`), drops the audio, crops to her, and runs a binary search over the WebP quality to land under the size target. `tools/build-animated.ps1`, which it calls, embeds the result.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A reduced version, written for this guide and checked against the 2.1.325 types. The structure (two themes in one SVG, the size check, the terminal face) is adapted from `hooks/sprite.ts` and `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Narsil's drawings are GPL v3 too: if you use them, keep the attribution and a link to the repository.

```ts
// hooks/drawing.ts
const MAX_SVG = 131072 // the Svg element's limit for `source`

export function petSvg(lightSrc: string, darkSrc: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 120" width="150" height="120">` +
    `<style>.dark{display:none}` +
    `@media (prefers-color-scheme: dark){.light{display:none}.dark{display:inline}}` +
    `.bob{transform-box:fill-box;transform-origin:50% 100%;animation:bob 2s ease-in-out infinite}` +
    `@keyframes bob{50%{transform:translateY(-3px)}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>` +
    `<g class="bob">` +
    `<image class="light" href="${lightSrc}" x="25" y="4" width="100" height="112"/>` +
    `<image class="dark" href="${darkSrc}" x="25" y="4" width="100" height="112"/>` +
    `</g></svg>`
  if (svg.length > MAX_SVG)
    throw new Error(`the drawing has ${svg.length} characters; the band takes ${MAX_SVG}`)
  return svg
}
```

Drawing it, with the terminal fallback:

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  if (e.surface === 'terminal') {
    const { Text } = $.ui.resolve(e)
    return <Text>~(•ᴗ•)~ working</Text>
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={petSvg(LIGHT, DARK)} alt="My pet: working" width={132} height={118} />
})
```

`LIGHT` and `DARK` stand for your own embedded pictures, for example `data:image/png;base64,...` strings generated by a build script the way `tools/build-art.ps1` writes `hooks/art.ts`. Narrowing on `e.surface` first matters: the terminal's element table has no `Svg`.

## Common mistakes and how to test it

- **Going over the limit without noticing.** A drawing past 131072 characters is not drawn. Base64 data grows by a third, so a 40 KB image costs about 54,600 characters, and two themes double it. Check the length in code and in a test, as Narsil does with "every state is drawn from the art, light and dark, within the Svg size limit".
- **Choosing the theme in the mod.** The mod cannot see the viewer's color scheme, and several surfaces may draw at once. Put both themes in the SVG and let CSS choose.
- **Animating a copy over the picture.** A warped duplicate shows through as a double image. Narsil's fixes (`9f9cc75`, `6ac340e`) moved to hard-edged bands that only meet.
- **Animating a pose into another pose.** The log's spec S4 records the sleeping pose blinking. Generate each loop from its own pose and say in the prompt what must not change.
- **Sound and busy backgrounds in AI video.** Ask for silence and drop the audio anyway (spec S2). Calm water keeps the loop sharp at a small size (L10). Make the loop close on itself: Flow's Frames mode with the same first and last frame did that (L9).
- **Soft edges that cost too much.** The log's L2 records that a soft, blurred alpha edge cost about 45 KB; the band's loops use a hard edge shrunk by one pixel, which also removes the green fringe. The window's sharp copies use the soft edge.
- **Files the engine will not load.** Modules over 1 MiB are refused, so split embedded art across files (one per stage and theme in Narsil).
- **Redrawing on every heartbeat.** Cache drawings and send them only when they change.

To test, `claude plugin test .` runs Narsil's drawing tests in `tests/narsil.test.tsx`, among them "Narsil moves visibly in every state" and "a pose with an animated loop shows the loop, whole and within the Svg size limit, and its still picture elsewhere". `node tests/overlay-drawing.check.cjs` checks the floating window's drawing. Narsil's repository also has `tools/preview.mjs`, added as "chore: add a local preview page for every animation" (`75e1525`), for looking at every pose at once.

## Going further

- `draw` in `hooks/sprite.ts` assembles the whole document: water, the milestone layer behind, the shadow, both themes' pictures, bubbles, drops, and either a celebration or the mood's props.
- `LAYOUT` holds, for each pose, where her head is, so the badge and rings land on it; `place` scales each picture into the 150 by 120 box.
- `props` adds the small objects of each mood, and `ASLEEP_AFTER_S` waits a minute before she starts to snore.
- `celebration`, `behind` and `grows` draw a new level and a new stage over her state.
- `FACE` is the terminal's text face for each of the twelve moods.
- `tools/anim-sources.ps1`, `tools/encode-anim.ps1` and `tools/build-animated.ps1` are the loop pipeline; the README's "Desarrollo" section lists the exact steps and Flow settings, and `tools/ffmpeg.ps1` locates ffmpeg.
- `overlay/server.cjs` serves the sharp loops at `GET /anim/<loop>.webp` for the floating window, covered in a later guide.
