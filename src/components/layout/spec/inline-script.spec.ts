// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { render } from '../../../test-render'
import InlineScript from '../InlineScript.astro'

describe('InlineScript', () => {
  it('renders the code verbatim inside a classic inline script', async () => {
    const code = "(function(){document.documentElement.dataset.ready='true'})()"
    const host = await render(InlineScript, { props: { code } })
    const script = host.querySelector('script')

    expect(script?.textContent).toBe(code)
    expect(script?.hasAttribute('src')).toBe(false)
    expect(script?.getAttribute('type')).toBeNull()
  })
})
