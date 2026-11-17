function isModalEvent(event: Event, overlay: HTMLElement): boolean {
  return event instanceof CustomEvent && event.detail === overlay.id
}

function initModal(overlay: HTMLElement): void {
  const close = overlay.querySelector<HTMLElement>('[data-modal-close]')
  let previousFocus: HTMLElement | null = null

  function open(): void {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    overlay.setAttribute('data-open', 'true')
    document.body.style.overflow = 'hidden'
    close?.focus()
  }

  function shut(): void {
    overlay.setAttribute('data-open', 'false')
    document.body.style.overflow = ''
    previousFocus?.focus()
  }

  close?.addEventListener('click', shut)

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) shut()
  })

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') shut()
  })

  window.addEventListener('modal:open', (event) => {
    if (isModalEvent(event, overlay)) open()
  })

  window.addEventListener('modal:close', (event) => {
    if (isModalEvent(event, overlay)) shut()
  })
}

function initModals(): void {
  document.querySelectorAll<HTMLElement>('[data-modal]').forEach(initModal)
}

if (typeof document !== 'undefined') {
  initModals()
}

export {}
