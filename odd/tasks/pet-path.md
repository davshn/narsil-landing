# Narsil Workshop — phase 3 (path 1: your own status pet)

Objective: the `/mods/pet/` path with the 17 guides of brief 3.1, delivered in four PRs (3a: guides 1–4, 3b: 5–8, 3c: 9–12, 3d: 13–17), each in all five locales. Branch for 3a: `feat/pet-path-1`. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. A route index at `/[locale]/mods/pet/` and guide pages at `/[locale]/mods/pet/<slug>/`, reusing the guide template; the first home route card links to the path.
- S2. Owner (2026-11-17): "sabes que me interesa mas que el codigo, que expliques bien que hace, que prompts o como se le pidio a la ia que la hiciera, como funciona etc etc," — explanation leads, code is minimal.
- S3. Path guide template, as `##` sections in this order: what it does and what it is for (from the user's side); how it works inside (events, state, what it draws, and why each design decision was taken); how it was asked of the AI; the minimal code; common mistakes and how to test it; going further.
- S4. "How it was asked of the AI": quote the real request word for word, with date and source, only when it is recorded in a public source (narsil-pet `odd/tasks/*.md`, `docs/plan-advice.md`); otherwise say it is not recorded and reconstruct it from the public commit history, labeled as a reconstruction; include the corrections along the way; end with an example prompt for the reader, labeled as a suggestion. Never present an invented prompt as real. Private sources (Engram memories, local transcripts) are not used without the owner's request.
- S5. "No inventes la API": every `$` call exists in the plugin-authoring types (Claude Code 2.1.325) or in narsil-pet's code; code that is not mod API (`overlay/server.cjs`, `.ps1`, `.sh`, `tools/*`) is described as it is in the repository.
- S6. Narsil drawings are GPL v3 SVG from narsil-pet; any use carries attribution and a link. Code quoted from narsil-pet carries attribution and a link.
- S7. Guides 1–4 (PR 3a): states at a glance (`hooks/register.tsx`, `hooks/words.ts`); drawing and animations (`hooks/sprite.ts`, `hooks/art.ts`, `tools/build-art.ps1`, `tools/encode-anim.ps1`); every conversation (`hooks/fleet.ts`, `overlay/server.cjs`; order ERROR > TE NECESITA > TRABAJANDO > TERMINADO, paging, one-hour expiry); tasks and subagents (`hooks/tasks.ts`, `hooks/agents.ts`).
- S8. Every guide exists in `en`, `es`, `it`, `fr`, `pt`.
- S9. Guides 5–8 (PR 3b, branch `feat/pet-path-2`): floating window (`overlay/`: `server.cjs`, `overlay.html`, `watch.ps1`, `mac-claude.js`; the always-on-top window that appears when Claude is minimized or something waits, and the local server's security: only `127.0.0.1`, page key and mod token, and why it must never be opened to the network); voice and alerts (random phrases per event, voice on Windows and macOS, system notifications: `overlay/speak.ps1`, `overlay/speak.sh`, `overlay/toast.*`); context and limits (`hooks/usage.ts`: per-conversation context bar, fill estimate at the 15-minute pace, `/compact` suggestion, 5-hour and weekly limits); cache clock (`hooks/register.tsx`: countdown of the prompt cache, 60 min subscription and 5 min API, from the last request).
- S10. Guides 9–12 (PR 3c, branch `feat/pet-path-3`): reactions to commands (`hooks/words.ts`: detect passing and failing tests and warn, without blocking, about dangerous commands); permissions that wait (`hooks/register.tsx`: nudge once after 5 minutes); tips with Haiku (`hooks/advice.ts`, `overlay/tip.*`, `docs/plan-advice.md`: end-of-turn tip from the diff, debugging tip after repeated failures, deep mode, frequencies, the tip window); next steps (`hooks/register.tsx`: proposals after 15 minutes from commits, changes and `odd/tasks/*.md`, filling the prompt on click).
- S11. Guides 13–17 (PR 3d, branch `feat/pet-path-4`), closing the path: experience and growth (`hooks/xp.ts`: XP per turn, tests and subagents; levels; five stages; celebrations); quiet mode (`hooks/register.tsx`: silence without losing the important alerts); alerts on the phone and the watch (`hooks/phone.ts`, `hooks/seal.ts`: private ntfy.sh topic, daily limit of 200, the `-estado` topic, encryption with a key, Web Push; visible warning that anyone who knows a topic can read it, recommend the key; synthetic topics only); session summary (`hooks/register.tsx`: turns, files, commands, failures, subagents; persistence across sessions); `/your-mod` commands (`hooks/register.tsx`: register a command with subcommands and its help).

## Tasks

| ID  | Specs   | Route                          | Status | Commit                                                           |
| --- | ------- | ------------------------------ | ------ | ---------------------------------------------------------------- |
| T1  | S1      | inline                         | done   | `dfce4fb`                                                        |
| T2  | S2–S7   | delegated (context backstop)   | done   | `9640a66`                                                        |
| T3  | S8      | delegated (4 parallel writers) | done   | translations commit                                              |
| T4  | S1, S8  | inline                         | done   | 82 e2e passed (chromium), 598 unit tests, 97.6 % lines           |
| T5  | S9      | delegated (context backstop)   | done   | `b5796e9`                                                        |
| T6  | S8, S9  | delegated (4 parallel writers) | done   | translations commit                                              |
| T7  | S9      | inline                         | done   | 90 e2e passed (chromium), 598 unit tests, 97.6 % lines, 86 pages |
| T8  | S10     | delegated (context backstop)   | done   | `b7caf54`                                                        |
| T9  | S8, S10 | delegated (4 parallel writers) | done   | translations commit                                              |
| T10 | S10     | inline                         | done   | 96 e2e passed (chromium), 598 unit tests, 106 pages              |
| T11 | S11     | delegated (context backstop)   | done   | `e023587`                                                        |
| T12 | S8, S11 | delegated (4 parallel writers) | done   | translations commit                                              |
| T13 | S11     | inline                         | done   | 105 e2e passed (chromium), 598 unit tests, 131 pages             |

T1: generic route index and guide pages, `PathCopy` for `mods` and `pet`, linked home card. T2: the four English guides. T3: translations. T4: e2e and full checks.

## Log

- L1 (2026-11-17, owner): "ya quedó, arranca la fase 3"
- L2 (2026-11-17, owner): "si, sabes que me interesa mas que el codigo, que expliques bien que hace, que prompts o como se le pidio a la ia que la hiciera, como funciona etc etc,"
- L3 (2026-11-17, owner): "perfecto" (accepts the template with the "how it was asked" section, real quotes only from recorded sources, reconstructions labeled, example prompts labeled).
- L4: recorded public requests found: narsil-pet `odd/tasks/fleet-view.md` (L1–L13) and `odd/tasks/animated-poses.md`; `docs/plan-advice.md`; 169 commits.
- L5: the "Going further" sentence about next steps (copied from a code comment at narsil-pet hooks/register.tsx:1586) was ambiguous; rewritten in all five locales to say rows start closed while next steps are on offer.
- L6: axe flagged `github-dark` tokens on a pet guide; the dark Shiki theme is now `github-dark-high-contrast`.
- L7: `pnpm lint:check` also scans `.claude/worktrees/light-dark-mode-styles-f62ff4` (branch feat/cold-blues-theme), a worktree this session did not create; `eslint src e2e` passes. Not changed here.
- L8 (2026-11-17, owner): "ya quedó, arranca la 3b" (PR #4 merged as f7147ff).
- L9: findings in narsil-pet while writing 3b, reported to the owner and described as they are in the guides: `GET /events`, `GET /window` and `GET /` of overlay/server.cjs need only a valid Host header, so any local program can read the stream (websites cannot: no CORS); the README's green-to-red cache clock is not drawn (`cacheColor` is imported but never called).
- L10 (2026-11-17, owner): "Listo sigue" (PR #5 merged).
- L11: findings in narsil-pet while writing 3c, described in the guides: docs/plan-advice.md is marked implemented but its numbers are stale (length 160 vs 300, effort low vs medium, every 10 vs 30 minutes, context 2,000 vs 6,000 characters); `pickStep` fills the prompt without a mode, replacing a draft; the daily tip cap resets at midnight UTC.
- L12 (2026-11-17, owner): "Listo, continúa con la siguiente tarea" (PR #6 merged).
- L13: 3d corrections before translation: the phone warning overstated the key (it hides title and text, not the kind of alert, its time or Narsil's stage; checked in hooks/phone.ts sealedMessage); "four places" for gainXp clarified as four calls under three events (hooks/register.tsx:997, 1442, 1489, 1502).
- L14: findings in narsil-pet from 3d, described in the guides and not changed: the key printed by `/narsil movil clave` stays in the model's requests; quiet mode does not stop the `/compact` suggestion; the fallback usage text reads 'Uso:/narsil' without a space. Path 1 is complete: 17 guides in 5 locales.
