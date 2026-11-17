function initSidebar(container: HTMLElement): void {
  const toggle = container.querySelector<HTMLElement>('[data-sidebar-toggle]')
  const overlay = container.querySelector('[data-sidebar-overlay]')

  function open(): void {
    container.classList.add('sidebar-open')
    toggle?.setAttribute('aria-expanded', 'true')
    document.body.style.overflow = 'hidden'
  }

  function close(): void {
    container.classList.remove('sidebar-open')
    toggle?.setAttribute('aria-expanded', 'false')
    document.body.style.overflow = ''
  }

  toggle?.addEventListener('click', () => {
    if (container.classList.contains('sidebar-open')) {
      close()
    } else {
      open()
    }
  })

  overlay?.addEventListener('click', close)

  container.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && container.classList.contains('sidebar-open')) {
      close()
      toggle?.focus()
    }
  })
}

function initSidebars(): void {
  document.querySelectorAll<HTMLElement>('[data-sidebar-container]').forEach(initSidebar)
}

if (typeof document !== 'undefined') {
  initSidebars()
}

export {}
