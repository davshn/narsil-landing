# Narsil Workshop — phase 4 (path 2: your own review panel)

Objective: the `/mods/check/` path with the 17 guides of brief 3.2, delivered in four PRs (4a: guides 1–4, 4b: 5–8, 4c: 9–12, 4d: 13–17), each in all five locales, with the same path template as phase 3. Branch for 4a: `feat/check-path-1`. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. A route index at `/[locale]/mods/check/` and guide pages at `/[locale]/mods/check/<slug>/`; the second home route card links to the path.
- S2. Same owner direction as phase 3 (`odd/tasks/pet-path.md` S2): explanation leads, code is minimal.
- S3. Same path template as phase 3 (`odd/tasks/pet-path.md` S3), with the same six `##` sections.
- S4. Same "how it was asked of the AI" rules as phase 3 (`odd/tasks/pet-path.md` S4); the public recorded sources here are narsil-check `odd/tasks/ecosystems-wave-2.md`, `ecosystems-wave-3.md`, `ecosystems-wave-4.md`, `release-age-all-ecosystems.md`, `vulnerabilities.md`, and its 73 commits.
- S5. "No inventes la API": every `$` call exists in the plugin-authoring types (Claude Code 2.1.325) or in narsil-check's code.
- S6. Code quoted from narsil-check carries attribution and a link (GPL v3). Examples use synthetic data only (no real repositories, tokens, or package names that would mislead; well-known public packages may be used as examples).
- S7. Guides 1–4 (PR 4a): the side panel (`hooks/register.tsx`, `hooks/words.ts`: collapsible sections with a colored dot red/yellow/green/blue, remembering what was collapsed, copy to clipboard); session environment (`hooks/session.ts`: repository, folder, branch, remote control and Auto-fix read from the desktop app's MCP servers, and why it is asked only once); connectors (`hooks/session.ts`: listing MCP servers and their tools); PR CI (`hooks/ci.ts`: GitHub Actions steps through `gh`, refreshing every 10 s while running).
- S9. Guides 5–8 (PR 4b, branch `feat/check-path-2`): branch behind its remote (`hooks/git.ts`: `git fetch`, counting the missing commits, the `git pull -r` button); ecosystem architecture (`hooks/adapter.ts`, `hooks/ecosystems.ts`, `hooks/npm.ts`, `hooks/semver.ts`, `hooks/toml.ts`: one adapter per ecosystem that reads the manifest, asks the registry and rewrites the version; start with npm and add one more as an exercise); classifying updates (`hooks/register.tsx`, `hooks/semver.ts`: the groups Blocked, Major version, Version bump only and Outside the Expo SDK; the 6-hour cache); dependencies that block each other (`hooks/npm.ts`: peers of the new version, peers of what is installed, versions pinned in the tree).
- S10. Guides 9–12 (PR 4c, branch `feat/check-path-3`): the 24-hour wait (why not install freshly published versions, where the publication date comes from in each registry, pnpm's `minimumReleaseAge`; `hooks/*.ts` per ecosystem); versions pinned on purpose (`hooks/words.ts`: detecting `pin`, `hold`, `fijar` and similar comments in the manifest); explaining a major version with Haiku (`hooks/explain.ts`: release notes or `CHANGELOG.md` plus the project's usage found with `git grep`, without inventing; quote the real prompt the mod sends); updating the trivial ones (`hooks/register.tsx`: keeping the range operator and the section).
- S8. Every guide exists in `en`, `es`, `it`, `fr`, `pt`.

## Tasks

| ID  | Specs   | Route                          | Status | Commit                                               |
| --- | ------- | ------------------------------ | ------ | ---------------------------------------------------- |
| T1  | S1      | inline                         | done   | `f44cd60`                                            |
| T2  | S2–S7   | delegated (context backstop)   | done   | `d95d02d`                                            |
| T3  | S8      | delegated (4 parallel writers) | done   | translations commit                                  |
| T4  | S1, S8  | inline                         | done   | 123 e2e passed (chromium), 598 unit tests, 156 pages |
| T5  | S9      | delegated (context backstop)   | done   | `486452c`                                            |
| T6  | S8, S9  | delegated (4 parallel writers) | done   | translations commit                                  |
| T7  | S9      | inline                         | done   | 129 e2e passed (chromium), 598 unit tests, 176 pages |
| T8  | S10     | delegated (context backstop)   | done   | `c74e0b5`                                            |
| T9  | S8, S10 | delegated (4 parallel writers) | done   | translations commit                                  |
| T10 | S10     | inline                         | done   | 135 e2e passed (chromium), 598 unit tests, 196 pages |

## Log

- L1 (2026-11-17, owner): "Listo mergeado continúa" (after PR #7, path 1 complete; phase 4 follows the four-PR plan announced for it).
- L2: discrepancies the 4a guides describe, following the code: the folder comes from `$.session.cwd()` and the branch and repository from `git`, not from the desktop app's MCP servers (only Remote Control, the worktree, the PR and Auto-fix, and the connectors do); the 2.1.325 types say `$.mcp.call` raises no permission prompt (line 2885) while narsil-check's README and `4770a49` record one; folds are kept in `$.state` (session) while the README says they persist across sessions.
- L3 (2026-11-17, owner): "Listo continúa" (PR #8 merged).
- L4: findings in narsil-check from 4b, described in the guides and not changed: `hooks/git.ts` holds only the upgrade PR texts, the fetch, count and `git pull -r` are in `hooks/register.tsx`; the fetch result is never checked, so the behind count can be stale offline; no dirty-tree check before the pull, and a conflict leaves the repository mid-rebase; the README says nine ecosystems while `ADAPTERS` has eleven.
- L5 (2026-11-17, owner): "Ya está, continúa" (PR #9 merged).
- L6: findings in narsil-check from 4c, described in the guides and not changed: hold-comment detection (`HOLD`) lives in `hooks/adapter.ts:91`, not `hooks/words.ts`, and never applies to npm's `package.json`; the CHANGELOG fallback is npm only; when an install command fails, later ecosystems are skipped and rewritten manifests stay modified unless the tool is missing.
