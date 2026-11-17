export function buildRobotsTxt(site: URL | undefined): string {
  const lines = [
    'User-agent: *',
    'Allow: /',
    '',
    '# AI answer engines — allow indexing and citation',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    'User-agent: CCBot',
    'Allow: /',
    '',
    'User-agent: FacebookBot',
    'Allow: /',
    '',
    'User-agent: Applebot-Extended',
    'Allow: /',
  ]

  if (site !== undefined) {
    lines.push('', `Sitemap: ${new URL('sitemap-index.xml', site).href}`)
  }

  return lines.join('\n')
}
