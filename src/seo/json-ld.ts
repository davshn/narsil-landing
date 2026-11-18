export interface WebSiteJsonLd {
  '@context': 'https://schema.org'
  '@type': 'WebSite'
  name: string
  url: string
  description?: string
  inLanguage?: string
}

export interface OrganizationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'Organization'
  name: string
  url: string
  logo?: string
  sameAs?: string[]
}

export interface WebPageJsonLd {
  '@context': 'https://schema.org'
  '@type': 'WebPage'
  name: string
  url: string
  description?: string
  inLanguage?: string
  isPartOf?: {
    '@type': 'WebSite'
    name: string
    url: string
  }
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FAQPageJsonLd {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: Array<{
    '@type': 'Question'
    name: string
    acceptedAnswer: {
      '@type': 'Answer'
      text: string
    }
  }>
}

export function buildWebSite({
  name,
  url,
  description,
  inLanguage,
}: {
  name: string
  url: string
  description?: string
  inLanguage?: string
}): WebSiteJsonLd {
  const result: WebSiteJsonLd = { '@context': 'https://schema.org', '@type': 'WebSite', name, url }
  if (description !== undefined) result.description = description
  if (inLanguage !== undefined) result.inLanguage = inLanguage
  return result
}

export function buildOrganization({
  name,
  url,
  logo,
  sameAs,
}: {
  name: string
  url: string
  logo?: string
  sameAs?: string[]
}): OrganizationJsonLd {
  const result: OrganizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
  }
  if (logo !== undefined) result.logo = logo
  if (sameAs !== undefined) result.sameAs = sameAs
  return result
}

export function buildWebPage({
  name,
  url,
  description,
  isPartOf,
  inLanguage,
}: {
  name: string
  url: string
  description?: string
  isPartOf?: { '@type': 'WebSite'; name: string; url: string }
  inLanguage?: string
}): WebPageJsonLd {
  const result: WebPageJsonLd = { '@context': 'https://schema.org', '@type': 'WebPage', name, url }
  if (description !== undefined) result.description = description
  if (isPartOf !== undefined) result.isPartOf = isPartOf
  if (inLanguage !== undefined) result.inLanguage = inLanguage
  return result
}

export interface SoftwareApplicationOffer {
  price: string
  priceCurrency: string
}

export interface SoftwareApplicationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'SoftwareApplication'
  name: string
  description: string
  applicationCategory: string
  operatingSystem: string
  url: string
  featureList?: string[]
  offers?: {
    '@type': 'Offer'
    price: string
    priceCurrency: string
  }
}

export function buildSoftwareApplication({
  name,
  description,
  applicationCategory,
  operatingSystem,
  url,
  featureList,
  offers,
}: {
  name: string
  description: string
  applicationCategory: string
  operatingSystem: string
  url: string
  featureList?: string[]
  offers?: SoftwareApplicationOffer
}): SoftwareApplicationJsonLd {
  const result: SoftwareApplicationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory,
    operatingSystem,
    url,
  }
  if (featureList !== undefined) result.featureList = featureList
  if (offers !== undefined) result.offers = { '@type': 'Offer', ...offers }
  return result
}

export function buildFAQPage(items: FaqItem[]): FAQPageJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question' as const,
      name: question,
      acceptedAnswer: { '@type': 'Answer' as const, text: answer },
    })),
  }
}

interface SiteReference {
  '@type': 'WebSite'
  name: string
  url: string
}

export interface TechArticleJsonLd {
  '@context': 'https://schema.org'
  '@type': 'TechArticle'
  headline: string
  description: string
  url: string
  mainEntityOfPage: string
  inLanguage: string
  dateModified: string
  author: { '@type': 'Person'; name: string; url: string }
  publisher: { '@type': 'Organization'; name: string; url: string }
  isPartOf: SiteReference
}

export function buildTechArticle({
  headline,
  description,
  url,
  inLanguage,
  dateModified,
  author,
  isPartOf,
}: {
  headline: string
  description: string
  url: string
  inLanguage: string
  dateModified: Date
  author: { name: string; url: string }
  isPartOf: SiteReference
}): TechArticleJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline,
    description,
    url,
    mainEntityOfPage: url,
    inLanguage,
    dateModified: dateModified.toISOString().slice(0, 10),
    author: { '@type': 'Person', ...author },
    publisher: { '@type': 'Organization', name: isPartOf.name, url: isPartOf.url },
    isPartOf,
  }
}

export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org'
  '@type': 'BreadcrumbList'
  itemListElement: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }>
}

export function buildBreadcrumbList(
  steps: ReadonlyArray<{ name: string; url: string }>,
): BreadcrumbListJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  }
}

export interface WebApplicationJsonLd {
  '@context': 'https://schema.org'
  '@type': 'WebApplication'
  name: string
  description: string
  url: string
  inLanguage: string
  applicationCategory: 'DeveloperApplication'
  operatingSystem: 'Any'
  browserRequirements: string
  isAccessibleForFree: true
  offers: { '@type': 'Offer'; price: '0'; priceCurrency: 'USD' }
  isPartOf: SiteReference
}

export function buildWebApplication({
  name,
  description,
  url,
  inLanguage,
  isPartOf,
}: {
  name: string
  description: string
  url: string
  inLanguage: string
  isPartOf: SiteReference
}): WebApplicationJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url,
    inLanguage,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript.',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isPartOf,
  }
}
