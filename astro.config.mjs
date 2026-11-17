// @ts-check
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import icon from 'astro-icon'

import { missingSiteUrlWarning } from './src/utils/site-url.ts'

const envFile = fileURLToPath(new URL('.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

// eslint-disable-next-line no-restricted-syntax, @typescript-eslint/prefer-destructuring -- import.meta.env is empty in the Astro config
const siteUrl = process.env.PUBLIC_SITE_URL
const site = siteUrl !== undefined && siteUrl !== '' ? siteUrl : undefined

export default defineConfig({
  site,

  security: {
    csp: {
      directives: [
        "object-src 'none'",
        "base-uri 'self'",
        "connect-src 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'"],
      },
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },

  integrations: [
    sitemap({
      filter: (page) => new URL(page).pathname !== '/',
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', es: 'es', it: 'it', fr: 'fr', pt: 'pt-BR' },
      },
    }),
    icon(),
    {
      name: 'site-url-check',
      hooks: {
        'astro:build:start': ({ logger }) => {
          const warning = missingSiteUrlWarning(siteUrl)
          if (warning !== undefined) logger.warn(warning)
        },
      },
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es', 'it', 'fr', 'pt'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
})
