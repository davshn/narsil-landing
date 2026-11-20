// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { locales } from '../../../i18n/index'
import { useTranslations } from '../../../i18n/utils'
import { render } from '../../../test-render'
import { DEVELOPER_PROFILE_URL } from '../../../utils/developer'

import DeveloperAbout from './DeveloperAbout.astro'

describe('DeveloperAbout', () => {
  it('renders a labelled section with the title, name, and bio', async () => {
    const { support: copy } = useTranslations('en')
    const host = await render(DeveloperAbout, { props: { copy } })
    const section = host.querySelector('section[data-support-about]')
    const heading = section?.querySelector('h2')

    expect(heading?.textContent.trim()).toBe('About the developer')
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.getAttribute('id'))
    expect(section?.querySelector('[data-developer-name]')?.textContent.trim()).toBe(
      'Hernán David Figueroa',
    )
    expect(section?.querySelector('[data-developer-bio]')?.textContent.trim()).toBe(copy.about.bio)
  })

  it('renders the photo as an optimized picture with localized alt text', async () => {
    const { support: copy } = useTranslations('es')
    const host = await render(DeveloperAbout, { props: { copy } })
    const img = host.querySelector('picture img')

    expect(img?.getAttribute('alt')).toBe('Foto de Hernán David Figueroa')
    expect(img?.getAttribute('width')).toBe('160')
    expect(img?.getAttribute('height')).toBe('160')
    expect(host.querySelector('picture source[type="image/avif"]')).not.toBeNull()
    expect(host.querySelector('picture source[type="image/webp"]')).not.toBeNull()
  })

  it('links to the developer profile in a new tab', async () => {
    const { support: copy } = useTranslations('en')
    const host = await render(DeveloperAbout, { props: { copy } })
    const link = host.querySelector('a[data-developer-profile]')

    expect(link?.getAttribute('href')).toBe(DEVELOPER_PROFILE_URL)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener')
    expect(link?.textContent.trim()).toBe('See my developer profile')
  })

  it.each(locales)('describes the %s work by sector without naming the employer', (locale) => {
    const {
      support: {
        about: { bio },
      },
    } = useTranslations(locale)

    expect(bio).not.toMatch(/colombi|gateway|pasarela|passerelle/iv)
    expect(bio.match(/fintech/giv)).toHaveLength(1)
  })

  it.each(locales)('names the developer in the %s photo alt text', async (locale) => {
    const { support: copy } = useTranslations(locale)
    const host = await render(DeveloperAbout, { props: { copy } })

    expect(host.querySelector('img')?.getAttribute('alt')).toContain('Hernán David Figueroa')
  })
})
