import { isLocale } from '@i18n/index'

function initShowcaseNavigation(): void {
  const sel = document.querySelector<HTMLSelectElement>('select[name=locale]')
  if (sel !== null) {
    sel.addEventListener('change', () => {
      if (isLocale(sel.value)) window.location.href = `/${sel.value}/`
    })
  }

  const panels = document.querySelectorAll<HTMLElement>('.component-panel')
  const links = document.querySelectorAll<HTMLAnchorElement>('.sidebar-action')

  function showPanel(id: string): void {
    panels.forEach((p) => {
      const display = p.dataset.panel === id ? 'block' : 'none'
      Object.assign(p.style, { display })
    })
    links.forEach((l) => {
      const href = l.getAttribute('href')
      const isActive = href === `#${id}`
      Object.assign(l.dataset, { active: isActive ? 'true' : 'false' })
    })
  }

  function hasPanel(id: string): boolean {
    return [...panels].some((p) => p.dataset.panel === id)
  }

  function onHash(): void {
    const hash = window.location.hash.replace('#', '')
    if (hash !== '' && hasPanel(hash)) {
      showPanel(hash)
      return
    }
    if (panels.length > 0) showPanel(panels[0].dataset.panel ?? '')
  }

  links.forEach((l) => {
    l.addEventListener('click', (e) => {
      e.preventDefault()
      const id = l.getAttribute('href')?.replace('#', '') ?? ''
      window.location.hash = id
      showPanel(id)
    })
  })

  onHash()
  window.addEventListener('hashchange', onHash)
}

if (typeof document !== 'undefined') {
  initShowcaseNavigation()
}
