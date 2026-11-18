# Narsil Workshop — path 4 (Narsil in Claude, the Android extension)

Objective: a short path that explains how Narsil in Claude (the private `davshn/narsil-claude` extension for Firefox and Vivaldi on Android) is built, as the home page promises. Two PRs: `feat/claude-path-1` (route, guides 1–3), `feat/claude-path-2` (guides 4–5). Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Owner, 2026-11-18: "hay otra cosa, no metimos la guia de narsul claude en celular, pusimos que era experimental pero que explicariamos como hacerlo, falta esa guia, el repositorio es narsil-claude". The home card says "Its code is not public, but the guides explain how it is built".
- S2. A short path, not a single guide (owner: "Ruta corta"), at `/[locale]/mods/claude/`, linked from the home "Experimental" card, five locales, with the path template of phases 3 and 4.
- S3. The repository is private (verified with `gh repo view`: `PRIVATE`), so the site never links it and never copies its code. Guides explain what each part does, how it works inside and how it was asked of the AI; "The minimal code" is written fresh for the guide (MIT, like the bot guides). Guides carry no `sources` (that field only names narsil-pet and narsil-check files) and no Claude Code version.
- S4. Every guide states it is experimental: it relies on the structure of the claude.ai page, not on a public API, so a Claude update can break it; it only reads: it never writes to the account or sends conversations anywhere, though it loads Narsil's pictures from GitHub and reads its status topic from ntfy.sh (home copy corrected in 8a, see L2).
- S5. Five guides: 1 `what-it-is` (what the extension does, why experimental, installing it on Android, the options); 2 `conversation-band` (the band above the message box: state, context, cache, last event, from the page itself); 3 `sidebar` (Narsil's level, the 5-hour and weekly limits, the ntfy count of the day); 4 `colors-and-icon` (Narsil Skin colors by the hour, the home screen icon); 5 `android-packaging` (Firefox unlisted signing, the Chromium package for Vivaldi, restoring styles when Vivaldi reloads it).
- S6. "How it was asked of the AI" quotes the owner's words recorded here and, for the extension itself, reconstructs the requests from the narsil-claude commit history, saying so, as the pet path did when no request was recorded.

## Tasks

| ID  | Specs     | Route                        | Status      | Commit         |
| --- | --------- | ---------------------------- | ----------- | -------------- |
| T1  | S2        | inline                       | done        | `f66b4ea`      |
| T2  | S1, S3–S6 | delegated (context backstop) | in progress | 8a: guides 1–3 |
| T3  | S2        | delegated (4 parallel)       | pending     |                |
| T4  | S2        | inline                       | pending     |                |

T1: route `claude` (schema, `pathKeys`, `ROUTE_PATHS`, pages, path copy in five locales, home card link, Open Graph image mapping, e2e lists). T2: English guides (1–3 in PR 1, 4–5 in PR 2). T3: translations. T4: checks.

## Log

- L1 (2026-11-18, owner): S1 verbatim, then "Ruta corta". Earlier, phase 2 L5: "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien"; L6: the repository is private and is not linked.
- L2: guides 1–3 written from the narsil-claude code and commits (read-only). Checked against the code: the extension only sends GET requests to claude.ai (conversation list, events, usage) and only reads `<topic>-estado` from ntfy.sh; it never publishes. Outside servers still see requests: ntfy.sh sees the topic and the phone's IP, raw.githubusercontent.com serves the pictures (the file names reveal stage and pose), narsil-pwa.vercel.app serves the home screen icons. The home note "It only reads, and it never sends your data anywhere" was corrected in five locales to say so. Found in passing, not changed (private repo): `unseal` in `extension/lib/seal.js` returns an unsealed message unchanged even when a key is set, so a forged plain status is still shown; guide 3 says so. The guides name claude.ai's own request paths and the `[data-cds=ChatComposer]` selector to describe the page, not code from the repository.
