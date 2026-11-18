# Narsil Workshop

A free, static, multilingual site that teaches, step by step, how to build Claude Code mods like [Narsil](https://github.com/davshn/narsil-pet) and [Narsil Check](https://github.com/davshn/narsil-check), and a Narsil desk bot with a body (an ESP32-P4 touch screen in the belly and a holographic ESP32-S3 head) that talks through Xiaozhi and Claude on your own server and shows GitHub pull requests and the Narsil status.

Built on [landingTemplate](https://github.com/davshn/landingTemplate): **Astro 7**, **TypeScript**, **Tailwind CSS v4**, managed with **pnpm**. There is no backend and no analytics, and the site never asks for tokens or keys.

> Claude and Claude Code are trademarks of Anthropic, PBC. This project is not affiliated with or endorsed by Anthropic.

## Getting started

Requires Node.js `>=22.23.4` and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4321`. The root `/` redirects to the browser's preferred locale.

## Environment variables

All optional. Configure them in `.env` (copy from `.env.example`).

| Variable              | Purpose                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`     | Production URL for canonical links, `hreflang`, Open Graph, and the sitemap               |
| `PUBLIC_DONATION_URL` | Overrides the coffee button link (`https://paypal.me/davshn`); a non-https value hides it |
| `PUBLIC_ANALYTICS_*`  | Leave empty: the site ships without analytics, and the CSP sets `connect-src 'self'`      |

## Structure

```text
src/
  pages/[locale]/     index.astro (home) and support.astro
  layouts/            BaseLayout (document shell) and SiteLayout (header, language selector, footer)
  components/         ui/ primitives, sections/ (Hero, Features, Header, Footer, LanguageSelector)
  i18n/               en, es, it, fr, pt (pt-BR) and the TranslationShape contract
  utils/              donation, developer, repositories, CSP and URL helpers
odd/tasks/            feature documents (specs, tasks, and log)
```

## Locales

`en` (default), `es`, `it`, `fr`, and `pt` (`pt-BR`). Every locale implements `TranslationShape`; the specs in `src/i18n/spec/` check key parity and empty strings.

## Quality

```bash
pnpm typecheck
pnpm lint:check
pnpm test:cov      # fails below 80% coverage
pnpm e2e           # Playwright with axe and CSP checks
pnpm build
pnpm lighthouse
```

CI (`.github/workflows/quality.yml`) runs on a pull request only after the owner adds the `ready-for-review` label; `Merge gate` is the required check.

## Roadmap

1. Base: five locales, layout, home, support, coffee button, and CI.
2. Mod fundamentals and the guide content collection.
3. Path 1: a status pet mod like Narsil.
4. Path 2: a review panel mod like Narsil Check.
5. Path 3: the Narsil desk bot (firmware in the public fork `davshn/narsil-bot`).
6. Interactive tools.
7. SEO and polish.

## License

- Site code and example code written for the guides: MIT, see [`LICENSE`](LICENSE).
- Guide text: CC BY-SA 4.0.
- Code quoted or adapted from Narsil and Narsil Check: GPL-3.0-or-later, the license of those projects.

[`LICENSE-CONTENT.md`](LICENSE-CONTENT.md) says which material is which. This is not legal advice.
