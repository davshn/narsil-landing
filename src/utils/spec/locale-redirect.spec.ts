import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

import { buildLocaleRedirectScript } from '../locale-redirect'

function redirectFor(language: string): string[] {
  const targets: string[] = []
  const context = {
    navigator: { language },
    window: { location: { replace: (url: string) => targets.push(url) } },
  }
  runInNewContext(buildLocaleRedirectScript(['en', 'es'], 'en'), context)
  return targets
}

describe('buildLocaleRedirectScript', () => {
  it('redirects to the browser language when it is supported', () => {
    expect(redirectFor('es-MX')).toEqual(['/es/'])
  })

  it('falls back to the default locale for an unsupported language', () => {
    expect(redirectFor('fr-FR')).toEqual(['/en/'])
  })

  it('escapes locale data so it cannot close the script element', () => {
    const script = buildLocaleRedirectScript(['</script>'], '</script>')

    expect(script).not.toContain('</script')
  })
})
