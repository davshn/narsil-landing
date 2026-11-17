interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL: string
  readonly PUBLIC_DONATION_URL?: string
  readonly PUBLIC_ANALYTICS_PLAUSIBLE_DOMAIN?: string
  readonly PUBLIC_ANALYTICS_GA_ID?: string
  readonly PUBLIC_ANALYTICS_UMAMI_ID?: string
  readonly PUBLIC_ANALYTICS_UMAMI_SRC?: string
  readonly PUBLIC_ANALYTICS_POSTHOG_KEY?: string
  readonly PUBLIC_ANALYTICS_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
