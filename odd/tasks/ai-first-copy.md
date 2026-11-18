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
- S8. Owner (2026-11-18): "dale, sigue con la ruta pet". Template for path guides (pet, check, claude, bot), applied to the sections between "How it works inside" and "Common mistakes and how to test it":
  - `## How it was asked of the AI` becomes `## Build it with Claude`. It opens with one or two new sentences saying what to ask Claude for and the one idea Claude must get right in this feature.
  - `### A prompt you can use` comes first in that section, unchanged (prompt and its note).
  - A new `### What to check in Claude's answer`: three to five numbered checks, each tied to a rule this guide already explains (a hook, a state, a threshold, an edge case), followed by one sentence with a concrete symptom to describe to Claude if a check fails, in the style "tell Claude what you see: …".
  - A new `### How the author asked for it` holds the section's original opening paragraph; the original subsections (`### The exact prompt`, `### Reconstruction from the commit history`, `### Why …`, and so on) follow it demoted to `####`, with their text unchanged.
  - `## The minimal code` becomes `## Reference code`. It opens with one new paragraph: "This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right." The existing intro (attribution, version checked) and all code stay unchanged.
  - Nothing else changes: no technical fact, API call, command, code block, or GPL attribution. `updated` becomes 2026-11-18.

## Tasks

| ID  | Specs              | Route                               | Status  | Commit                                                       |
| --- | ------------------ | ----------------------------------- | ------- | ------------------------------------------------------------ |
| T1  | S3, S4             | inline                              | done    | `acd2f1d`                                                    |
| T2  | S2, S3, S5         | inline                              | done    | `acd2f1d`                                                    |
| T3  | S6                 | delegated (4 parallel writers)      | done    | translations commit                                          |
| T4  | S2                 | inline                              | done    | 728 unit tests, 99.15 % lines, 18 mods e2e passed (chromium) |
| T5  | S2–S6, S8 (pet)    | delegated (3 en + 4 locale writers) | done    | 115 guides e2e passed (chromium)                             |
| T6  | S2–S6, S8 (check)  | delegated (3 en + 4 locale writers) | done    | 115 guides e2e passed (chromium)                             |
| T7  | S2–S6, S8 (claude) | delegated (1 en + 4 locale writers) | done    | 115 guides e2e passed (chromium)                             |
| T8  | S2–S6 (bot)        | later slice                         | pending |                                                              |

T1: English UI copy in `src/i18n/locales/en.ts`. T2: the five English mods guides. T3: UI copy and mods guides in es, it, fr, pt, one writer per locale (disjoint files, several minutes each). T4: e2e expectations for the new guide headings and full checks.

## Log

- L1 (2026-11-18, owner): "revisa todos los textos de la app, quiero que te asegures de que sean escritos de forma educativa y muy clara, priorizando la creacion con IA y despriorizando el copiar codigo, modifica lo que consideres"
- L2 (2026-11-18, owner): "dale, empieza con la interfaz y mods"
- L3: No unit test checks guide headings; `e2e/guides.spec.ts` counts five `h2` in `what-is-a-mod` and names "How it was asked of the AI" and "The minimal code" for the other paths, which change in later slices.
- L4: The writers found a literal `\n\n` in the English `install-and-test.md` from the scripted edit; fixed to a paragraph break. Localized headings: es "Constrúyelo con Claude", it "Costruiscila con Claude", fr "Le construire avec Claude", pt "Construa com o Claude".
- L5: Next slice is the pet path (T5).
- L6 (2026-11-18, owner): "dale, sigue con la ruta pet". S8 template applied to the 17 pet guides in five locales on branch `docs/ai-first-pet`, stacked on PR 36; three parallel English writers (disjoint guides), then four locale writers. Localized "Reference code": es "Código de referencia", it "Codice di riferimento", fr "Code de référence", pt "Código de referência".
- L7 (2026-11-18, owner): "dale, sigue con la ruta check". PR 36 and PR 38 are merged; the check slice runs on `docs/ai-first-check` from `main`, with the same S8 template and the same writer split.
- L8 (2026-11-18, owner): "dale, sigue con la ruta claude". PR 39 is merged; the claude slice runs on `docs/ai-first-claude` from `main`: one English writer for the five guides (context backstop), then four locale writers.
