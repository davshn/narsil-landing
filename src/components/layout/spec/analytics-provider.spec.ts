// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { render } from '../../../test-render'
import AnalyticsProvider from '../AnalyticsProvider.astro'

afterEach(() => {
  vi.unstubAllEnvs()
})

const scriptUrl = ['javascript', 'alert(1)'].join(':')

describe('AnalyticsProvider', () => {
  it('renders nothing when no provider is configured', async () => {
    const host = await render(AnalyticsProvider)

    expect(host.querySelectorAll('script')).toHaveLength(0)
  })

  it('keeps a closing script tag in the GA id inside the inline script', async () => {
    vi.stubEnv('PUBLIC_ANALYTICS_GA_ID', 'G-1</script><img src=x onerror=alert(1)>')
    const host = await render(AnalyticsProvider)
    const scripts = [...host.querySelectorAll('script')]
    const inline = scripts.find((s) => s.getAttribute('src') === null)

    expect(host.querySelector('img')).toBeNull()
    expect(inline?.textContent).toContain('onerror=alert(1)')
    expect(inline?.textContent).not.toContain('</script')
  })

  it('URL-encodes the GA id in the gtag loader URL', async () => {
    vi.stubEnv('PUBLIC_ANALYTICS_GA_ID', 'G-1&x=y')
    const host = await render(AnalyticsProvider)
    const loader = host.querySelector('script[src^="https://www.googletagmanager.com"]')

    expect(loader?.getAttribute('src')).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-1%26x%3Dy',
    )
  })

  it('keeps a closing script tag in the PostHog settings inside the inline script', async () => {
    vi.stubEnv('PUBLIC_ANALYTICS_POSTHOG_KEY', 'phc_</script><b>x</b>')
    vi.stubEnv('PUBLIC_ANALYTICS_POSTHOG_HOST', 'https://eu.posthog.com')
    const host = await render(AnalyticsProvider)
    const inline = host.querySelector('script')?.textContent

    expect(host.querySelector('b')).toBeNull()
    expect(inline).toContain('posthog.init("phc_')
    expect(inline).not.toContain('</script')
  })
})

describe('AnalyticsProvider script origins', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads Umami from an https origin', async () => {
    vi.stubEnv('PUBLIC_ANALYTICS_UMAMI_ID', 'site-1')
    vi.stubEnv('PUBLIC_ANALYTICS_UMAMI_SRC', 'https://umami.example.com/script.js')
    const host = await render(AnalyticsProvider)

    expect(host.querySelector('script[data-website-id="site-1"]')?.getAttribute('src')).toBe(
      'https://umami.example.com/script.js',
    )
  })

  it.each(['http://umami.example.com/script.js', scriptUrl, '//umami.example.com/s.js'])(
    'does not load Umami from %j',
    async (src) => {
      vi.stubEnv('PUBLIC_ANALYTICS_UMAMI_ID', 'site-1')
      vi.stubEnv('PUBLIC_ANALYTICS_UMAMI_SRC', src)
      const host = await render(AnalyticsProvider)

      expect(host.querySelectorAll('script')).toHaveLength(0)
    },
  )

  it('does not load PostHog from an http host', async () => {
    vi.stubEnv('PUBLIC_ANALYTICS_POSTHOG_KEY', 'phc_key')
    vi.stubEnv('PUBLIC_ANALYTICS_POSTHOG_HOST', 'http://posthog.example.com')
    const host = await render(AnalyticsProvider)

    expect(host.querySelectorAll('script')).toHaveLength(0)
  })

  it('loads PostHog from an https host', async () => {
    vi.stubEnv('PUBLIC_ANALYTICS_POSTHOG_KEY', 'phc_key')
    vi.stubEnv('PUBLIC_ANALYTICS_POSTHOG_HOST', 'https://eu.posthog.com')
    const host = await render(AnalyticsProvider)

    expect(host.querySelector('script')?.textContent).toContain('"https://eu.posthog.com"')
  })
})
