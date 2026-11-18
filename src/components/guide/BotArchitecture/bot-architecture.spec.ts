// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import BotArchitecture from './BotArchitecture.astro'

const copy = (title: string): { title: string; text: string } => ({ title, text: `${title} text` })

const dot = (
  title: string,
  number: number,
  slug: string,
): Array<{ number: number; title: string; href: string }> => [
  { number, title: `${title} guide`, href: `/en/bot/${slug}/` },
]

const props = {
  title: 'How the bot fits together',
  text: 'The belly owns every connection.',
  labelTemplate: 'Guide {number}: {title}',
  parts: {
    head: copy('The head'),
    belly: copy('The belly'),
    feeds: copy('ntfy and GitHub'),
    server: copy('Your server'),
    claude: copy('Claude'),
  },
  guides: {
    head: dot('The head', 11, 'holographic-head'),
    belly: dot('The belly', 3, 'xiaozhi-belly'),
    feeds: dot('ntfy and GitHub', 7, 'ntfy-alerts'),
    server: dot('Your server', 4, 'own-server'),
    claude: dot('Claude', 5, 'claude-brain'),
  },
  links: { uart: 'UART, three wires', lan: 'WebSocket on your network', https: 'HTTPS' },
}

describe('BotArchitecture', () => {
  it('names the map with its heading and explains it', async () => {
    const host = await render(BotArchitecture, { props })
    const section = host.querySelector('section[data-bot-map]')

    expect(section?.getAttribute('aria-labelledby')).toBe('bot-map-title')
    expect(host.querySelector('#bot-map-title')?.textContent.trim()).toBe(
      'How the bot fits together',
    )
    expect(host.querySelector('.bot-map-text')?.textContent).toBe(
      'The belly owns every connection.',
    )
  })

  it('reads the voice chain first, then the branch of data into the belly', async () => {
    const host = await render(BotArchitecture, { props })
    const order = [...host.querySelectorAll('.bot-map-grid > *')].map(
      (node) => node.getAttribute('data-part') ?? node.getAttribute('data-link'),
    )

    expect(order).toEqual([
      'head',
      'uart',
      'belly',
      'lan',
      'server',
      'cloud',
      'claude',
      'feed',
      'feeds',
    ])
    expect(
      [...host.querySelectorAll('.bot-map-link-label')].map((label) => label.textContent),
    ).toEqual(['UART, three wires', 'WebSocket on your network', 'HTTPS', 'HTTPS'])
  })

  it('shows each part with its text and links to the guides that build it', async () => {
    const host = await render(BotArchitecture, { props })
    const belly = host.querySelector('[data-part="belly"]')

    expect(belly?.querySelector('.bot-map-name')?.textContent).toBe('The belly')
    expect(belly?.querySelector('.bot-map-detail')?.textContent).toBe('The belly text')
    expect(belly?.querySelector('.guide-dot')?.getAttribute('href')).toBe('/en/bot/xiaozhi-belly/')
    expect(belly?.querySelector('.guide-dot')?.getAttribute('aria-label')).toBe(
      'Guide 3: The belly guide',
    )
  })
})
