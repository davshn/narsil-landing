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
