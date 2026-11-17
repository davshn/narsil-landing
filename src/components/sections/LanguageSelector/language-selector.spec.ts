// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { localeNames, locales } from '@i18n/index'

import { render } from '../../../test-render'

import LanguageSelector from './LanguageSelector.astro'

const renderSelector = async (props: Record<string, unknown> = {}): ReturnType<typeof render> =>
  await render(LanguageSelector, {
    props: { locale: 'en', pathname: '/en/tools/95/', label: 'Language', ...props },
  })

const linkAttributes = async (
  name: string,
  props: Record<string, unknown> = {},
): Promise<Array<string | null>> => {
  const host = await renderSelector(props)
  return [...host.querySelectorAll('a')].map((a) => a.getAttribute(name))
}

describe('LanguageSelector', () => {
  it('is a disclosure that works without JavaScript', async () => {
    const host = await renderSelector()

    expect(host.querySelector('details > summary')).not.toBeNull()
    expect(host.querySelector('details')?.hasAttribute('open')).toBe(false)
    expect(host.querySelector('script')).toBeNull()
  })

  it('names the summary with the label and the current language', async () => {
    const host = await renderSelector({ locale: 'fr', pathname: '/fr/' })
    const summary = host.querySelector('summary')?.textContent.replace(/\s+/gv, ' ').trim()

    expect(summary).toBe('Language: Français')
  })

  it('renders one link per locale labelled with its native name', async () => {
    const host = await renderSelector()
    const labels = [...host.querySelectorAll('a')].map((a) => a.textContent.trim())

    expect(labels).toEqual(locales.map((locale) => localeNames[locale]))
  })

  it('points every link to the same page in that locale', async () => {
    expect(await linkAttributes('href')).toEqual([
      '/en/tools/95/',
      '/es/tools/95/',
      '/it/tools/95/',
      '/fr/tools/95/',
      '/pt/tools/95/',
    ])
  })

  it('points to the locale home from a home page', async () => {
    expect(await linkAttributes('href', { locale: 'pt', pathname: '/pt/' })).toEqual([
      '/en/',
      '/es/',
      '/it/',
      '/fr/',
      '/pt/',
    ])
  })

  it('sets hreflang and lang from the language tags', async () => {
    const expected = ['en', 'es', 'it', 'fr', 'pt-BR']

    expect(await linkAttributes('hreflang')).toEqual(expected)
    expect(await linkAttributes('lang')).toEqual(expected)
  })

  it('marks only the current locale with aria-current', async () => {
    expect(await linkAttributes('aria-current', { locale: 'it', pathname: '/it/' })).toEqual([
      null,
      null,
      'true',
      null,
      null,
    ])
  })

  it('renders no id so it can appear twice on a page', async () => {
    const host = await renderSelector()

    expect(host.querySelectorAll('[id]:not(symbol)')).toHaveLength(0)
  })

  it('renders a dropdown by default and a static list inline', async () => {
    const dropdown = await renderSelector()
    const inline = await renderSelector({ placement: 'inline' })

    expect(dropdown.querySelector('details')?.className).toBe('language-selector')
    expect(inline.querySelector('details')?.className).toBe(
      'language-selector language-selector-inline',
    )
  })
})
