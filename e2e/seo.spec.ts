import { expect, test, type Page } from '@playwright/test'

interface Node {
  '@type': string
  [key: string]: unknown
}

async function jsonLdOf(page: Page): Promise<Node[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
  return blocks.flatMap((text) => {
    const data: unknown = JSON.parse(text)
    return (Array.isArray(data) ? data : [data]) as Node[]
  })
}

const typesOf = (nodes: Node[]): string[] => nodes.map((node) => node['@type'])

test.describe('Structured data and Open Graph', () => {
  test('a guide is a TechArticle with a breadcrumb, an article type and its language tag', async ({
    page,
  }) => {
    await page.goto('/pt/mods/pet/states/')
    const nodes = await jsonLdOf(page)
    expect(typesOf(nodes)).toEqual(['TechArticle', 'BreadcrumbList'])
    const [article, breadcrumb] = nodes
    expect(article).toMatchObject({ inLanguage: 'pt-BR', dateModified: expect.any(String) })
    expect(article?.headline).toBe(await page.getByRole('heading', { level: 1 }).textContent())
    const items = breadcrumb?.itemListElement as Array<{ item: string }>
    expect(items.map((entry) => new URL(entry.item).pathname)).toEqual([
      '/pt/',
      '/pt/mods/pet/',
      '/pt/mods/pet/states/',
    ])
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    await expect(page.locator('meta[property="article:modified_time"]')).toHaveAttribute(
      'content',
      /^\d{4}-\d{2}-\d{2}$/v,
    )
  })

  test('a path index is a WebPage with a breadcrumb', async ({ page }) => {
    await page.goto('/es/bot/')
    const nodes = await jsonLdOf(page)
    expect(typesOf(nodes)).toEqual(['WebPage', 'BreadcrumbList'])
    expect(nodes[0]).toMatchObject({ inLanguage: 'es' })
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
  })

  test('a tool is a free WebApplication with a breadcrumb', async ({ page }) => {
    await page.goto('/fr/tools/semver/')
    const nodes = await jsonLdOf(page)
    expect(typesOf(nodes)).toEqual(['WebApplication', 'BreadcrumbList'])
    expect(nodes[0]).toMatchObject({ inLanguage: 'fr', isAccessibleForFree: true })
    const items = nodes[1]?.itemListElement as Array<{ item: string }>
    expect(items.map((entry) => new URL(entry.item).pathname)).toEqual([
      '/fr/',
      '/fr/tools/',
      '/fr/tools/semver/',
    ])
  })
})
