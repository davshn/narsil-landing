# Narsil Workshop — experimental app paths (Narsil for Android and Narsil Watch)

Objective: replace the experimental "Narsil in Claude" path (the private browser extension) with Narsil for Android (`davshn/narsil-android`, MIT) and add a second experimental path for Narsil Watch (`davshn/narsil-watch`, GPL v3). One PR on branch `claude/charming-bohr-ha896a`. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Owner, 2026-11-24: "Vamos a cambiar la sesión experimental de narsil en celulares por la nueva versión narsil-android además vamos a agregar una sección nueva experimental también narsil-watch revisa los repositorios y agregarlo a la landing".
- S2. Both paths are experimental and live at `/[locale]/android/` and `/[locale]/watch/` (owner: "/android/ y /watch/"); the old `/[locale]/mods/claude/*` URLs redirect with 301 in `vercel.json`.
- S3. Both repositories are public, so the guides quote their real code with attribution and list it under "Going further" (owner: "Sí, citar el código real"). `sources` accepts `android` and `watch`; the sources note names each license (MIT for narsil-android, GPL v3 for the others).
- S4. Android path, seven guides: `what-it-is`, `webview-host`, `conversation-band`, `sidebar`, `colors-and-mode`, `alerts-service`, `encryption-and-settings`. Watch path, five guides: `what-it-is`, `reading-the-state`, `tile`, `complication`, `app-and-refresh`. Five locales.
- S5. Home: five path cards (Android and Watch marked experimental, each with its repository link), an "on your phone and on your wrist" block replacing the extension block, the Android copy in the showcase phone tab, and a watch tab with the owner's captures (owner: "Te paso capturas del reloj").
- S6. `pet/phone-and-watch` matches narsil-pet 3.10.0: the `-estado` state carries `limits` and `sessions` for the watch, and the extension it named is replaced by the two apps (owner: "Actualizarla con el código real").
- S7. narsil-claude and narsil-pwa stay private: never named or linked.
- S8. One PR for everything (owner: "Un solo PR").

## Tasks

| ID  | Specs      | Route                  | Status | Commit |
| --- | ---------- | ---------------------- | ------ | ------ |
| T1  | S2, S3, S5 | inline                 | done   |        |
| T2  | S4         | delegated (2 parallel) | done   |        |
| T3  | S6         | delegated              | done   |        |
| T4  | S4, S6     | delegated (8 parallel) | done   |        |
| T5  | S5         | inline                 | done   |        |
| T6  | all        | inline                 | done   |        |

T1: routes, schema, copy in five locales, home, support, redirects, specs. T2: English guides. T3: English `pet/phone-and-watch` update. T4: translations. T5: watch showcase tab with the owner's captures. T6: checks.

## Log

- L1 (2026-11-24, owner): decisions S2, S3, S5, S6, S8 taken through questions.
- L2: the showcase phone captures show claude.ai with the band and the side menu block; narsil-android hosts the same page scripts, so the captures are kept and the copy now names the app.
- L3: narsil-pet `6400a6f` (release 3.10.0) adds `limits` and `sessions` to `-estado`; Narsil Watch needs them. Both apps reach only claude.ai (Android), ntfy.sh, and raw.githubusercontent.com (checked by grepping their `https://` hosts).
- L4 (2026-11-24, owner): "Ya conecte el debug mode inalámbrico en el reloj y prendí el wifi, toma los pantallazos". The cloud session cannot reach the watch, and the owner's computer offers no folder to cloud sessions; the owner takes the captures with `adb shell screencap` and shares them.
- L5: English guides written from the code of both repositories; every quoted excerpt checked against its source. Quoted JS, TS and CSS in the Android guides sit behind `<!-- prettier-ignore -->` so Prettier keeps them byte for byte. Each guide's "Where the code and the README differ" records what the READMEs overstate, among them: finished-turn alerts never replace each other with the real mod (no `conv-` tag), missed alerts are only recovered after a first alert, a key does not block plain messages in either app, and the system bars change only on resume.
- L6: translations to es, it, fr, pt. The es guides keep "móvil" and "ordenador"/"PC" (125 and 30 uses in the existing guides) even though the home copy says "celular". The Android commit `38cb33c` undid the Chrome user agent of `bfa379a`; the guides tell that history.
- L7: the phone captures were renamed `narsil-android-*`. Checks: typecheck, `eslint .`, `prettier --check`; 797 unit tests, coverage 98.13 % lines and 91.34 % branches; build 396 pages; 296 chromium e2e passed (run with the preinstalled Chromium because the pinned Playwright browser is missing in the cloud container).
- L8 (2026-11-24, owner): "aca estan las dos screenshots oscuro/claro del reloj, usa movil en todo lado en lugar de celular, ya con eso sube el pr". The two 480 x 480 captures of the watch app are `narsil-watch-claro.png` and `narsil-watch-oscuro.png`, shown in a round `watch` frame as the fourth showcase tab. The es copy now says "móvil" everywhere; "celular" stays only inside verbatim owner quotes in the guides, and pt keeps "celular", which is Brazilian Portuguese.
- L9: the first commit put the Android showcase copy on the floating window tab instead of the phone tab in all five locales; fixed here, the window tab matches `main` again. Checks: typecheck, `eslint .`, `prettier --check`; 797 unit tests, coverage 98.13 % lines and 91.34 % branches; build 396 pages; 296 chromium e2e passed.
