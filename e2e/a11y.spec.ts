import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const PATHS = [
  '/en/',
  '/es/',
  '/it/',
  '/fr/',
  '/pt/',
  '/en/support/',
  '/en/mods/',
  '/en/mods/what-is-a-mod/',
  '/en/mods/the-dollar-object/',
  '/en/mods/pet/',
  '/en/mods/pet/states/',
  '/en/mods/pet/every-conversation/',
] as const
const COLOR_SCHEMES = ['light', 'dark'] as const

for (const path of PATHS) {
  for (const colorScheme of COLOR_SCHEMES) {
    test(`${path} has no WCAG A/AA violations in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await page.goto(path)

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

      const summary = violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target.join(' ')),
      }))

      expect(summary).toEqual([])
    })
  }
}
