const CLOUD_INGESTION_SUFFIX = '.i.posthog.com'
const ASSETS_SUFFIX = '-assets'

export function posthogScriptOrigins(host: string): string[] {
  if (!URL.canParse(host)) return []
  const { origin, hostname, protocol } = new URL(host)
  if (!hostname.endsWith(CLOUD_INGESTION_SUFFIX)) return [origin]
  const region = hostname.slice(0, -CLOUD_INGESTION_SUFFIX.length)
  if (region === '' || region.endsWith(ASSETS_SUFFIX)) return [origin]
  return [origin, `${protocol}//${region}${ASSETS_SUFFIX}${CLOUD_INGESTION_SUFFIX}`]
}
