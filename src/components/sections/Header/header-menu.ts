function initHeader(header: HTMLElement): void {
  const toggle = header.querySelector<HTMLElement>('[data-header-toggle]')
  const iconOpen = header.querySelector('.header-icon-open')
  const iconClose = header.querySelector('.header-icon-close')

  function open(): void {
    header.classList.add('header-open')
    toggle?.setAttribute('aria-expanded', 'true')
    iconOpen?.classList.add('hidden')
    iconClose?.classList.remove('hidden')
  }

  function close(): void {
    header.classList.remove('header-open')
    toggle?.setAttribute('aria-expanded', 'false')
    iconOpen?.classList.remove('hidden')
    iconClose?.classList.add('hidden')
  }

  toggle?.addEventListener('click', () => {
    if (header.classList.contains('header-open')) {
      close()
    } else {
      open()
    }
  })

  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('header-open')) {
      close()
      toggle?.focus()
    }
  })
}

function initHeaders(): void {
  document.querySelectorAll<HTMLElement>('[data-header]').forEach(initHeader)
}

if (typeof document !== 'undefined') {
  initHeaders()
}

export {}
