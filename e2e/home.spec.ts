import { expect, test } from '@playwright/test'

import { useTranslations } from '../src/i18n/utils'

const t = useTranslations('en')

test.describe('Home layout', () => {
  test('leads with the five paths right after the hero, each with its guide count', async ({
    page,
  }) => {
    await page.goto('/en/')
    const headings = await page.locator('main h2').allTextContents()
    expect(headings[0]?.trim()).toBe(t.home.routesTitle)
    const links = page.locator('#routes .path-card-link')
    await expect(links).toHaveText(t.home.routes.map((route) => route.title))
    await expect(links.nth(2)).toHaveAttribute('href', '/en/bot/')
    await expect(links.nth(3)).toHaveAttribute('href', '/en/android/')
    await expect(links.nth(4)).toHaveAttribute('href', '/en/watch/')
    await expect(page.locator('#routes .path-card-meta')).toHaveCount(5)
    await expect(page.locator('#routes .path-card-meta').nth(3)).toHaveText('7 guides')
    await expect(page.locator('#routes .path-card-meta').nth(4)).toHaveText('5 guides')
    await expect(page.locator('#routes .path-card-badge')).toHaveText([
      t.home.apps.badge,
      t.home.apps.badge,
    ])
  })

  test('links each public repository from its path card', async ({ page }) => {
    await page.goto('/en/')
    const repos = page.locator('#routes .path-card-repo')
    await expect(repos).toHaveText([
      'See narsil-pet on GitHub',
      'See narsil-check on GitHub',
      'See narsil-android on GitHub',
      'See narsil-watch on GitHub',
    ])
    await expect(repos.nth(0)).toHaveAttribute('href', 'https://github.com/davshn/narsil-pet')
    await expect(repos.nth(1)).toHaveAttribute('href', 'https://github.com/davshn/narsil-check')
    await expect(repos.nth(2)).toHaveAttribute('href', 'https://github.com/davshn/narsil-android')
    await expect(repos.nth(3)).toHaveAttribute('href', 'https://github.com/davshn/narsil-watch')
    await expect(repos.nth(0)).toHaveAttribute('target', '_blank')
    await repos.nth(0).click({ trial: true })
  })

  test('switches the showcase between its interfaces with tabs', async ({ page }) => {
    await page.goto('/en/')
    const [window, panel, phone] = t.home.showcase.items
    const tablist = page.getByRole('tablist', { name: t.home.showcase.title })
    await expect(tablist).toBeVisible()
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
    await expect(page.getByRole('tabpanel')).toContainText(window.text)

    await page.getByRole('tab', { name: phone.title }).click()
    await expect(page.getByRole('tab', { name: phone.title })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tabpanel')).toContainText(phone.text)

    await page.getByRole('tab', { name: phone.title }).press('ArrowLeft')
    await expect(page.getByRole('tab', { name: panel.title })).toBeFocused()
    await expect(page.getByRole('tabpanel')).toContainText(panel.text)
  })

  test('scrolls the state poses sideways on a phone without widening the page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/en/')
    const row = page.getByRole('region', { name: t.home.states.title })
    const sizes = await row.evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }))
    expect(sizes.scroll).toBeGreaterThan(sizes.client)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})
