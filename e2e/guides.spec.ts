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

  for (const path of [
    '/en/',
    '/en/support/',
    '/en/mods/',
    `/en/mods/${FIRST_GUIDE}/`,
    '/en/mods/pet/',
    '/en/mods/pet/every-conversation/',
  ]) {
    test(`${path} links to no private repository`, async ({ page }) => {
      await page.goto(path)
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
      expect(hrefs.filter((href) => PRIVATE_REPOSITORIES.test(href))).toEqual([])
    })
  }
})

const PET_GUIDES = [
  'states',
  'art-and-animations',
  'every-conversation',
  'tasks-and-subagents',
  'floating-window',
  'voice-and-alerts',
  'context-and-limits',
  'cache-clock',
  'command-reactions',
  'waiting-permissions',
  'tips-with-haiku',
  'next-steps',
  'experience-and-growth',
  'quiet-mode',
  'phone-and-watch',
  'session-summary',
  'your-commands',
]

test.describe('Status pet path', () => {
  for (const locale of locales) {
    const t = useTranslations(locale)

    test(`/${locale}/mods/pet/ lists the pet guides in order`, async ({ page }) => {
      await page.goto(`/${locale}/mods/pet/`)
      await expect(page.getByRole('heading', { level: 1, name: t.pet.title })).toBeVisible()
      const hrefs = await page
        .locator('[data-guide-list] a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
      expect(hrefs).toEqual(PET_GUIDES.map((slug) => `/${locale}/mods/pet/${slug}/`))
    })

    test(`/${locale}/ links the first learning path to the pet path`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      await page.locator('#routes .features-item-link').first().click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/mods/pet/$`, 'v'))
    })
  }

  for (const slug of PET_GUIDES) {
    test(`/en/mods/pet/${slug}/ follows the path template`, async ({ page }) => {
      await page.goto(`/en/mods/pet/${slug}/`)
      await expect(page.locator('[data-guide-body] > h2')).toHaveText([
        'What it does',
        'How it works inside',
        'How it was asked of the AI',
        'The minimal code',
        'Common mistakes and how to test it',
        'Going further',
      ])
      await expect(page.locator('.guide-breadcrumb a').nth(1)).toHaveAttribute(
        'href',
        '/en/mods/pet/',
      )
      await expect(page.locator('[data-guide-sources] a').first()).toHaveAttribute(
        'href',
        /^https:\/\/github\.com\/davshn\/narsil-pet\/blob\/main\//v,
      )
    })
  }
})

const CHECK_GUIDES = [
  'side-panel',
  'session-environment',
  'connectors',
  'pr-ci',
  'branch-behind',
  'ecosystems',
  'classifying-updates',
  'blocking-dependencies',
  'release-age',
  'pinned-versions',
  'explain-major',
  'trivial-updates',
  'creating-the-pr',
  'vulnerabilities',
  'to-dos',
  'tools-for-claude',
  'kotlin-gradle-agp',
]

test.describe('Review panel path', () => {
  for (const locale of locales) {
    const t = useTranslations(locale)

    test(`/${locale}/mods/check/ lists the check guides in order`, async ({ page }) => {
      await page.goto(`/${locale}/mods/check/`)
      await expect(page.getByRole('heading', { level: 1, name: t.check.title })).toBeVisible()
      const hrefs = await page
        .locator('[data-guide-list] a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
      expect(hrefs).toEqual(CHECK_GUIDES.map((slug) => `/${locale}/mods/check/${slug}/`))
    })

    test(`/${locale}/ links the second learning path to the check path`, async ({ page }) => {
      await page.goto(`/${locale}/`)
      await page.locator('#routes .features-item-link').nth(1).click()
      await expect(page).toHaveURL(new RegExp(`/${locale}/mods/check/$`, 'v'))
    })
  }

  for (const slug of CHECK_GUIDES) {
    test(`/en/mods/check/${slug}/ follows the path template`, async ({ page }) => {
      await page.goto(`/en/mods/check/${slug}/`)
      await expect(page.locator('[data-guide-body] > h2')).toHaveText([
        'What it does',
        'How it works inside',
        'How it was asked of the AI',
        'The minimal code',
        'Common mistakes and how to test it',
        'Going further',
      ])
      await expect(page.locator('.guide-breadcrumb a').nth(1)).toHaveAttribute(
        'href',
        '/en/mods/check/',
      )
      await expect(page.locator('[data-guide-sources] a').first()).toHaveAttribute(
        'href',
        /^https:\/\/github\.com\/davshn\/narsil-check\/blob\/main\//v,
      )
    })
  }
})

test.describe('Guide workshop layout', () => {
  const GUIDE = '/en/mods/pet/art-and-animations/'
  const t = useTranslations('en')

  test('shows the path and the table of contents beside the text on a wide screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(GUIDE)
    const path = page.getByRole('navigation', { name: t.guide.pathNavLabel })
    await expect(path).toBeVisible()
    await expect(path.locator('[aria-current="page"]')).toHaveAttribute('href', GUIDE)
    await expect(path.locator('.guide-path-link')).toHaveCount(PET_GUIDES.length)
    const toc = page.getByRole('navigation', { name: t.guide.tocTitle })
    await expect(toc).toBeVisible()
    await expect(toc.locator('a').first()).toHaveAttribute('href', '#what-it-does')
    await expect(page.locator('.guide-disclosures')).toBeHidden()
  })

  test('marks the section the reader scrolled to', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(GUIDE)
    await page.evaluate(() => {
      document.querySelectorAll('[data-guide-body] > h2')[3]?.scrollIntoView({ block: 'start' })
    })
    const toc = page.getByRole('navigation', { name: t.guide.tocTitle })
    await expect(toc.locator('[aria-current="location"]')).toHaveText('The minimal code')
  })

  test('folds the path and the table of contents above the text on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(GUIDE)
    await expect(page.getByRole('navigation', { name: t.guide.pathNavLabel })).toBeHidden()
    const path = page.locator('.guide-disclosure-path')
    await expect(path).toBeVisible()
    await path.locator('summary').click()
    await expect(path.locator('[aria-current="page"]')).toBeVisible()
    await page.locator('.guide-disclosure-toc summary').click()
    await page.locator('.guide-disclosure-toc a', { hasText: 'Going further' }).click()
    await expect(page).toHaveURL(/#going-further$/v)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})
