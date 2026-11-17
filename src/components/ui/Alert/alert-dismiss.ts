function closeAlert(alert: HTMLElement): void {
  alert.classList.add('alert-closing')
  alert.addEventListener(
    'animationend',
    () => {
      alert.remove()
    },
    { once: true },
  )
}

function initAlerts(): void {
  document.querySelectorAll<HTMLElement>('[data-alert]').forEach((alert) => {
    alert.querySelector('[data-alert-dismiss]')?.addEventListener('click', () => {
      closeAlert(alert)
    })

    const autoClose = Number.parseInt(alert.dataset.autoClose ?? '', 10)
    if (autoClose > 0) {
      setTimeout(() => {
        closeAlert(alert)
      }, autoClose)
    }
  })
}

if (typeof document !== 'undefined') {
  initAlerts()
}

export {}
