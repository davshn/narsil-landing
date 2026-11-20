// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEVELOPER_GITHUB_URL, DEVELOPER_LINKEDIN_URL, DEVELOPER_PROFILE_URL } from '../developer'
import { DEFAULT_DONATION_URL, donationLink, resolveDonationUrl } from '../donation'
import { isHttpsUrl } from '../https-url'

describe('donationLink', () => {
  it('names PayPal.me links', () => {
    expect(donationLink('https://paypal.me/someone/3')).toEqual({
      url: 'https://paypal.me/someone/3',
      platform: 'PayPal',
    })
  })

  it('names Ko-fi and GitHub Sponsors links', () => {
    expect(donationLink('https://ko-fi.com/someone')?.platform).toBe('Ko-fi')
    expect(donationLink('https://github.com/sponsors/someone')?.platform).toBe('GitHub Sponsors')
  })

  it('falls back to the host for other platforms', () => {
    expect(donationLink('https://donate.example.org/x')?.platform).toBe('donate.example.org')
  })

  it('returns undefined for missing, empty, or non-https values', () => {
    expect(donationLink(undefined)).toBeUndefined()
    expect(donationLink('')).toBeUndefined()
    expect(donationLink('http://paypal.me/someone')).toBeUndefined()
    expect(donationLink(['javascript', 'alert(1)'].join(':'))).toBeUndefined()
  })
})

describe('resolveDonationUrl', () => {
  it('uses the Ko-fi link of the project when the variable is missing or empty', () => {
    expect(DEFAULT_DONATION_URL).toBe('https://ko-fi.com/davshn')
    expect(resolveDonationUrl(undefined)).toBe(DEFAULT_DONATION_URL)
    expect(resolveDonationUrl('')).toBe(DEFAULT_DONATION_URL)
    expect(resolveDonationUrl('   ')).toBe(DEFAULT_DONATION_URL)
  })

  it('lets the variable override the default', () => {
    expect(resolveDonationUrl(' https://ko-fi.com/someone ')).toBe('https://ko-fi.com/someone')
  })

  it('gives a Ko-fi donation link by default', () => {
    expect(donationLink(resolveDonationUrl(undefined))).toEqual({
      url: 'https://ko-fi.com/davshn',
      platform: 'Ko-fi',
    })
  })
})

describe('DEVELOPER_PROFILE_URL', () => {
  it('is the https profile of the developer', () => {
    expect(DEVELOPER_PROFILE_URL).toBe('https://davshn.tech/en')
    expect(isHttpsUrl(DEVELOPER_PROFILE_URL)).toBe(true)
  })
})

describe('developer social links', () => {
  it('are the https GitHub and LinkedIn profiles of the developer', () => {
    expect(DEVELOPER_GITHUB_URL).toBe('https://github.com/davshn')
    expect(DEVELOPER_LINKEDIN_URL).toBe('https://www.linkedin.com/in/davshn/')
    expect(isHttpsUrl(DEVELOPER_GITHUB_URL)).toBe(true)
    expect(isHttpsUrl(DEVELOPER_LINKEDIN_URL)).toBe(true)
  })
})
