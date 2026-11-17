// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import FAQ from './FAQ.astro'

const items = [
  { question: 'Is it free?', answer: 'Yes.' },
  { question: 'How to deploy?', answer: 'Build and host dist/.' },
]

describe('FAQ', () => {
  it('keeps a closing script tag in an answer inside the JSON-LD block', async () => {
    const answer = '</script><img src=x onerror=alert(1)>'
    const host = await render(FAQ, {
      props: { items: [{ question: 'Unsafe?', answer }], structuredData: true },
    })
    const script = host.querySelector('script[type="application/ld+json"]')
    const data: unknown = JSON.parse(script?.textContent ?? '{}')

    expect(host.querySelector('img')).toBeNull()
    expect(data).toMatchObject({ mainEntity: [{ acceptedAnswer: { text: answer } }] })
  })

  it('renders each question and answer as an accordion item', async () => {
    const host = await render(FAQ, { props: { items } })
    const questions = [...host.querySelectorAll('.accordion-label')].map((q) => q.textContent)

    expect(questions).toEqual(['Is it free?', 'How to deploy?'])
    expect(host.querySelector('.accordion-content')?.textContent).toContain('Yes.')
  })

  it('renders an h2 title and subtitle header', async () => {
    const host = await render(FAQ, { props: { items, title: 'FAQ', subtitle: 'Answers' } })

    expect(host.querySelector('h2.faq-title')?.textContent).toBe('FAQ')
    expect(host.querySelector('.faq-subtitle')?.textContent).toBe('Answers')
  })

  it('opens one item at a time unless multiple is set', async () => {
    const single = await render(FAQ, { props: { items } })
    const multiple = await render(FAQ, { props: { items, multiple: true } })

    expect(single.querySelector('details')?.hasAttribute('name')).toBe(true)
    expect(multiple.querySelector('details')?.hasAttribute('name')).toBe(false)
  })

  it('emits FAQPage JSON-LD only when structuredData is enabled', async () => {
    const plain = await render(FAQ, { props: { items } })
    const structured = await render(FAQ, { props: { items, structuredData: true } })
    const script = structured.querySelector('script[type="application/ld+json"]')
    const data: unknown = JSON.parse(script?.textContent ?? '{}')

    expect(plain.querySelector('script[type="application/ld+json"]')).toBeNull()
    expect(data).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [
        { name: 'Is it free?', acceptedAnswer: { text: 'Yes.' } },
        { name: 'How to deploy?', acceptedAnswer: { text: 'Build and host dist/.' } },
      ],
    })
  })
})
