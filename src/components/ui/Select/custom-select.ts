interface SelectOption {
  value: string
  label: string
}

function isSelectOptionArray(data: unknown): data is SelectOption[] {
  return (
    Array.isArray(data) &&
    data.every((d) => typeof d === 'object' && d !== null && 'value' in d && 'label' in d)
  )
}

function initCustomSelects(): void {
  document.querySelectorAll<HTMLElement>('[data-select-custom]').forEach((wrapper) => {
    const trigger = wrapper.querySelector<HTMLButtonElement>('.select-trigger')
    const dropdown = wrapper.querySelector<HTMLElement>('.select-dropdown')
    const search = wrapper.querySelector<HTMLInputElement>('.select-search')
    const opts = Array.from(wrapper.querySelectorAll<HTMLElement>('.select-option'))
    const isMultiple = wrapper.dataset.selectMultiple === 'true'
    const name = wrapper.dataset.selectName ?? ''
    let focusIdx = -1

    if (trigger === null || dropdown === null) return

    const triggerEl = trigger
    const dropdownEl = dropdown

    function getVisible(): HTMLElement[] {
      return opts.filter((el) => el.style.display !== 'none' && el.dataset.disabled !== 'true')
    }

    function setFocus(idx: number): void {
      const visible = getVisible()
      visible.forEach((el) => {
        el.classList.remove('select-option-focused')
      })
      focusIdx = idx
      if (idx >= 0 && idx < visible.length) {
        visible[idx].classList.add('select-option-focused')
        visible[idx].scrollIntoView({ block: 'nearest' })
      }
    }

    function getSelected(): string[] {
      return Array.from(wrapper.querySelectorAll<HTMLInputElement>('input[type=hidden]')).map(
        (i) => i.value,
      )
    }

    function parseOptions(): SelectOption[] {
      const raw: unknown = JSON.parse(wrapper.dataset.selectOptions ?? '[]')
      if (isSelectOptionArray(raw)) return raw
      return []
    }

    function textSpan(text: string, className?: string): HTMLSpanElement {
      const span = document.createElement('span')
      if (className !== undefined) span.className = className
      span.textContent = text
      return span
    }

    function labelFor(value: string, allOpts: SelectOption[]): string {
      const o = allOpts.find((x) => x.value === value)
      return o === undefined ? value : o.label
    }

    function buildTags(values: string[], allOpts: SelectOption[]): HTMLSpanElement {
      const container = document.createElement('span')
      container.className = 'select-tags'
      values.forEach((v) => {
        const tag = textSpan(`${labelFor(v, allOpts)} `, 'select-tag')
        tag.setAttribute('data-tag-value', v)
        const remove = textSpan('×', 'select-tag-remove')
        remove.setAttribute('data-remove-value', v)
        tag.append(remove)
        container.append(tag)
      })
      return container
    }

    function updateDisplay(values: string[]): void {
      const allOpts = parseOptions()
      const ph = wrapper.dataset.selectPlaceholder ?? 'Select...'

      function buildContent(): HTMLSpanElement {
        if (values.length === 0) {
          return textSpan(ph, 'select-trigger-placeholder')
        }
        if (isMultiple) {
          return buildTags(values, allOpts)
        }
        return textSpan(labelFor(values[0], allOpts))
      }

      triggerEl.replaceChildren(buildContent())
    }

    function updateOptions(values: string[]): void {
      opts.forEach((el) => {
        const v = el.dataset.value ?? ''
        const active = values.includes(v)
        Object.assign(el.dataset, { active: active ? 'true' : 'false' })
        el.setAttribute('aria-selected', active ? 'true' : 'false')
        const chk = el.querySelector('.select-option-check')
        if (chk !== null) chk.classList.toggle('invisible', !active)
      })
    }

    function setSelected(values: string[]): void {
      wrapper.querySelectorAll<HTMLInputElement>('input[type=hidden]').forEach((i) => {
        i.remove()
      })
      values.forEach((v) => {
        const inp = document.createElement('input')
        inp.type = 'hidden'
        inp.name = isMultiple ? `${name}[]` : name
        inp.value = v
        wrapper.appendChild(inp)
      })
      updateDisplay(values)
      updateOptions(values)
    }

    function selectFocused(): void {
      const visible = getVisible()
      if (focusIdx < 0 || focusIdx >= visible.length) return
      const v = visible[focusIdx].dataset.value ?? ''
      const selected = getSelected()

      if (isMultiple) {
        const idx = selected.indexOf(v)
        if (idx >= 0) selected.splice(idx, 1)
        else selected.push(v)
      } else {
        selected.length = 0
        selected.push(v)
        close()
      }
      setSelected(selected)
    }

    function isOpen(): boolean {
      return !dropdownEl.classList.contains('select-hidden')
    }

    function open(): void {
      dropdownEl.classList.remove('select-hidden')
      wrapper.classList.add('select-open')
      triggerEl.setAttribute('aria-expanded', 'true')
      if (search === null) {
        setFocus(0)
      } else {
        search.value = ''
        filterOptions('')
        search.focus()
      }
    }

    function close(): void {
      dropdownEl.classList.add('select-hidden')
      wrapper.classList.remove('select-open')
      triggerEl.setAttribute('aria-expanded', 'false')
      focusIdx = -1
      opts.forEach((el) => {
        el.classList.remove('select-option-focused')
      })
    }

    function toggle(): void {
      if (isOpen()) close()
      else open()
    }

    function filterOptions(q: string): void {
      const lower = q.toLowerCase()

      opts.forEach((el) => {
        const label = el.textContent.toLowerCase()
        const show = label.includes(lower)
        Object.assign(el.style, { display: show ? '' : 'none' })
      })

      const hasVisible = opts.some((el) => el.style.display !== 'none')
      const empty = dropdownEl.querySelector('.select-empty')

      if (!hasVisible && empty === null) {
        const e = document.createElement('div')
        e.className = 'select-empty'
        e.textContent = wrapper.dataset.selectNoResults ?? 'No results'
        dropdownEl.appendChild(e)
      } else if (hasVisible && empty !== null) {
        empty.remove()
      }
      setFocus(0)
    }

    triggerEl.addEventListener('click', (e) => {
      e.preventDefault()
      toggle()
    })

    opts.forEach((el) => {
      el.addEventListener('click', () => {
        if (el.dataset.disabled === 'true') return
        const v = el.dataset.value ?? ''
        const selected = getSelected()

        if (isMultiple) {
          const idx = selected.indexOf(v)
          if (idx >= 0) selected.splice(idx, 1)
          else selected.push(v)
        } else {
          selected.length = 0
          selected.push(v)
          close()
        }
        setSelected(selected)
      })
    })

    if (search !== null) {
      search.addEventListener('input', () => {
        filterOptions(search.value)
      })
    }

    wrapper.addEventListener('click', (e) => {
      const { target } = e
      if (!(target instanceof HTMLElement)) return
      const rm = target.closest<HTMLElement>('[data-remove-value]')
      if (rm !== null) {
        e.stopPropagation()
        const v = rm.getAttribute('data-remove-value') ?? ''
        const selected = getSelected().filter((x) => x !== v)
        setSelected(selected)
      }
    })

    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Node)) return
      if (!wrapper.contains(e.target)) close()
    })

    wrapper.addEventListener('keydown', (e) => {
      if (!isOpen()) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
        return
      }

      const visible = getVisible()

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          close()
          triggerEl.focus()
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocus(focusIdx < visible.length - 1 ? focusIdx + 1 : 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocus(focusIdx > 0 ? focusIdx - 1 : visible.length - 1)
          break
        case 'Home':
          e.preventDefault()
          setFocus(0)
          break
        case 'End':
          e.preventDefault()
          setFocus(visible.length - 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          selectFocused()
          break
        default:
          break
      }
    })
  })
}

if (typeof document !== 'undefined') {
  initCustomSelects()
}

export {}
