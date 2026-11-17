import { expect, test } from '@playwright/test'

test.describe('Component scripts bind once per instance', () => {
  test('every dropdown opens on its first click and closes on the second', async ({ page }) => {
    await page.goto('/en/#dropdown')

    const states = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-dropdown]')].map((wrapper) => {
        const trigger = wrapper.querySelector<HTMLElement>('[data-dropdown-trigger]')
        trigger?.click()
        const opened = wrapper.classList.contains('dropdown-open')
        trigger?.click()
        return [opened, wrapper.classList.contains('dropdown-open')]
      }),
    )

    expect(states.length).toBeGreaterThan(1)
    expect(states.every(([opened, closed]) => opened && !closed)).toBe(true)
  })

  test('every header mobile toggle expands on its first click', async ({ page }) => {
    await page.goto('/en/#header')

    const expanded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-header-toggle]')].map((toggle) => {
        toggle.click()
        return toggle.getAttribute('aria-expanded')
      }),
    )

    expect(expanded.length).toBeGreaterThan(1)
    expect(expanded.every((value) => value === 'true')).toBe(true)
  })
})
