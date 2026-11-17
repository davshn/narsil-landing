# CLAUDE.md

Reusable landing page template: **Astro 7**, **TypeScript**, **Tailwind CSS v4**, managed with **pnpm**. Static-first, minimal client JavaScript, accessible, SEO/GEO-ready, and multilingual (`/en/`, `/es/`). Used for product launches, SaaS waitlists, service pages, and lead-generation campaigns.

Reference doc: `README.md` (setup, i18n, styling tokens, SEO, CI, and testing details).

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
- `src/layouts/BaseLayout.astro` — document shell: meta, Open Graph, `hreflang`, JSON-LD, analytics, landmarks.
- `src/components/ui/` — reusable primitives, one folder each (`Button/Button.astro`, `button.css`, `button.spec.ts`).
- `src/components/sections/` — landing blocks (Hero, Pricing, FAQ). `src/components/layout/` — structural chrome.
- `src/i18n/` — `TranslationShape` contract and one file per locale in `locales/`. All landing copy lives here, and every locale must satisfy the contract.
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
- Generated code, comments, UI copy, test names, assertion messages, hook output, and commit messages are written in English. Only locale files (`src/i18n/locales/`) and test data that exercises localized labels use other languages.

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
