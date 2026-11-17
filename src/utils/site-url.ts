export const MISSING_SITE_URL_WARNING =
  'PUBLIC_SITE_URL is not set: canonical, Open Graph, hreflang, and sitemap URLs will not use the production host.'

export function missingSiteUrlWarning(siteUrl: string | undefined): string | undefined {
  return siteUrl === undefined || siteUrl.trim() === '' ? MISSING_SITE_URL_WARNING : undefined
}
