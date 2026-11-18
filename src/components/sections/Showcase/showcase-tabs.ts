const KEY_STEPS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
}

function select(
  tabs: readonly HTMLButtonElement[],
  panels: readonly HTMLElement[],
  active: number,
): void {
  tabs.forEach((tab, index) => {
    const isActive = index === active
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false')
    tab.setAttribute('tabindex', isActive ? '0' : '-1')
  })
  panels.forEach((panel, index) => {
    panel.toggleAttribute('hidden', index !== active)
  })
}

export function initShowcase(tablist: HTMLElement): void {
  const section = tablist.closest('section')
  if (section === null) return
  const tabs = [...tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const panels = [...section.querySelectorAll<HTMLElement>('[data-showcase-panel]')]
  if (tabs.length === 0 || tabs.length !== panels.length) return

  for (const panel of panels) {
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('tabindex', '0')
  }
  tablist.removeAttribute('hidden')
  section.dataset.showcaseTabs = ''
  select(tabs, panels, 0)

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      select(tabs, panels, index)
    })
    tab.addEventListener('keydown', (event) => {
      const step = KEY_STEPS[event.key] as ((index: number, count: number) => number) | undefined
      if (step === undefined) return
      event.preventDefault()
      const next = step(index, tabs.length)
      select(tabs, panels, next)
      tabs[next].focus()
    })
  })
}

if (typeof document !== 'undefined') {
  for (const tablist of document.querySelectorAll<HTMLElement>('[data-showcase-tablist]')) {
    initShowcase(tablist)
  }
}
