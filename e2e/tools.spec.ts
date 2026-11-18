import { expect, test } from '@playwright/test'

import { locales } from '../src/i18n/index'
import { useTranslations } from '../src/i18n/utils'

test.describe('Interactive tools', () => {
  for (const locale of locales) {
    const t = useTranslations(locale)

    test(`/${locale}/tools/ is in the header and lists the semver classifier`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      const navLink = page.locator(`header a[href="/${locale}/tools/"]`).first()
      await expect(navLink).toHaveText(t.nav.tools)

      await page.goto(`/${locale}/tools/`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.tools.title)
      const link = page.locator('[data-tool-list] a')
      await expect(link).toHaveCount(1)
      await expect(link).toHaveAttribute('href', `/${locale}/tools/semver/`)
      await expect(link).toHaveText(t.tools.semver.title)
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
