# Narsil Workshop — phase 1 (base)

Objective: turn landingTemplate into the Narsil Workshop base (five locales, layout, theme, home, support, coffee button, CSP, CI). Branch: `feat/base`. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Project created from landingTemplate on a branch, never on `main` (the only `main` commit is the initial README, approved by the owner).
- S2. Five locales: `en` (default), `es`, `it`, `fr`, `pt` (`pt-BR`), with `locales`, `languageTags`, `ogLocales`, `localeNames` in `src/i18n/index.ts`, one `TranslationShape` file per locale, and key-parity and empty-string specs in `src/i18n/spec/`.
- S3. Reuse from emv-landing only what landingTemplate lacks: `SiteLayout`, `LanguageSelector` (no JavaScript), `donation.ts`, `developer.ts`, the support page, CSP with `connect-src 'self'` plus `InlineScript`, the ESLint ban on `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`dangerouslySetInnerHTML`, and the `Merge gate` with the `ready-for-review` label in `quality.yml`.
- S4. "Buy me a coffee" button in the footer, on the home page, and (later) at the end of each guide. Points to `https://paypal.me/davshn` (`DEFAULT_DONATION_URL`), overridable with `PUBLIC_DONATION_URL` (https only; otherwise the button is hidden).
- S5. Support page with the support text, the developer profile, and links to the public mod repositories (`davshn/narsil-pet`, `davshn/narsil-check`). This site's repository and narsil-claude are private and are not linked (owner, 2026-11-17: "el repo de esta landing tambien es privado por si acaso").
- S6. Home: what Narsil is, what you will build, and the three routes (mods/pet, mods/check, bot). Guides are out of scope for phase 1.
- S7. Footer notice that the project is not affiliated with Anthropic; "Claude" and "Claude Code" are Anthropic trademarks.
- S8. No analytics (`PUBLIC_ANALYTICS_*` empty); no `innerHTML`; no user data sent over the network.
- S9. Quality: ESLint, Prettier, typecheck, Vitest coverage ≥ 80 %, build pass. No non-functional comments.

## Tasks

| ID  | Specs          | Route  | Status | Commit                                                                         |
| --- | -------------- | ------ | ------ | ------------------------------------------------------------------------------ |
| T0  | S3, S8         | inline | done   | landingTemplate `fix/ban-html-sinks` 72efb3e (not pushed)                      |
| T1  | S1             | inline | done   | `docs: add initial readme`, three `chore: import landingTemplate …` commits    |
| T2  | S2             | inline | done   | `feat: turn the template into Narsil Workshop`                                 |
| T3  | S3, S4, S5, S7 | inline | done   | `feat: turn the template into Narsil Workshop`                                 |
| T4  | S3, S8         | inline | done   | CSP `connect-src`/`form-action` in `feat: turn the template …`; ban from T0    |
| T5  | S3, S6         | inline | done   | `feat: turn the template into Narsil Workshop`                                 |
| T6  | S9             | inline | done   | typecheck, lint, format, 569 unit tests (98 % lines), build, 35 e2e (chromium) |

## Log

- L1 (2026-11-17, owner): "vamos a hacer esta landing basada en landingTemplate" — brief `narsil-workshop-brief.md`.
- L2 (2026-11-17, owner): site name "Narsil Workshop"; repository stays `davshn/narsil-landing`.
- L3 (2026-11-17, owner): "no creo que necesitemos traer casi nada de emvLanding, casi todo lo que mencionas esta en landingTemplate, revisa" — verified; only the S3 pieces are ported.
- L4: Preact islands are deferred to phase 2 (tools); no guide content in phase 1.
- L5: the first import came from a stale local landingTemplate branch (`0570fec`); `origin/main` (`a1903c2`) already had the CSP, `InlineScript`, script modules, and `Merge gate`. The import was redone from `a1903c2` plus `fix/ban-html-sinks`.
- L6 (2026-11-17, owner): "En landingTemplate" — the HTML-sink ESLint ban and the carousel `replaceChildren()` fix live in landingTemplate (branch `fix/ban-html-sinks`), then flow here through the import.
- L7: the import is split in three commits because secretlint fails with "command line too long" on Windows when one commit stages 249 files.
- L8: open for later phases: Shiki inline styles conflict with the CSP (build warning) — decide on Prism or a CSP-safe highlighter before guides with code blocks; `.env.example` still needs `PUBLIC_DONATION_URL`; license decision pending.
