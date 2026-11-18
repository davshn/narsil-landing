# Narsil Workshop — AI-first, educational copy

Objective: rewrite the site copy so it teaches clearly and puts building with Claude first, with code as reference to understand rather than to copy. Branch: `claude/app-text-clarity-education-fc7ff4` (first slice: UI copy and the mods path). Delivery: `auto-chain` by learning path (UI + mods, pet, check, claude, bot). Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Owner (2026-11-18): "revisa todos los textos de la app, quiero que te asegures de que sean escritos de forma educativa y muy clara, priorizando la creacion con IA y despriorizando el copiar codigo, modifica lo que consideres"
- S2. Guide structure: What it does → How it works inside (concepts, plain words) → Build it with Claude (the prompt first, how to iterate, how to check what Claude produced) → the code, framed as something to read and compare with what Claude wrote, not to copy → Common mistakes and how to test it → Going further.
- S3. Clarity: short sentences, each term defined on first use, less jargon.
- S4. UI copy (home, path pages, guide chrome, support) describes learning to guide Claude and understand its result, not rebuilding by hand.
- S5. No technical fact or API call changes; only order and wording. Every `$` call still exists in the plugin-authoring types. GPL attribution on quoted code stays.
- S6. English first, then es, it, fr, pt with the same structure.
- S7. Owner (2026-11-18): "dale, empieza con la interfaz y mods" — first slice is the UI copy and the five mods guides.

## Tasks

| ID  | Specs          | Route                          | Status  | Commit |
| --- | -------------- | ------------------------------ | ------- | ------ |
| T1  | S3, S4         | inline                         | pending |        |
| T2  | S2, S3, S5     | inline                         | pending |        |
| T3  | S6             | delegated (4 parallel writers) | pending |        |
| T4  | S2             | inline                         | pending |        |
| T5  | S2–S6 (pet)    | later slice                    | pending |        |
| T6  | S2–S6 (check)  | later slice                    | pending |        |
| T7  | S2–S6 (claude) | later slice                    | pending |        |
| T8  | S2–S6 (bot)    | later slice                    | pending |        |

T1: English UI copy in `src/i18n/locales/en.ts`. T2: the five English mods guides. T3: UI copy and mods guides in es, it, fr, pt, one writer per locale (disjoint files, several minutes each). T4: e2e expectations for the new guide headings and full checks.

## Log

- L1 (2026-11-18, owner): "revisa todos los textos de la app, quiero que te asegures de que sean escritos de forma educativa y muy clara, priorizando la creacion con IA y despriorizando el copiar codigo, modifica lo que consideres"
- L2 (2026-11-18, owner): "dale, empieza con la interfaz y mods"
- L3: No unit test checks guide headings; `e2e/guides.spec.ts` counts five `h2` in `what-is-a-mod` and names "How it was asked of the AI" and "The minimal code" for the other paths, which change in later slices.
