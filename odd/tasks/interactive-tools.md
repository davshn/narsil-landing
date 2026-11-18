# Narsil Workshop — phase 6 (interactive tools)

Objective: small in-browser tools under `/[locale]/tools/` that help readers understand the guides, built as Preact islands. Branch per PR (`feat/tools-1` for 6a). Delivery: `ask-on-risk`, four PRs (6a–6d). Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Brief, section 3.4: "Pequeñas herramientas que ayudan a entender las guías. Todas funcionan solo en el navegador, sin red, y se prueban con `@testing-library/preact`". Tools: "Simulador de prioridad", "Calculadora de XP", "Estimador de llenado de contexto", "Reloj de caché", "Clasificador de semver: dada una versión instalada y una nueva, en qué grupo cae (parche, minor, mayor, bajo 1.0.0)", "Generador de configuración del ESP32" (adapted: the bot keeps secrets in NVS, so it generates the server's `LLM:` block of `.config.yaml` with placeholders, never real secrets).
- S2. Preact islands (owner: "Preact, como el brief"). A spike on 2026-11-18 showed a `client:visible` Preact 11 island hydrating under the site's hash-based CSP with no violations.
- S3. No network, no secrets asked, nothing typed goes into a URL (CLAUDE.md scope limits, brief section 4). CSP and axe e2e checks cover every tool page.
- S4. Tool logic adapted from narsil-pet and narsil-check keeps GPL-3.0-or-later (phase 5 S7): it lives in `src/tools/logic/`, declared GPL in `LICENSE-CONTENT.md` and the README with links to the source repositories.
- S5. Five locales; the header gets a Tools link; each tool links the guide it explains.
- S6. PRs (owner: "Sí, arranca la 6a"): 6a infrastructure (dependencies, `/tools/` index, nav, copy) and the semver classifier; 6b XP calculator and priority simulator; 6c context estimator and cache clock; 6d bot configuration generator.

## Tasks

| ID  | Specs      | Route  | Status      | Commit |
| --- | ---------- | ------ | ----------- | ------ |
| T1  | S2         | inline | in progress |        |
| T2  | S1, S4     | inline | pending     |        |
| T3  | S1, S3, S5 | inline | pending     |        |
| T4  | S3         | inline | pending     |        |

T1: Preact dependencies and config (own commit, risk item 5). T2: semver logic from `narsil-check/hooks/semver.ts` (`parseVersion`, `compare`, `bumpOf`, `show`) and the group rule (`major` → review, else bump). T3: classifier island, `/tools/` and `/tools/semver/` pages, nav, copy in five locales. T4: e2e (tools, CSP, axe), checks.

## Log

- L1 (2026-11-18, owner): "Preact, como el brief", then "Sí, arranca la 6a" after the plan in S6.
