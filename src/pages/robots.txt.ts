import { buildRobotsTxt } from '@utils/robots-txt'

import type { APIRoute } from 'astro'

export const GET: APIRoute = ({ site }) =>
  new Response(buildRobotsTxt(site), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
