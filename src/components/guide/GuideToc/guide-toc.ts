import { activeHeadingId, type HeadingPosition } from '@utils/toc'

const OFFSET_PX = 120

function tocLinks(): HTMLAnchorElement[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('[data-guide-toc] a[href^="#"]')]
}

function headingPositions(ids: readonly string[]): HeadingPosition[] {
  return ids.flatMap((id) => {
    const heading = document.getElementById(id)
    return heading === null ? [] : [{ id, top: heading.getBoundingClientRect().top }]
  })
}

function markActive(links: readonly HTMLAnchorElement[], activeId: string | undefined): void {
  for (const link of links) {
    if (link.hash === `#${activeId ?? ''}`) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  }
}

function initGuideToc(): void {
  const links = tocLinks()
  if (links.length === 0) return
  const ids = [...new Set(links.map((link) => decodeURIComponent(link.hash.slice(1))))]
  let isQueued = false

  const update = (): void => {
    isQueued = false
    markActive(links, activeHeadingId(headingPositions(ids), OFFSET_PX))
  }
  const queue = (): void => {
    if (isQueued) return
    isQueued = true
    window.requestAnimationFrame(update)
  }

  window.addEventListener('scroll', queue, { passive: true })
  window.addEventListener('resize', queue)
  update()
}

if (typeof document !== 'undefined') {
  initGuideToc()
}
