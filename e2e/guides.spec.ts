import { expect, test } from '@playwright/test'

import { locales } from '../src/i18n/index'
import { useTranslations } from '../src/i18n/utils'

const FIRST_GUIDE = 'what-is-a-mod'
const PRIVATE_REPOSITORIES =
  /github\.com\/davshn\/(?:narsil-landing|narsil-claude|landingTemplate)/iv

test.describe('Mod fundamentals', () => {
  for (const locale of locales) {
    const t = useTranslations(locale)

    test(`/${locale}/mods/ lists five guides in order and starts with the first one`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/mods/`)
      await expect(page.getByRole('heading', { level: 1, name: t.mods.title })).toBeVisible()
      await expect(page.locator('[data-guide-list] > li')).toHaveCount(5)
      await page.getByRole('link', { name: t.mods.startCta }).click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/mods/${FIRST_GUIDE}/$`, 'v'))
    })

    test(`/${locale}/mods/${FIRST_GUIDE}/ renders the guide template`, async ({ page }) => {
      await page.goto(`/${locale}/mods/${FIRST_GUIDE}/`)
      await expect(page.locator('html')).toHaveAttribute('lang', /^[a-z]{2}(?:-[A-Z]{2})?$/v)
      await expect(page.locator('[data-guide-meta]')).toContainText('2.1.325')
      await expect(page.locator('[data-guide-body] h2')).toHaveCount(5)
      await expect(page.locator('[data-guide-body] pre.astro-code').first()).toBeVisible()
      await expect(page.locator('[data-guide-sources] a').first()).toHaveAttribute(
        'href',
        /^https:\/\/github\.com\/davshn\/narsil-(?:pet|check)\/blob\/main\//v,
      )
      await expect(page.locator('[data-direction="previous"]')).toHaveCount(0)
      await expect(page.locator('[data-direction="next"]')).toHaveCount(1)
      await expect(page.locator('main [data-donate]')).toHaveText(t.guide.coffeeCta)
    })
  }

  test('previous and next walk the whole path and stop at both ends', async ({ page }) => {
    await page.goto(`/en/mods/${FIRST_GUIDE}/`)
    const visited = [new URL(page.url()).pathname]
    for (let step = 0; step < 4; step += 1) {
      await page.locator('[data-direction="next"] a').click()
      visited.push(new URL(page.url()).pathname)
    }
    expect(new Set(visited).size).toBe(5)
    await expect(page.locator('[data-direction="next"]')).toHaveCount(0)
    await page.locator('[data-direction="previous"] a').click()
    expect(new URL(page.url()).pathname).toBe(visited[3])
  })

  test('the header marks the fundamentals link as current on a guide', async ({ page }) => {
    await page.goto(`/en/mods/${FIRST_GUIDE}/`)
    const link = page.locator('.header-nav a', { hasText: useTranslations('en').nav.mods })
    await expect(link).toHaveAttribute('data-active', 'true')
  })

  for (const path of ['/en/', '/en/support/', '/en/mods/', `/en/mods/${FIRST_GUIDE}/`]) {
    test(`${path} links to no private repository`, async ({ page }) => {
      await page.goto(path)
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
      expect(hrefs.filter((href) => PRIVATE_REPOSITORIES.test(href))).toEqual([])
    })
  }
})
