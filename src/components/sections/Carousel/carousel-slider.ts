function initCarousel(carousel: HTMLElement): void {
  const track = carousel.querySelector<HTMLElement>('[data-carousel-track]')
  if (track === null) return

  const trackEl = track
  const slides = Array.from(trackEl.children)
  const prev = carousel.querySelector<HTMLButtonElement>('[data-carousel-prev]')
  const next = carousel.querySelector<HTMLButtonElement>('[data-carousel-next]')
  const dotsContainer = carousel.querySelector<HTMLElement>('[data-carousel-dots]')
  const autoplay = Number.parseInt(carousel.dataset.autoplay ?? '0', 10)
  const loop = carousel.dataset.loop === 'true'
  let current = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let dragStartX = 0
  let dragOffset = 0
  let isDragging = false

  slides.forEach((slide) => {
    slide.classList.add('carousel-slide')
  })

  function total(): number {
    return slides.length
  }

  function updateDots(): void {
    if (dotsContainer === null) return
    dotsContainer.replaceChildren()
    for (let i = 0; i < total(); i += 1) {
      const dot = document.createElement('button')
      dot.className = 'carousel-dot'
      dot.dataset.active = i === current ? 'true' : 'false'
      dot.setAttribute('role', 'tab')
      dot.setAttribute('aria-label', `Slide ${i + 1}`)
      dot.setAttribute('aria-selected', i === current ? 'true' : 'false')
      dot.addEventListener('click', () => {
        goTo(i)
      })
      dotsContainer.appendChild(dot)
    }
  }

  function updateArrows(): void {
    if (prev === null || next === null) return
    if (!loop) {
      prev.disabled = current === 0
      next.disabled = current === total() - 1
    }
  }

  function stopAutoplay(): void {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  function resetAutoplay(): void {
    if (timer !== null) clearInterval(timer)
    if (autoplay > 0) {
      timer = setInterval(() => {
        goTo(current + 1)
      }, autoplay)
    }
  }

  function goTo(target: number): void {
    const idx = loop
      ? ((target % total()) + total()) % total()
      : Math.max(0, Math.min(target, total() - 1))
    current = idx
    trackEl.style.transform = `translateX(-${current * 100}%)`
    updateDots()
    updateArrows()
    resetAutoplay()
  }

  function dragTo(clientX: number): void {
    if (!isDragging) return
    dragOffset = clientX - dragStartX
    const pct = -current * 100 + (dragOffset / carousel.offsetWidth) * 100
    trackEl.style.transform = `translateX(${pct}%)`
  }

  function startDrag(clientX: number): void {
    isDragging = true
    dragStartX = clientX
    dragOffset = 0
    trackEl.classList.add('dragging')
  }

  function endDrag(): void {
    if (!isDragging) return
    isDragging = false
    trackEl.classList.remove('dragging')
    const threshold = carousel.offsetWidth * 0.2
    if (dragOffset < -threshold) {
      goTo(current + 1)
    } else if (dragOffset > threshold) {
      goTo(current - 1)
    } else {
      goTo(current)
    }
  }

  prev?.addEventListener('click', () => {
    goTo(current - 1)
  })
  next?.addEventListener('click', () => {
    goTo(current + 1)
  })

  trackEl.addEventListener('mousedown', (e) => {
    startDrag(e.clientX)
    e.preventDefault()
  })
  trackEl.addEventListener(
    'touchstart',
    (e) => {
      startDrag(e.touches[0].clientX)
    },
    { passive: true },
  )

  document.addEventListener('mousemove', (e) => {
    dragTo(e.clientX)
  })
  document.addEventListener(
    'touchmove',
    (e) => {
      dragTo(e.touches[0].clientX)
    },
    { passive: true },
  )

  document.addEventListener('mouseup', endDrag)
  document.addEventListener('touchend', endDrag)

  carousel.addEventListener('mouseenter', stopAutoplay)
  carousel.addEventListener('mouseleave', resetAutoplay)

  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(current - 1)
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(current + 1)
    }
  })

  goTo(0)
}

function initCarousels(): void {
  document.querySelectorAll<HTMLElement>('[data-carousel]').forEach(initCarousel)
}

if (typeof document !== 'undefined') {
  initCarousels()
}

export {}
