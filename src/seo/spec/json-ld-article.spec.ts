import { describe, expect, it } from 'vitest'

import { buildBreadcrumbList, buildTechArticle, buildWebApplication } from '../json-ld'

const site = { '@type': 'WebSite' as const, name: 'Narsil Workshop', url: 'https://example.com/' }

describe('buildTechArticle', () => {
  it('describes a guide with its date, language, author and publisher', () => {
    expect(
      buildTechArticle({
        headline: 'States',
        description: 'How Narsil shows the state of a conversation.',
        url: 'https://example.com/pt/mods/pet/states/',
        inLanguage: 'pt-BR',
        dateModified: new Date('2026-11-17T00:00:00Z'),
        author: { name: 'Hernán David Figueroa', url: 'https://davshn.tech/en' },
        isPartOf: site,
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'States',
      description: 'How Narsil shows the state of a conversation.',
      url: 'https://example.com/pt/mods/pet/states/',
      mainEntityOfPage: 'https://example.com/pt/mods/pet/states/',
      inLanguage: 'pt-BR',
      dateModified: '2026-11-17',
      author: { '@type': 'Person', name: 'Hernán David Figueroa', url: 'https://davshn.tech/en' },
      publisher: { '@type': 'Organization', name: 'Narsil Workshop', url: 'https://example.com/' },
      isPartOf: site,
    })
  })
})

describe('buildBreadcrumbList', () => {
  it('numbers each step from one, in order', () => {
    expect(
      buildBreadcrumbList([
        { name: 'Narsil Workshop', url: 'https://example.com/en/' },
        { name: 'Status pet', url: 'https://example.com/en/mods/pet/' },
        { name: 'States', url: 'https://example.com/en/mods/pet/states/' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Narsil Workshop',
          item: 'https://example.com/en/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Status pet',
          item: 'https://example.com/en/mods/pet/',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'States',
          item: 'https://example.com/en/mods/pet/states/',
        },
      ],
    })
  })
})

describe('buildWebApplication', () => {
  it('describes a free tool that runs in any browser', () => {
    expect(
      buildWebApplication({
        name: 'Semver classifier',
        description: 'Sort an upgrade by how far apart the versions are.',
        url: 'https://example.com/en/tools/semver/',
        inLanguage: 'en',
        isPartOf: site,
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Semver classifier',
      description: 'Sort an upgrade by how far apart the versions are.',
      url: 'https://example.com/en/tools/semver/',
      inLanguage: 'en',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isPartOf: site,
    })
  })
})
