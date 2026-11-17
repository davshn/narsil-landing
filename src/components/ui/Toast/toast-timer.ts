const MIN_RESUME_MS = 500

function initToasts(): void {
  document.querySelectorAll<HTMLElement>('[data-toast]').forEach((el) => {
    const duration = Number.parseInt(el.dataset.toastDuration ?? '', 10)
    const dismiss = el.querySelector<HTMLElement>('[data-toast-dismiss]')
    let timer: ReturnType<typeof setTimeout> | undefined = undefined
    let startTime = Date.now()
    let remaining = duration

    function setPlayState(state: 'paused' | 'running'): void {
      const bar = el.querySelector<HTMLElement>('.toast-progress-bar')
      if (bar !== null) bar.style.animationPlayState = state
    }

    function close(): void {
      clearTimeout(timer)
      el.classList.add('toast-closing')
      el.addEventListener(
        'animationend',
        () => {
          el.remove()
        },
        { once: true },
      )
    }

    function startTimer(ms: number): void {
      if (ms > 0) timer = setTimeout(close, ms)
    }

    dismiss?.addEventListener('click', close)
    if (duration > 0) startTimer(duration)

    el.addEventListener('mouseenter', () => {
      clearTimeout(timer)
      const elapsed = Date.now() - startTime
      remaining = Math.max(duration - elapsed, 0)
      setPlayState('paused')
    })

    el.addEventListener('mouseleave', () => {
      setPlayState('running')
      startTime = Date.now() - (duration - remaining)
      if (duration > 0) startTimer(Math.max(remaining, MIN_RESUME_MS))
    })
  })
}

if (typeof document !== 'undefined') {
  initToasts()
}

export {}
