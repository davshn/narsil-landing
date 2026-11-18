// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import PathStages from './PathStages.astro'

import type { Element } from 'happy-dom'

const stages = [
  {
    title: 'Panel and map',
    text: 'The side panel and a live map.',
    guides: [
      { number: 1, title: 'The side panel', href: '/en/mods/check/side-panel/' },
      { number: 2, title: 'The work map', href: '/en/mods/check/work-map/' },
    ],
  },
  { title: 'Empty', text: 'No guides yet.', guides: [] },
  {
    title: 'Go further',
    text: 'Kotlin, Gradle, and AGP.',
    guides: [{ number: 3, title: 'Kotlin', href: '/en/mods/check/kotlin-gradle-agp/' }],
  },
]

const dotNumbers = (item: Element): string[] =>
  [...item.querySelectorAll('.guide-dot')].map((dot) => dot.textContent.trim())

const props = { title: 'The path at a glance', labelTemplate: 'Guide {number}: {title}', stages }

describe('PathStages', () => {
  it('names the diagram with a heading the section points to', async () => {
    const host = await render(PathStages, { props })
    const section = host.querySelector('section[data-path-stages]')

    expect(section?.getAttribute('aria-labelledby')).toBe('stages-title')
    expect(host.querySelector('#stages-title')?.textContent.trim()).toBe('The path at a glance')
  })

  it('lists each stage with guides in order, with its title, text, and guide links', async () => {
    const host = await render(PathStages, { props })
    const items = [...host.querySelectorAll('.stages-list > .stage')]

    expect(items.map((item) => item.querySelector('.stage-title')?.textContent)).toEqual([
      'Panel and map',
      'Go further',
    ])
    expect(items[0].querySelector('.stage-text')?.textContent).toBe(
      'The side panel and a live map.',
    )
    expect(items.map(dotNumbers)).toEqual([['1', '2'], ['3']])
    expect(items[1].querySelector('.guide-dot')?.getAttribute('aria-label')).toBe('Guide 3: Kotlin')
    expect(items[0].querySelector('.stage-marker')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders nothing when no stage has guides', async () => {
    const host = await render(PathStages, {
      props: { ...props, stages: [{ title: 'Empty', text: 'None.', guides: [] }] },
    })

    expect(host.querySelector('[data-path-stages]')).toBeNull()
  })
})
