# Narsil Workshop — site redesign

Objective: a new structure for the site that keeps its colors and neumorphic style, fixes what looks cramped or cut off, and stops looking like the owner's other sites. Three PRs: guides (`feat/guide-workshop-layout`), path pages, home. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. "quiero cambiar la estructura de la web manteniendo sus estilos": same tokens, palette, and neumorphic shadows; new layout and information architecture.
- S2. "quiero corregir lo que se ve demasiado junto, o lo que se ve cortado por el tamano de la pantalla": no horizontal page scroll from 320 px up, touch targets of at least 44 px for standalone controls, and spacing that scales with the screen.
- S3. "busca en internet buenas practicas para diseno ui ux y aplica los consejos": documentation pattern (path navigation on the left, "on this page" table of contents on the right, text column of about 60–75 characters), a visible "you are here" in each path, and a consistent spacing system.
- S4. "quiero que se vea diferente al modelo actual que se ve muy parecido a mis otras webs": the guides read as a workshop with a sidebar, the paths as a curriculum, and the home leads with the paths.
- S5. Guides (PR 1): from 1024 px a sidebar with every guide of the path, the current one marked, and the progress; from 1280 px a sticky table of contents of the `##` and `###` headings that marks the visible section; on smaller screens both collapse into disclosures above the text. Previous and next stay as large cards.
- S6. Path pages (PR 2): the guides as a numbered, connected curriculum, two columns on desktop, with a summary of the path.
- S7. Home (PR 3): the paths right after the hero, the state poses as a horizontal row on phones, and the showcase as tabs, one per interface.

## Tasks

| ID  | Specs          | Route  | Status  | Commit                      |
| --- | -------------- | ------ | ------- | --------------------------- |
| T1  | S1, S2, S3, S5 | inline | done    | PR #20                      |
| T2  | S1, S2, S6     | inline | review  | branch feat/path-curriculum |
| T3  | S1, S2, S4, S7 | inline | pending |                             |

## Log

- L1 (2026-11-18, owner): "quiero cambiar la estructura de la web manteniendo sus estilos, ademas quiero corregir lo que se ve demasiado junto, o lo que se ve cortado por el tamano de la pantalla, busca en internet buenas practicas para diseno ui ux y aplica los consejos, quiero que se vea diferente al modelo actual que se ve muy parecido a mis otras webs"
- L2 (2026-11-18): audit at 320, 375, 768, 1024, and 1440 px. Found: horizontal scroll at 320 px on `/en/mods/what-is-a-mod/`, a 28 px header brand link, a single 700 px guide column with no table of contents, and 17 identical stacked cards on each path page.
- L3 (2026-11-18, owner): "Sí, empieza" to the three-PR plan, starting with the guides.
- L4 (2026-11-18): T1 built. GuideLayout gets a three-column shell (path 15rem, text up to 46rem with 70ch paragraphs, table of contents 13rem), GuidePathList and GuideToc components, a scroll script that marks the visible heading with aria-current="location", tables and long inline code that wrap or scroll instead of widening the page, a 44 px header brand, and larger previous/next cards. The 320 px overflow on what-is-a-mod and the 28 px brand target no longer show in the audit.
- L5 (2026-11-18): T1 merged as PR #20 after resolving conflicts with the bot path (PR #19); GitHub Actions jobs do not start because of an account billing limit.
- L6 (2026-11-18, owner): "Sí, sigue". T2 built: GuideIndexLayout gets a two-column header with a summary card (guide count, estimated reading time at 200 words a minute, last update) and a GuideCurriculum timeline whose guides alternate around a central rail from 1024 px and hang from a left rail below; each card shows its reading time.
