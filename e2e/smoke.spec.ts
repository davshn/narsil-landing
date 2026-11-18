import { expect, test } from '@playwright/test'

import { languageTags, locales } from '../src/i18n/index'
import { useTranslations } from '../src/i18n/utils'

test.describe('Landing page smoke tests', () => {
  test('root redirects to a locale', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/(?:en|es|it|fr|pt)\/$/v)
  })

  for (const locale of locales) {
    const t = useTranslations(locale)

    test(`/${locale}/ renders the home page`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      await expect(page).toHaveTitle(t.meta.title)
      await expect(page.locator('html')).toHaveAttribute('lang', languageTags[locale])
      await expect(page.getByRole('heading', { level: 1, name: t.home.headline })).toBeVisible()
      await expect(page.locator('#routes .features-title')).toHaveText(t.home.routesTitle)
      const extension = page.locator('[data-extension]')
      await expect(extension).toContainText(t.home.extension.badge)
      await expect(extension.getByRole('heading', { name: t.home.extension.title })).toBeVisible()
    })

    test(`/${locale}/support/ lists the coffee link and the public mod repositories`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/support/`)
      await expect(page.getByRole('heading', { level: 1, name: t.support.title })).toBeVisible()
      await expect(page.locator('main [data-donate]')).toHaveAttribute(
        'href',
        'https://paypal.me/davshn',
      )
      await expect(page.locator('[data-repositories] a')).toHaveText([
        t.support.repos.pet,
        t.support.repos.check,
      ])
    })

    test(`/${locale}/support/ shows where the coffee goes and the developer portfolio`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/support/`)
      const flow = page.locator('[data-support-flow]')
      await expect(
        flow.getByRole('heading', { level: 2, name: t.support.flow.title }),
      ).toBeVisible()
      await expect(flow.locator('ol li')).toHaveText(t.support.flow.steps)
      await expect(flow.locator('ul li')).toHaveText(t.support.flow.promises)
      const about = page.locator('[data-support-about]')
      await expect(
        about.getByRole('heading', { level: 2, name: t.support.about.title }),
      ).toBeVisible()
      await expect(about).toContainText(t.support.about.name)
      await expect(about).toContainText(t.support.about.bio)
      const portfolio = about.locator('[data-developer-profile]')
      await expect(portfolio).toHaveText(t.support.developer.link)
      await expect(portfolio).toHaveAttribute('href', 'https://davshn.tech/en')
    })
  }

  test('the footer shows the coffee button and the trademark notice', async ({ page }) => {
    const t = useTranslations('en')
    await page.goto('/en/')
    const footer = page.locator('footer')
    await expect(footer.locator('[data-donate]')).toHaveText(t.footer.donate)
    await expect(footer).toContainText(t.footer.trademark)
    await expect(footer).toContainText(t.footer.license)
  })

  test('main landmark exists with id', async ({ page }) => {
    await page.goto('/en/')
    await expect(page.locator('main#main-content')).toBeVisible()
  })

  test('skip-to-content link is present and targets main', async ({ page }) => {
    await page.goto('/en/')
    await expect(page.locator('a.skip-to-content')).toHaveAttribute('href', '#main-content')
  })

  test('theme toggle exists and is accessible', async ({ page }) => {
    await page.goto('/en/')
    const toggle = page.locator('#theme-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-label', 'Toggle theme')
  })

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('/en/')
    const html = page.locator('html')
    const toggle = page.locator('#theme-toggle')

    await toggle.click()
    await toggle.click()
    await expect(html).toHaveClass(/dark/v)

    await toggle.click()
  })
})
