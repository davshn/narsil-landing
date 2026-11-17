import { expect, test, type Page } from '@playwright/test'

function collectCspViolations(page: Page): string[] {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      violations.push(message.text())
    }
  })
  return violations
}

test.describe('Content Security Policy', () => {
  for (const path of ['/en/', '/es/', '/en/support/']) {
    test(`${path} ships a hash-based script policy and runs without violations`, async ({
      page,
    }) => {
      const violations = collectCspViolations(page)
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const policy = await page
        .locator('meta[http-equiv="content-security-policy"]')
        .getAttribute('content')
      expect(policy).toContain("script-src 'self' 'sha256-")
      expect(policy).toContain("object-src 'none'")
      expect(violations).toEqual([])
    })
  }

  test('the root page redirects through its hashed inline script', async ({ page }) => {
    const violations = collectCspViolations(page)
    await page.goto('/')

    await expect(page).toHaveURL(/\/(?:en|es|it|fr|pt)\/$/v)
    expect(violations).toEqual([])
  })

  test('the hashed theme toggle script still switches the theme', async ({ page }) => {
    const violations = collectCspViolations(page)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/en/')
    const toggle = page.locator('#theme-toggle').first()

    await toggle.click()
    await toggle.click()

    await expect(page.locator('html')).toHaveClass(/dark/v)
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark')
    expect(violations).toEqual([])
  })

  test('blocks an injected inline script', async ({ page }) => {
    await page.goto('/en/')

    const ran = await page.evaluate(async () => {
      const script = document.createElement('script')
      script.textContent = 'window.__cspProbe = true'
      document.body.append(script)
      await new Promise((resolve) => setTimeout(resolve, 50))
      return 'cspProbe' in window || '__cspProbe' in window
    })

    expect(ran).toBe(false)
  })
})
