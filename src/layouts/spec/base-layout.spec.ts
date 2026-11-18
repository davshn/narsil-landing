// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../test-render'
import BaseLayout from '../BaseLayout.astro'

describe('BaseLayout', () => {
  it('does not disclose the framework version in a generator meta tag', async () => {
    const host = await render(BaseLayout, { props: { title: 'Acme', description: 'Landing' } })

    expect(host.querySelector('meta[name="generator"]')).toBeNull()
    expect(host.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Landing')
  })

  it('marks a page as a website by default, with no article time', async () => {
    const host = await render(BaseLayout, { props: { title: 'Acme', description: 'Landing' } })

    expect(host.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('website')
    expect(host.querySelector('meta[property="article:modified_time"]')).toBeNull()
  })

  it('marks an article with the time it was last changed', async () => {
    const host = await render(BaseLayout, {
      props: {
        title: 'States',
        description: 'Guide',
        og: { type: 'article', modifiedTime: '2026-11-17' },
      },
    })

    expect(host.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article')
    expect(
      host.querySelector('meta[property="article:modified_time"]')?.getAttribute('content'),
    ).toBe('2026-11-17')
  })

  it('keeps a closing script tag in JSON-LD data inside the JSON-LD block', async () => {
    const name = '</script><img src=x onerror=alert(1)>'
    const host = await render(BaseLayout, {
      props: { title: 'Acme', description: 'Landing', jsonLd: { '@type': 'WebPage', name } },
    })
    const script = host.querySelector('script[type="application/ld+json"]')
    const data: unknown = JSON.parse(script?.textContent ?? '{}')

    expect(host.querySelector('img')).toBeNull()
    expect(data).toMatchObject({ name })
  })
})
