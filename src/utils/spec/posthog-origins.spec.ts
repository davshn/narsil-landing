import { describe, expect, it } from 'vitest'

import { posthogScriptOrigins } from '../posthog-origins'

describe('posthogScriptOrigins', () => {
  it.each([
    ['https://us.i.posthog.com', ['https://us.i.posthog.com', 'https://us-assets.i.posthog.com']],
    ['https://eu.i.posthog.com/', ['https://eu.i.posthog.com', 'https://eu-assets.i.posthog.com']],
  ])('adds the matching assets origin for the cloud host %s', (host, origins) => {
    expect(posthogScriptOrigins(host)).toEqual(origins)
  })

  it.each([
    ['https://us-assets.i.posthog.com', ['https://us-assets.i.posthog.com']],
    ['https://app.posthog.com', ['https://app.posthog.com']],
    ['https://analytics.example.com/ingest', ['https://analytics.example.com']],
  ])('keeps only the origin of %s', (host, origins) => {
    expect(posthogScriptOrigins(host)).toEqual(origins)
  })

  it('returns no origin for an unparsable host', () => {
    expect(posthogScriptOrigins('not a url')).toEqual([])
  })
})
