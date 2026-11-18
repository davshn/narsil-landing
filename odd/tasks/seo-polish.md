# Narsil Workshop — phase 7 (SEO and polish)

Objective: structured data, Open Graph and Lighthouse coverage for the guides, paths and tools. Two PRs: 7a structured data and meta (`feat/seo-1`), 7b Open Graph images and Lighthouse (`feat/seo-2`). Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`), Lighthouse CI (`pnpm lighthouse`).

## Specs

- S1. Brief, section 5, phase 7: "**SEO y pulido**: JSON-LD (`HowTo`/`TechArticle`), sitemap con `hreflang`, Open Graph por guía, Lighthouse." `HowTo` is left out: Google stopped showing HowTo rich results in 2023, and `TechArticle` fits these guides.
- S2. 7a: each guide carries `TechArticle` JSON-LD (headline, description, URL, BCP 47 language, `dateModified` from `updated`, author from the developer profile, the site as publisher) and a `BreadcrumbList` (home, path, guide); path indexes carry a `BreadcrumbList`; tool pages carry a free `WebApplication`; guides set `og:type` to `article` with `article:modified_time`.
- S3. 7a: `inLanguage` uses the BCP 47 tag (`pt-BR`, not `pt`) everywhere.
- S4. 7b: Open Graph images, one per path (owner: "Una por ruta"): mods, Narsil, Narsil Check, bot, tools and the general one, made from the existing Narsil art, no new dependencies.
- S5. 7b: Lighthouse CI also covers one guide per path, a tool and the bot path; the sitemap with `hreflang` is checked by building with a test `PUBLIC_SITE_URL`.

## Tasks

| ID  | Specs  | Route  | Status | Commit               |
| --- | ------ | ------ | ------ | -------------------- |
| T1  | S2, S3 | inline | done   | `e649ce9`            |
| T2  | S2, S3 | inline | done   | 7a wiring commit     |
| T3  | S4     | inline | done   | 7b images commit     |
| T4  | S5     | inline | done   | 7b Lighthouse commit |

T1: builders in `src/seo/json-ld.ts` with tests. T2: guides, path indexes and tools use them; `og` type in `BaseLayout` and `SiteLayout`; e2e. T3: path images and their use. T4: Lighthouse URLs, sitemap check.

## Log

- L1 (2026-11-18, owner): "Listo, mergeado, continúa con la fase 7", then "Una por ruta" for the Open Graph images.
- L2: 7a on `feat/seo-1`. Guides: `TechArticle` (author from `t.support.about.name` and `DEVELOPER_PROFILE_URL`) and `BreadcrumbList` home, path, guide; `og:type` article with `article:modified_time` as a date. Path indexes: `WebPage` and `BreadcrumbList`. Tools: `WebApplication` and `BreadcrumbList` home, tools, tool. `inLanguage` is `languageTags[locale]` on every page. URLs in JSON-LD fall back to the local origin when `PUBLIC_SITE_URL` is not set, as before.
- L3 (2026-11-18, owner): "Listo, mergeado, continúa con la 7b" (after #31). 7b on `feat/seo-2`. The shared `og-image.png` was still the landingTemplate placeholder ("YOUR PRODUCT NAME"); it is replaced by six images in `public/og/`, rendered by `scripts/og-images.ts` with Playwright (already a dev dependency) from the 449 × 1024 art in narsil-pet `assets/raw`, English text, 290 to 410 KB each. `src/utils/og-image.ts` picks the image from the page path. Checks: a build with `PUBLIC_SITE_URL=https://narsil.example` gives 320 sitemap URLs with `hreflang` en, es, fr, it, pt-BR and the right `og:image` per path; Lighthouse CI on 11 URLs, 55 runs, median 100 in performance, accessibility, best practices and SEO on every URL.
