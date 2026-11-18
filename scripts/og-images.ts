import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, type Browser } from '@playwright/test'

import { OG_IMAGE_KEYS, type OgImageKey } from '../src/utils/og-image.ts'

interface Card {
  eyebrow: string
  title: string
  text: string
  art: string
}

const CARDS: Record<OgImageKey, Card> = {
  home: {
    eyebrow: 'Free guides in five languages',
    title: 'Build Claude Code mods like Narsil',
    text: 'A status pet, a review panel and a desk bot, step by step: what each feature does, how it works and how it was asked of the AI.',
    art: 'hola-oscuro.png',
  },
  mods: {
    eyebrow: 'Mod fundamentals',
    title: 'What a Claude Code mod is made of',
    text: 'The $ object, installing and testing a mod, where it runs, and what the GPL v3 means for your code.',
    art: 'base-oscuro.png',
  },
  pet: {
    eyebrow: 'Path 1',
    title: 'Your own status pet',
    text: 'Build a mod like Narsil, feature by feature: states, art, experience, every conversation and the phone.',
    art: 'etapa2/necesita-oscuro.webp',
  },
  check: {
    eyebrow: 'Path 2',
    title: 'Your own review panel',
    text: 'Build a mod like Narsil Check: CI steps, dependency updates by risk, OSV vulnerabilities and tools for Claude.',
    art: 'etapa3/terminado-oscuro.webp',
  },
  bot: {
    eyebrow: 'Path 3',
    title: 'A Narsil desk bot',
    text: 'An ESP32-P4 touch screen in the belly, a holographic ESP32-S3 head, and a voice through Xiaozhi and Claude.',
    art: 'etapa5/trabajando-oscuro.webp',
  },
  tools: {
    eyebrow: 'Interactive tools',
    title: 'Try the rules of the mods',
    text: 'Semver, XP, priority, context, prompt cache and the bot server file, right in your browser.',
    art: 'etapa4/trabajando-oscuro.webp',
  },
}

const MAX_BYTES = 600_000

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function pageOf(card: Card, artDir: string): string {
  const type = card.art.endsWith('.webp') ? 'image/webp' : 'image/png'
  const art = readFileSync(join(artDir, card.art)).toString('base64')
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #f4f5fb 0%, #e7e9f7 100%); color: #2f3550; }
  .card { display: flex; height: 100%; padding: 72px 64px 64px 80px; gap: 40px; }
  .text { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 24px; }
  .brand { font-size: 26px; font-weight: 700; color: #4f46c8; letter-spacing: 0.5px; }
  .eyebrow { font-size: 22px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #6b7090; }
  h1 { font-size: 64px; line-height: 1.05; font-weight: 800; letter-spacing: -1.5px; }
  p { font-size: 26px; line-height: 1.4; color: #4a5070; }
  .art { width: 420px; display: flex; align-items: center; justify-content: center;
    background: #ffffff; border-radius: 40px;
    box-shadow: 12px 12px 32px #c9cce0, -12px -12px 32px #ffffff; }
  .art img { max-width: 92%; max-height: 92%; object-fit: contain; mix-blend-mode: multiply; filter: brightness(1.05) contrast(1.05); }
</style></head><body><div class="card">
  <div class="text">
    <div class="brand">Narsil Workshop</div>
    <div class="eyebrow">${escapeHtml(card.eyebrow)}</div>
    <h1>${escapeHtml(card.title)}</h1>
    <p>${escapeHtml(card.text)}</p>
  </div>
  <div class="art"><img src="data:${type};base64,${art}" alt=""></div>
</div></body></html>`
}

async function render(browser: Browser, key: OgImageKey, artDir: string): Promise<string> {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(pageOf(CARDS[key], artDir), { waitUntil: 'load' })
  const file = join('public', 'og', `${key}.png`)
  writeFileSync(file, await page.screenshot({ type: 'png' }))
  await page.close()
  const { size } = statSync(file)
  if (size > MAX_BYTES) throw new Error(`${file} is ${size} bytes, over ${MAX_BYTES}`)
  return `${file}: ${size} bytes\n`
}

async function main(): Promise<void> {
  const artDir = process.argv.at(2)
  if (artDir === undefined) {
    throw new Error('Usage: node scripts/og-images.ts <narsil-pet>/assets/raw')
  }
  const browser = await chromium.launch()
  try {
    const lines = await Promise.all(
      OG_IMAGE_KEYS.map(async (key) => await render(browser, key, artDir)),
    )
    process.stdout.write(lines.join(''))
  } finally {
    await browser.close()
  }
}

await main()
