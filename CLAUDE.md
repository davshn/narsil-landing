# CLAUDE.md

Narsil Workshop: a free, static, multilingual site (English, Spanish, Italian, French, and Brazilian Portuguese) that teaches, step by step, how to build Claude Code mods like Narsil (`davshn/narsil-pet`) and Narsil Check (`davshn/narsil-check`), and a Narsil desk bot with a body (an ESP32-P4 touch screen in the belly and a holographic ESP32-S3 head) that talks through Xiaozhi and Claude on your own server and shows GitHub pull requests and the Narsil status. Built on landingTemplate: **Astro 7**, **TypeScript**, **Tailwind CSS v4**, managed with **pnpm**. There is no backend, no analytics, and the site never asks for tokens, topics, or keys.

Reference docs: `README.md` (setup, i18n, styling tokens, SEO, CI, and testing details) and `odd/tasks/narsil-workshop.md` (specs, tasks, and log).

## Working Agreement (mandatory)

- Before starting any request, give an opinion on what is going to be done and explain how: approach, files to touch, risks, and any conflict with the existing code. Then wait for the owner's confirmation before changing anything.
- If the plan changes in a relevant way during the work (new files, a different approach, a new risk), stop and confirm again before continuing.

## Project Context Files

Read these before working on the project:

| File                                                           | What it explains                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `README.md`                                                    | Features, architecture, components, i18n, styling, SEO, CI, and testing |
| `CLAUDE.md`                                                    | Working agreement, code rules, and Git workflow                         |
| `package.json`                                                 | Scripts, engines, and dependencies                                      |
| `.github/workflows/quality.yml`                                | CI jobs: `changes`, `quality`, and `Merge gate`                         |
| `.husky/` and `.lintstagedrc.json`                             | Pre-commit, commit-msg, and pre-push hooks                              |
| `eslint.config.mjs`, `eslint.common.mjs`, `eslint.landing.mjs` | ESLint rules                                                            |
| `.prettierrc`                                                  | Formatting rules                                                        |
| `vitest.config.ts`, `playwright.config.ts`                     | Unit, coverage, and e2e test setup                                      |
| `lighthouserc.json`                                            | Lighthouse CI thresholds                                                |
| `sonar-project.properties`                                     | SonarQube Cloud analysis and Quality Gate settings                      |
| `astro.config.mjs`, `tsconfig.json`                            | Astro integrations and TypeScript path aliases                          |
| `src/i18n/` and `src/styles/global.css`                        | Translation contract and design tokens                                  |
| `.env.example`                                                 | Environment variables                                                   |

## Commands

```bash
pnpm dev            # dev server at http://localhost:4321
pnpm typecheck      # tsc --noEmit
pnpm lint:check     # ESLint (strict, see below)
pnpm lint:fix       # ESLint autofix
pnpm format:check   # Prettier check
pnpm test           # Vitest, single pass
pnpm test:cov       # Vitest with coverage, fails below 80%
pnpm e2e            # Playwright (all browsers)
pnpm build          # production build
pnpm check          # format + lint + typecheck + test + build
```

## Architecture

- `src/pages/` — file-based routing only. Thin route adapters; their logic lives in `src/utils/`. Never put spec files here (a spec would become a route).
- `src/pages/[locale]/` — home (`index.astro`) and `support.astro`. Guides (`mods/`, `bot/`) and tools arrive in later phases.
- `src/layouts/BaseLayout.astro` — document shell: meta, Open Graph, `hreflang`, JSON-LD, analytics, landmarks. `src/layouts/SiteLayout.astro` adds the header navigation, language selector, theme toggle, and footer (coffee button and Anthropic trademark notice).
- `src/components/ui/` — reusable primitives, one folder each (`Button/Button.astro`, `button.css`, `button.spec.ts`).
- `src/components/sections/` — landing blocks (Hero, Features, Header, Footer) and `LanguageSelector` (a JavaScript-free `<details>` disclosure, rendered in the header bar and in the mobile menu). `src/components/layout/` — structural chrome.
- `src/i18n/` — locales and their metadata in `index.ts`: `locales` (`en`, `es`, `it`, `fr`, `pt`; the code is the URL prefix), `languageTags` (BCP 47 tag for `<html lang>`, `hreflang`, and the sitemap; `pt` is `pt-BR`), `ogLocales`, and `localeNames`. The `TranslationShape` contract has one file per locale in `locales/`; the path stage diagrams and the bot map take their copy from one file per locale in `diagrams/`, and `src/utils/path-stages.ts` maps each stage and bot part to its guides. A new key is added to all five locales, and `src/i18n/spec/` checks key parity and empty strings.
- `src/content/` — reserved for Astro Content Collections; empty by default.
- `src/seo/` — JSON-LD builders. `src/utils/` — pure TS helpers (no DOM, no Astro runtime).
- `src/styles/` — `global.css` holds `@theme` tokens; `theme.ts` mirrors them as TS constants.
- `e2e/` — Playwright tests, including axe accessibility checks.

## Code Rules

- Styling priority: design tokens in `@theme` → semantic classes with `@apply` → short utilities → arbitrary values only as a last resort.
- No `console.log` or `debugger` in committed source; the pre-commit hook rejects them.
- **Do not write non-functional comments** in code, config, hooks, or tests. Only functional comments are allowed (`// @vitest-environment`, `// @ts-check`, `eslint-disable` directives, shebangs, and `# vX.Y.Z` tags on SHA-pinned actions). The only exceptions are the explanatory comments on the dependency overrides in `pnpm-workspace.yaml` (why each override exists and when to remove it) and the variable descriptions in `.env.example`.
- Staged files are scanned with secretlint before commit, and every `.env*` file except `.env.example` is git-ignored; never commit real credentials.
- Staged files over 1 MB are rejected; optimize assets and serve images through `<ResponsiveImage />`.
- Component behavior goes in a typed module next to the component (`<script src="./file.ts"></script>`), with its own spec; Astro bundles it and runs it once per page. Use `<InlineScript code={...} />` only for code that must run inline (pre-paint theme, root redirect, analytics), so its hash enters the Content Security Policy; a plain `<script is:inline>` or `<script set:html>` is blocked in production builds.
- Accessibility is required: semantic landmarks, visible focus, keyboard navigation, reduced-motion support.
- Data is rendered only as text. ESLint rejects `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `dangerouslySetInnerHTML` in source (spec files and the `src/test-*.ts` helpers are exempt); use `textContent`, `replaceChildren()`, and DOM nodes instead.
- The CSP also sets `connect-src 'self'` and `form-action 'self'`. Ship without analytics: leave every `PUBLIC_ANALYTICS_*` variable empty; enabling one needs an owner decision and a CSP change.
- The coffee button points to `https://paypal.me/davshn` (`DEFAULT_DONATION_URL` in `src/utils/donation.ts`); `PUBLIC_DONATION_URL` (https only) overrides it, and a non-https value hides the button. The support page links to the developer profile in `src/utils/developer.ts` and to the repositories in `src/utils/repositories.ts`.
- Scope limits: the site is educational. Examples use synthetic data only (invented ntfy topics, clearly fake tokens, example repositories). The site never asks for or stores real tokens, topics, or keys; any tool that accepts one processes it in the browser only and never puts it in a link. Every guide that uses a token explains the minimum permission, where to store it, and how to revoke it. Code quoted from the GPL v3 mods carries attribution and a link to its repository.
- Before documenting any mod API call (`$.ui.*`, `$.store.*`, and so on), check it against the `plugin-authoring` skill or the real code of the mods; never invent the API.
- Generated code, comments, UI copy, test names, assertion messages, hook output, and commit messages are written in English. Only locale files (`src/i18n/locales/` and `src/i18n/diagrams/`) and test data that exercises localized labels use other languages.

## Testing

- Tests for pure logic (`utils`, `i18n`, `seo`, `styles`) live in a colocated `spec/` folder; component tests sit next to the component (`Button/button.spec.ts`) and render real markup through `render()` in `src/test-render.ts`.
- **Coverage must stay at 80% or higher** for lines, statements, functions, and branches (`pnpm test:cov`). The same threshold is enforced by CI and the SonarCloud quality gate. New code ships with its tests.

## Git Workflow (mandatory)

1. **Always work on a branch created from `main`.** Never commit directly to `main`.
2. **Before starting any work, update the branch with the latest `main`:**
   ```bash
   git fetch origin
   git merge origin/main
   ```
   When creating a new branch, start from an up-to-date `main` (`git switch main && git pull --ff-only && git switch -c <type>/<short-name>`).
3. **Before every push, run and pass:**
   ```bash
   pnpm typecheck
   pnpm lint:check
   pnpm test:cov
   ```
   The ESLint rules are very strict (`eslint-config-love`, type-checked rules, `import-x/no-cycle`). The pre-push hook runs typecheck, tests, and build, but **not** lint or coverage, so those must be checked manually; CI fails otherwise.
4. Commit messages follow Conventional Commits, validated by the `commit-msg` hook: `type(scope): description`, with type one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.
5. Never skip hooks with `--no-verify`. If a hook fails, fix the cause.
6. **One pull request per task.** Open PRs as normal pull requests, never as drafts (`gh pr create` without `--draft`).
7. **CI runs on a PR only with the `ready-for-review` label.** The owner always adds the label manually when the PR is ready; that triggers the `quality` job. **Never add the `ready-for-review` label yourself**, not with `gh pr create --label`, `gh pr edit --add-label`, or any other tool. PRs that only touch root-level Markdown files or `docs/` skip `quality` and pass without the label. `Merge gate` is the only required status check: it fails without the label or when `quality` does not succeed, and it removes the label when `quality` fails. Fix the problem, push, and tell the owner the PR is ready for the label again.
8. **Return to `main` when done.** After finishing the work on a branch, and when you stop working in the repository, switch back to an up-to-date `main`:
   ```bash
   git switch main && git pull --ff-only
   ```
   In a worktree where `main` is checked out elsewhere, use:
   ```bash
   git fetch origin && git switch --detach origin/main
   ```
