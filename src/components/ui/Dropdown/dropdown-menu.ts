const TRIGGER_FOCUSABLE = 'button,a,[tabindex]'
const OPEN_KEYS = new Set(['ArrowDown', 'Enter', ' '])

function initDropdowns(): void {
  document.querySelectorAll<HTMLElement>('[data-dropdown]').forEach((wrapper) => {
    const trigger = wrapper.querySelector<HTMLElement>('[data-dropdown-trigger]')
    const menu = wrapper.querySelector<HTMLElement>('[role=menu]')

    if (trigger === null || menu === null) return

    const triggerEl = trigger
    const items = Array.from(
      menu.querySelectorAll<HTMLElement>('[role=menuitem]:not([data-disabled=true])'),
    )

    function focusItem(index: number): void {
      items.at(index)?.focus()
    }

    function activeIndex(): number {
      return items.findIndex((item) => item === document.activeElement)
    }

    function triggerFocusable(): HTMLElement | null {
      return triggerEl.querySelector<HTMLElement>(TRIGGER_FOCUSABLE)
    }

    function isOpen(): boolean {
      return wrapper.classList.contains('dropdown-open')
    }

    function open(): void {
      wrapper.classList.add('dropdown-open')
      triggerFocusable()?.setAttribute('aria-expanded', 'true')
      if (items.length > 0) focusItem(0)
    }

    function close(): void {
      wrapper.classList.remove('dropdown-open')
      triggerFocusable()?.setAttribute('aria-expanded', 'false')
    }

    function handleOpenKeys(e: KeyboardEvent): void {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          close()
          triggerFocusable()?.focus()
          break
        case 'ArrowDown': {
          e.preventDefault()
          const idx = activeIndex()
          focusItem(idx < items.length - 1 ? idx + 1 : 0)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const idx = activeIndex()
          focusItem(idx > 0 ? idx - 1 : items.length - 1)
          break
        }
        case 'Home':
          e.preventDefault()
          focusItem(0)
          break
        case 'End':
          e.preventDefault()
          focusItem(items.length - 1)
          break
        default:
          break
      }
    }

    triggerEl.addEventListener('click', (e) => {
      e.stopPropagation()
      if (isOpen()) {
        close()
      } else {
        open()
      }
    })

    menu.addEventListener('click', (e) => {
      if (!(e.target instanceof HTMLElement)) return
      const item = e.target.closest<HTMLElement>('[role=menuitem]')
      if (item !== null && item.dataset.disabled !== 'true') close()
    })

    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Node)) return
      if (!wrapper.contains(e.target)) close()
    })

    wrapper.addEventListener('keydown', (e) => {
      if (!isOpen() && OPEN_KEYS.has(e.key) && e.target instanceof Node) {
        if (triggerEl.contains(e.target)) {
          e.preventDefault()
          open()
          return
        }
      }
      if (!isOpen()) return
      handleOpenKeys(e)
    })
  })
}

if (typeof document !== 'undefined') {
  initDropdowns()
}

export {}
