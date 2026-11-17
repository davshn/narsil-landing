function initPasswordToggle(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-password-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-password-toggle')
      if (id === null || id === '') return

      const input = document.getElementById(id)
      if (input === null || !(input instanceof HTMLInputElement)) return

      const isHidden = input.type === 'password'
      input.type = isHidden ? 'text' : 'password'

      const showIcon = btn.querySelector('.password-icon-show')
      const hideIcon = btn.querySelector('.password-icon-hide')
      if (showIcon !== null) showIcon.classList.toggle('hidden', isHidden)
      if (hideIcon !== null) hideIcon.classList.toggle('hidden', !isHidden)
    })
  })
}

if (typeof document !== 'undefined') {
  initPasswordToggle()
}

export {}
