import { expect, test } from '@playwright/test'

import { locales } from '../src/i18n/index'
import { useTranslations } from '../src/i18n/utils'

test.describe('Interactive tools', () => {
  for (const locale of locales) {
    const t = useTranslations(locale)

    test(`/${locale}/tools/ is in the header and lists every tool`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      const navLink = page.locator(`header a[href="/${locale}/tools/"]`).first()
      await expect(navLink).toHaveText(t.nav.tools)

      await page.goto(`/${locale}/tools/`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.tools.title)
      const links = page.locator('[data-tool-list] a')
      await expect(links).toHaveText([
        t.tools.semver.title,
        t.tools.xp.title,
        t.tools.priority.title,
        t.tools.context.title,
        t.tools.cache.title,
        t.tools.botConfig.title,
      ])
      const hrefs = await links.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('href')),
      )
      expect(hrefs).toEqual(
        ['semver', 'xp', 'priority', 'context', 'cache', 'bot-config'].map(
          (slug) => `/${locale}/tools/${slug}/`,
        ),
      )
    })

    test(`/${locale}/tools/bot-config/ builds the server file without real keys`, async ({
      page,
    }) => {
      const copy = t.tools.botConfig
      await page.goto(`/${locale}/tools/bot-config/`)
      const yaml = page.locator('[data-bot-config-result] pre')
      await expect(yaml).toContainText('api_key: sk-EXAMPLE-not-a-real-key')
      const model = page.getByLabel(copy.modelLabel)
      await expect(async () => {
        await model.selectOption('claude-haiku-5-5')
        await expect(yaml).toContainText('model_name: claude-haiku-5-5')
      }).toPass()
      await page.getByLabel(copy.hostLabel).fill('8.8.8.8')
      await expect(page.getByRole('status')).toHaveText(copy.invalid.host)
      await expect(yaml).toHaveCount(0)
      await expect(page).toHaveURL(`/${locale}/tools/bot-config/`)
      await expect(page.locator('[data-tool-guide]')).toHaveAttribute(
        'href',
        `/${locale}/bot/claude-brain/`,
      )
    })

    test(`/${locale}/tools/context/ estimates the fill in the browser`, async ({ page }) => {
      const copy = t.tools.context
      await page.goto(`/${locale}/tools/context/`)
      const result = page.getByRole('status')
      const now = page.getByLabel(copy.nowLabel)
      await expect(async () => {
        await now.fill('100')
        await expect(result).toContainText(copy.full)
      }).toPass()
      await expect(page.locator('[data-tool-guide]')).toHaveAttribute(
        'href',
        `/${locale}/mods/pet/context-and-limits/`,
      )
    })

    test(`/${locale}/tools/cache/ counts the cache down in the browser`, async ({ page }) => {
      const copy = t.tools.cache
      await page.goto(`/${locale}/tools/cache/`)
      const result = page.getByRole('status')
      const elapsed = page.getByLabel(copy.elapsedLabel)
      await expect(async () => {
        await elapsed.fill('10')
        await expect(result).toContainText(copy.cold)
      }).toPass()
      await page.getByLabel(copy.accounts.plan).check()
      await expect(result).not.toContainText(copy.cold)
      await expect(page.locator('[data-tool-guide]')).toHaveAttribute(
        'href',
        `/${locale}/mods/pet/cache-clock/`,
      )
    })

    test(`/${locale}/tools/xp/ computes Narsil's level in the browser`, async ({ page }) => {
      const copy = t.tools.xp
      await page.goto(`/${locale}/tools/xp/`)
      const result = page.getByRole('status')
      const turns = page.getByLabel(copy.turnsLabel)
      await expect(async () => {
        await turns.fill('6000')
        await expect(result).toContainText(copy.grown)
      }).toPass()
      await expect(page.locator('[data-tool-guide]')).toHaveAttribute(
        'href',
        `/${locale}/mods/pet/experience-and-growth/`,
      )
    })

    test(`/${locale}/tools/priority/ ranks conversations in the browser`, async ({ page }) => {
      const copy = t.tools.priority
      await page.goto(`/${locale}/tools/priority/`)
      const result = page.getByRole('status')
      await expect(result).toContainText(copy.statuses.waiting)
      const add = page.getByRole('button', { name: copy.add })
      await expect(async () => {
        await add.click()
        await expect(page.getByLabel(copy.statusLabel)).toHaveCount(4)
      }).toPass()
      await page.getByLabel(copy.statusLabel).nth(3).selectOption('error')
      await expect(result.locator('.tool-result-value')).toContainText(copy.statuses.error)
      await expect(page.locator('[data-tool-guide]')).toHaveAttribute(
        'href',
        `/${locale}/mods/pet/every-conversation/`,
      )
    })

    test(`/${locale}/tools/semver/ classifies versions in the browser`, async ({ page }) => {
      const requests: string[] = []
      page.on('request', (request) => requests.push(request.url()))
      const copy = t.tools.semver
      await page.goto(`/${locale}/tools/semver/`)

      const result = page.getByRole('status')
      await expect(result).toContainText(copy.groups.review)
      await expect(result).toContainText(copy.belowOne)

      const candidate = page.getByLabel(copy.candidateLabel)
      const installed = page.getByLabel(copy.installedLabel)
      await expect(async () => {
        await installed.fill('1.2.3')
        await candidate.fill('1.2.4')
        await expect(result).toContainText(copy.groups.bump)
      }).toPass()
      await expect(result).not.toContainText(copy.belowOne)
      await expect(page).toHaveURL(`/${locale}/tools/semver/`)

      await expect(page.locator('[data-tool-guide]')).toHaveAttribute(
        'href',
        `/${locale}/mods/check/classifying-updates/`,
      )
      const origin = new URL(page.url()).origin
      expect(requests.filter((url) => !url.startsWith(origin))).toEqual([])
    })
  }
})
