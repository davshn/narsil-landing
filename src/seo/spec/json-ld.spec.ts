import { describe, expect, it } from 'vitest'

import {
  buildFAQPage,
  buildOrganization,
  buildSoftwareApplication,
  buildWebPage,
  buildWebSite,
} from '../json-ld'

describe('buildWebSite', () => {
  it('sets correct @context and @type', () => {
    const result = buildWebSite({ name: 'Acme', url: 'https://acme.com' })
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('WebSite')
  })

  it('includes name and url', () => {
    const result = buildWebSite({ name: 'Acme', url: 'https://acme.com' })
    expect(result.name).toBe('Acme')
    expect(result.url).toBe('https://acme.com')
  })

  it('includes description when provided', () => {
    const result = buildWebSite({
      name: 'Acme',
      url: 'https://acme.com',
      description: 'A great site',
    })
    expect(result.description).toBe('A great site')
  })

  it('omits description key when not provided', () => {
    const result = buildWebSite({ name: 'Acme', url: 'https://acme.com' })
    expect(Object.keys(result)).not.toContain('description')
  })
})

describe('buildOrganization', () => {
  it('sets correct @context and @type', () => {
    const result = buildOrganization({ name: 'Acme', url: 'https://acme.com' })
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Organization')
  })

  it('includes name and url', () => {
    const result = buildOrganization({ name: 'Acme', url: 'https://acme.com' })
    expect(result.name).toBe('Acme')
    expect(result.url).toBe('https://acme.com')
  })

  it('includes logo when provided', () => {
    const result = buildOrganization({
      name: 'Acme',
      url: 'https://acme.com',
      logo: 'https://acme.com/logo.png',
    })
    expect(result.logo).toBe('https://acme.com/logo.png')
  })

  it('omits logo key when not provided', () => {
    const result = buildOrganization({ name: 'Acme', url: 'https://acme.com' })
    expect(Object.keys(result)).not.toContain('logo')
  })

  it('includes sameAs when provided', () => {
    const sameAs = ['https://twitter.com/acme', 'https://linkedin.com/company/acme']
    const result = buildOrganization({ name: 'Acme', url: 'https://acme.com', sameAs })
    expect(result.sameAs).toEqual(sameAs)
  })

  it('omits sameAs key when not provided', () => {
    const result = buildOrganization({ name: 'Acme', url: 'https://acme.com' })
    expect(Object.keys(result)).not.toContain('sameAs')
  })
})

describe('buildWebPage', () => {
  it('sets correct @context and @type', () => {
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/' })
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('WebPage')
  })

  it('includes name and url', () => {
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/' })
    expect(result.name).toBe('Home')
    expect(result.url).toBe('https://acme.com/')
  })

  it('includes description when provided', () => {
    const result = buildWebPage({
      name: 'Home',
      url: 'https://acme.com/',
      description: 'Welcome page',
    })
    expect(result.description).toBe('Welcome page')
  })

  it('omits description key when not provided', () => {
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/' })
    expect(Object.keys(result)).not.toContain('description')
  })

  it('includes isPartOf when provided', () => {
    const isPartOf = { '@type': 'WebSite' as const, name: 'Acme', url: 'https://acme.com' }
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/', isPartOf })
    expect(result.isPartOf).toEqual(isPartOf)
  })

  it('omits isPartOf key when not provided', () => {
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/' })
    expect(Object.keys(result)).not.toContain('isPartOf')
  })
})

describe('buildSoftwareApplication', () => {
  const base = {
    name: 'Acme App',
    description: 'The best app ever.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: 'https://acme.com',
  }

  it('sets correct @context and @type', () => {
    const result = buildSoftwareApplication(base)
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('SoftwareApplication')
  })

  it('includes all required fields', () => {
    const result = buildSoftwareApplication(base)
    expect(result.name).toBe('Acme App')
    expect(result.description).toBe('The best app ever.')
    expect(result.applicationCategory).toBe('BusinessApplication')
    expect(result.operatingSystem).toBe('Web browser')
    expect(result.url).toBe('https://acme.com')
  })

  it('includes featureList when provided', () => {
    const featureList = ['Reporting', 'Automation', 'Integrations']
    const result = buildSoftwareApplication({ ...base, featureList })
    expect(result.featureList).toEqual(featureList)
  })

  it('omits featureList key when not provided', () => {
    const result = buildSoftwareApplication(base)
    expect(Object.keys(result)).not.toContain('featureList')
  })

  it('includes offers with @type Offer when provided', () => {
    const result = buildSoftwareApplication({
      ...base,
      offers: { price: '0', priceCurrency: 'USD' },
    })
    expect(result.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' })
  })

  it('omits offers key when not provided', () => {
    const result = buildSoftwareApplication(base)
    expect(Object.keys(result)).not.toContain('offers')
  })
})

describe('buildFAQPage', () => {
  it('sets correct @context and @type', () => {
    const result = buildFAQPage([])
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('FAQPage')
  })

  it('maps each item to a Question/Answer structure', () => {
    const result = buildFAQPage([
      { question: 'What is Acme?', answer: 'A great company.' },
      { question: 'How much does it cost?', answer: 'It is free.' },
    ])
    expect(result.mainEntity).toHaveLength(2)
    expect(result.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'What is Acme?',
      acceptedAnswer: { '@type': 'Answer', text: 'A great company.' },
    })
    expect(result.mainEntity[1]).toEqual({
      '@type': 'Question',
      name: 'How much does it cost?',
      acceptedAnswer: { '@type': 'Answer', text: 'It is free.' },
    })
  })

  it('returns empty mainEntity for empty input', () => {
    const result = buildFAQPage([])
    expect(result.mainEntity).toHaveLength(0)
  })
})

describe('inLanguage', () => {
  it('buildWebSite includes inLanguage when provided', () => {
    const result = buildWebSite({ name: 'Acme', url: 'https://acme.com', inLanguage: 'es' })
    expect(result.inLanguage).toBe('es')
  })

  it('buildWebSite omits inLanguage key when not provided', () => {
    const result = buildWebSite({ name: 'Acme', url: 'https://acme.com' })
    expect('inLanguage' in result).toBe(false)
  })

  it('buildWebPage includes inLanguage when provided', () => {
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/es/', inLanguage: 'es' })
    expect(result.inLanguage).toBe('es')
  })

  it('buildWebPage omits inLanguage key when not provided', () => {
    const result = buildWebPage({ name: 'Home', url: 'https://acme.com/' })
    expect('inLanguage' in result).toBe(false)
  })
})
