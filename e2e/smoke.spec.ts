import { expect, test } from '@playwright/test'

import { en } from '../src/i18n/locales/en'
import { es } from '../src/i18n/locales/es'

test.describe('Landing page smoke tests', () => {
  test('root redirects to a locale', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/(?:en|es)\//v)
  })

  test('/en/ renders the English landing page', async ({ page }) => {
    await page.goto('/en/')
    await expect(page).toHaveTitle(en.meta.title)
    await expect(page.getByRole('heading', { level: 1, name: en.meta.title })).toBeVisible()
  })

  test('/es/ renders the Spanish landing page', async ({ page }) => {
    await page.goto('/es/')
    await expect(page).toHaveTitle(es.meta.title)
    await expect(page.getByRole('heading', { level: 1, name: es.meta.title })).toBeVisible()
  })

  test('has correct lang attribute', async ({ page }) => {
    await page.goto('/en/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.goto('/es/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  })

  test('main landmark exists with id', async ({ page }) => {
    await page.goto('/en/')
    const main = page.locator('main#main-content')
    await expect(main).toBeVisible()
  })

  test('skip-to-content link is present and targets main', async ({ page }) => {
    await page.goto('/en/')
    const skipLink = page.locator('a.skip-to-content')
    await expect(skipLink).toHaveAttribute('href', '#main-content')
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
