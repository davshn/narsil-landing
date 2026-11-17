# Narsil Workshop — phase 2 (mod fundamentals)

Objective: the `/mods/` section and the guide content collection (Zod schema, guide template, previous/next navigation), with the five fundamentals guides in all five locales. Branch: `feat/mods-fundamentals`. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Guides live in a content collection (`src/content/`) validated with Zod, one entry per guide and per locale.
- S2. Every guide follows the same template: what it does; how it works inside (events or hooks, state, what it draws); step by step with minimal working code; common mistakes and how to test it; "going further" with a link to the exact file of the real mod; previous/next navigation and the coffee button.
- S3. `/[locale]/mods/` covers the fundamentals from brief 3.0: what a mod is (`.claude-plugin/plugin.json`, `hooks/hooks.json` with `{ "modules": ["./register.tsx"] }`, the hooks module, the types); the `$` object and its areas as the two mods use them; installing from a local marketplace, `/reload-plugins`, `claude plugin validate`, and `claude plugin test`; surfaces (terminal, desktop app, VS Code, mobile app) and what works on each; the GPL v3 license of the original mods and what reusing their code implies.
- S4. "No inventes la API": every `$` call that appears on the site exists in the `plugin-authoring` skill types or in the real code of the mods. Each guide records the Claude Code version it was checked against.
- S5. Owner (2026-11-17): "Las cinco ahora" — the guides ship in `en`, `es`, `it`, `fr`, and `pt` in this PR; a spec fails when a guide is missing in a locale.
- S6. Code quoted from the GPL v3 mods carries attribution and a link to its repository. Examples use synthetic data only.
- S7. Code blocks render with Shiki and pass the CSP (checked by e2e on a guide page), plus axe and smoke checks.
- S8. narsil-claude ("Narsil en Claude", the Firefox and Vivaldi for Android extension for claude.ai) appears on the home page marked "Experimental": what it shows, that it relies on the claude.ai page structure and not a public API, and that it only reads. Its repository is private, so it is not linked.
- S9. The site links only to public repositories.

## Tasks

| ID  | Specs      | Route                          | Status | Commit                                                 |
| --- | ---------- | ------------------------------ | ------ | ------------------------------------------------------ |
| T1  | S1, S5     | inline                         | done   | `1c96d47`                                              |
| T2  | S2, S6     | inline                         | done   | `1c96d47`                                              |
| T3  | S3, S4, S6 | delegated (context backstop)   | done   | `8e4e73b`                                              |
| T4  | S5         | delegated (4 parallel writers) | done   | translations commit                                    |
| T5  | S7         | inline                         | done   | 59 e2e passed (chromium), 596 unit tests, 98.3 % lines |
| T6  | S8, S9     | inline                         | done   | `1c96d47`                                              |

T1: schema, collection, `src/utils/guides.ts` with specs, locale parity spec. T2: `GuideLayout`, `/mods/` index and guide pages, UI copy in five locales. T3: the five English guides, API verified against the types of Claude Code 2.1.325 and the mods. T4: translations to es, it, fr, pt, one parallel writer per locale (disjoint files, several minutes each). T5: e2e and full checks.

## Log

- L1 (2026-11-17, owner): "arranca la fase 2,"
- L2 (2026-11-17, owner): "Las cinco ahora" (guides in all five locales in this PR).
- L3: Shiki is CSP-compatible here: the built `style-src` is `'self' 'unsafe-inline'` with no hashes, so inline style attributes are allowed; the build warning is generic. Correction of the phase 1 note.
- L4: no example mods are written to the dev-mods folder (writing there enables mod loading); the guides are documentation only.
- L5 (2026-11-17, owner): "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien" — added as S8.
- L6 (2026-11-17, owner): "el repo de esta landing tambien es privado por si acaso" — verified with `gh repo view`: narsil-landing, landingTemplate, and narsil-claude are private; narsil-pet and narsil-check are public. Links to private repositories are removed (S9).
- L8: T3 discrepancies recorded in the guides: the types raise `AbovePrompt` on terminal, desktop and mobile only, while the narsil-pet README says the band also works in VS Code; reference.md documents `/plugin install <mod> --marketplace <source>` while both mod READMEs use `/plugin marketplace add` then `/plugin install <mod>@<marketplace>`; neither mod calls `$.ui.status` or `$.state` directly. `claude plugin validate`/`test` ran on the CLI on PATH (2.1.319), the types are 2.1.325.
- L9: axe flagged `github-light` Shiki tokens for contrast; the light theme is `github-light-high-contrast`.
- L7: until T4 lands, the "guide files exist / exist in every locale" spec is red by design; the branch is pushed only when it is green.
