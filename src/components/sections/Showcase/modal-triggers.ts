function initModalTriggers(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-open-modal')
      if (modalId !== null && modalId !== '') {
        window.dispatchEvent(new CustomEvent('modal:open', { detail: modalId }))
      }
    })
  })
}

if (typeof document !== 'undefined') {
  initModalTriggers()
}

export {}
