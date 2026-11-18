import { describe, expect, it } from 'vitest'

import { OG_IMAGE_KEYS, ogImageKeyFor, ogImagePath } from '../og-image'

describe('ogImageKeyFor', () => {
  it('picks the image of the path a page belongs to, in any locale', () => {
    expect(ogImageKeyFor('/en/mods/pet/states/')).toBe('pet')
    expect(ogImageKeyFor('/pt/mods/pet/')).toBe('pet')
    expect(ogImageKeyFor('/es/mods/check/side-panel/')).toBe('check')
    expect(ogImageKeyFor('/it/mods/what-is-a-mod/')).toBe('mods')
    expect(ogImageKeyFor('/fr/mods/')).toBe('mods')
    expect(ogImageKeyFor('/en/bot/claude-brain/')).toBe('bot')
    expect(ogImageKeyFor('/en/tools/semver/')).toBe('tools')
  })

  it('falls back to the general image for the home, support and anything else', () => {
    expect(ogImageKeyFor('/en/')).toBe('home')
    expect(ogImageKeyFor('/es/support/')).toBe('home')
    expect(ogImageKeyFor('/')).toBe('home')
    expect(ogImageKeyFor('/en/mods-extra/')).toBe('home')
  })
})

describe('ogImagePath', () => {
  it('serves each image from /og/ as a PNG', () => {
    expect(OG_IMAGE_KEYS).toEqual(['home', 'mods', 'pet', 'check', 'bot', 'tools'])
    expect(ogImagePath('/en/bot/')).toBe('/og/bot.png')
  })
})
