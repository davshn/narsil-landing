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

## Tasks

| ID  | Specs  | Route                          | Status  | Commit |
| --- | ------ | ------------------------------ | ------- | ------ |
| T1  | S1     | inline                         | pending |        |
| T2  | S2–S7  | delegated (context backstop)   | pending |        |
| T3  | S8     | delegated (4 parallel writers) | pending |        |
| T4  | S1, S8 | inline                         | pending |        |

T1: generic route index and guide pages, `PathCopy` for `mods` and `pet`, linked home card. T2: the four English guides. T3: translations. T4: e2e and full checks.

## Log

- L1 (2026-11-17, owner): "ya quedó, arranca la fase 3"
- L2 (2026-11-17, owner): "si, sabes que me interesa mas que el codigo, que expliques bien que hace, que prompts o como se le pidio a la ia que la hiciera, como funciona etc etc,"
- L3 (2026-11-17, owner): "perfecto" (accepts the template with the "how it was asked" section, real quotes only from recorded sources, reconstructions labeled, example prompts labeled).
- L4: recorded public requests found: narsil-pet `odd/tasks/fleet-view.md` (L1–L13) and `odd/tasks/animated-poses.md`; `docs/plan-advice.md`; 169 commits.
