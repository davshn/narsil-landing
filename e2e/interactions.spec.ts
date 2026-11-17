import { expect, test } from '@playwright/test'

test.describe('Component scripts', () => {
  test('the header mobile toggle expands on its first click and collapses on the second', async ({
    page,
  }) => {
    await page.goto('/en/')

    const states = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-header-toggle]')].map((toggle) => {
        toggle.click()
        const opened = toggle.getAttribute('aria-expanded')
        toggle.click()
        return [opened, toggle.getAttribute('aria-expanded')]
      }),
    )

    expect(states).toEqual([['true', 'false']])
  })
})
