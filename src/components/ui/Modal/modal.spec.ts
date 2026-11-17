// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'

import Modal from './Modal.astro'

describe('Modal', () => {
  it('renders a closed modal dialog labelled by its title', async () => {
    const host = await render(Modal, { props: { id: 'confirm', title: 'Delete item?' } })
    const dialog = host.querySelector('#confirm')

    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('data-open')).toBe('false')
    expect(dialog?.getAttribute('aria-labelledby')).toBe('confirm-title')
    expect(host.querySelector('#confirm-title')?.textContent.trim()).toBe('Delete item?')
  })

  it('renders body and footer slots', async () => {
    const host = await render(Modal, {
      props: { id: 'm', title: 'T' },
      slots: { default: 'Are you sure?', footer: '<button>OK</button>' },
    })

    expect(host.querySelector('.modal-body')?.textContent).toContain('Are you sure?')
    expect(host.querySelector('.modal-footer button')?.textContent).toBe('OK')
  })

  it('has a labelled close button', async () => {
    const host = await render(Modal, { props: { id: 'm', title: 'T' } })
    const close = host.querySelector('button.modal-close')

    expect(close?.getAttribute('type')).toBe('button')
    expect(close?.getAttribute('aria-label')).toBe('Close')
    expect(close?.hasAttribute('data-modal-close')).toBe(true)
  })

  it.each(['sm', 'md', 'lg', 'xl'])('applies the modal-%s size', async (size) => {
    const host = await render(Modal, { props: { id: 'm', title: 'T', size } })
    expect(host.querySelector('.modal')?.classList.contains(`modal-${size}`)).toBe(true)
  })
})
