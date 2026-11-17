// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Contact from './Contact.astro'

describe('Contact', () => {
  it('renders a POST form with required name, email and message fields', async () => {
    const host = await render(Contact, { props: { action: '/api/contact' } })
    const form = host.querySelector('form.contact-form')

    expect(form?.getAttribute('action')).toBe('/api/contact')
    expect(form?.getAttribute('method')).toBe('POST')
    expect(form?.querySelector('input[name="name"]')?.hasAttribute('required')).toBe(true)
    expect(form?.querySelector('input[name="email"]')?.getAttribute('type')).toBe('email')
    expect(form?.querySelector('textarea[name="message"]')?.hasAttribute('required')).toBe(true)
  })

  it.each(['post', 'POST', 'dialog'])('accepts the %s method', async (method) => {
    const host = await render(Contact, { props: { method } })

    expect(host.querySelector('form.contact-form')?.getAttribute('method')).toBe(method)
  })

  it.each(['get', 'GET', 'put'])(
    'rejects the %s method so visitor data never lands in the URL',
    async (method) => {
      await expect(render(Contact, { props: { method } })).rejects.toThrow(
        `Contact: method must be "post" or "dialog", received "${method}"`,
      )
    },
  )

  it('submits the form with its button', async () => {
    const host = await render(Contact)
    const submit = host.querySelector('.contact-submit button')

    expect(submit?.getAttribute('type')).toBe('submit')
    expect(submit?.textContent).toContain('Send message')
  })

  it('labels every field', async () => {
    const host = await render(Contact)

    expect(host.querySelector('label[for="name"]')?.textContent).toContain('Name')
    expect(host.querySelector('label[for="email"]')?.textContent).toContain('Email')
    expect(host.querySelector('label[for="contact-message"]')?.textContent).toContain('Message')
  })

  it('adds the subject field only when requested', async () => {
    const without = await render(Contact)
    const withSubject = await render(Contact, { props: { showSubject: true } })

    expect(without.querySelector('input[name="subject"]')).toBeNull()
    expect(withSubject.querySelector('input[name="subject"]')).not.toBeNull()
  })

  it('localizes labels, placeholders and the submit text', async () => {
    const host = await render(Contact, {
      props: {
        submitLabel: 'Enviar',
        labels: { name: 'Nombre', namePlaceholder: 'Tu nombre', message: 'Mensaje' },
      },
    })

    expect(host.querySelector('label[for="name"]')?.textContent).toContain('Nombre')
    expect(host.querySelector('input[name="name"]')?.getAttribute('placeholder')).toBe('Tu nombre')
    expect(host.querySelector('label[for="contact-message"]')?.textContent).toContain('Mensaje')
    expect(host.querySelector('.contact-submit button')?.textContent).toContain('Enviar')
  })

  it('renders the header only with a title or description', async () => {
    const withHeader = await render(Contact, { props: { title: 'Get in touch' } })
    const without = await render(Contact)

    expect(withHeader.querySelector('h2.contact-title')?.textContent).toBe('Get in touch')
    expect(without.querySelector('.contact-header')).toBeNull()
  })
})
