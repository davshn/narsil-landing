import { isHttpsUrl } from './https-url'

export interface DonationLink {
  url: string
  platform: string
}

const PLATFORMS: ReadonlyArray<{ host: string; name: string }> = [
  { host: 'paypal.me', name: 'PayPal' },
  { host: 'www.paypal.me', name: 'PayPal' },
  { host: 'ko-fi.com', name: 'Ko-fi' },
  { host: 'github.com', name: 'GitHub Sponsors' },
]

export const DEFAULT_DONATION_URL = 'https://paypal.me/davshn'

export function resolveDonationUrl(rawUrl: string | undefined): string {
  const value = rawUrl?.trim() ?? ''
  return value === '' ? DEFAULT_DONATION_URL : value
}

export function donationLink(rawUrl: string | undefined): DonationLink | undefined {
  if (rawUrl === undefined || !isHttpsUrl(rawUrl)) return undefined
  const { host, href } = new URL(rawUrl)
  const platform = PLATFORMS.find((p) => p.host === host)?.name ?? host
  return { url: href, platform }
}
