import { describe, expect, it } from 'vitest'

import { buildRobotsTxt } from '../robots-txt'

describe('buildRobotsTxt', () => {
  it('includes the standard allow directive', () => {
    const result = buildRobotsTxt(undefined)
    expect(result).toContain('User-agent: *')
    expect(result).toContain('Allow: /')
  })

  it('allows the main AI crawlers', () => {
    const result = buildRobotsTxt(undefined)
    expect(result).toContain('User-agent: GPTBot')
    expect(result).toContain('User-agent: ClaudeBot')
    expect(result).toContain('User-agent: PerplexityBot')
    expect(result).toContain('User-agent: Google-Extended')
  })

  it('includes the Sitemap directive when site is configured', () => {
    const result = buildRobotsTxt(new URL('https://example.com'))
    expect(result).toContain('Sitemap: https://example.com/sitemap-index.xml')
  })

  it('omits the Sitemap directive when site is not configured', () => {
    const result = buildRobotsTxt(undefined)
    expect(result).not.toContain('Sitemap:')
  })

  it('points Sitemap at the sitemap index file', () => {
    const result = buildRobotsTxt(new URL('https://my-product.com/'))
    expect(result).toContain('Sitemap: https://my-product.com/sitemap-index.xml')
  })
})
