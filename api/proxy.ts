// Vercel Edge Function: the production adapter around the shared relay core.
// Lives at /api/proxy on the same origin as the SPA, so the browser→proxy hop is
// same-origin (no CORS) and only the proxy→upstream hop crosses origins — where
// CORS doesn't apply. The CORS headers below only matter for the self-host case
// where someone points the app at a proxy on a different origin.
import { relay } from './_relay'

export const config = { runtime: 'edge' }

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-max-age': '86400',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const target = new URL(req.url).searchParams.get('url')
  if (!target) {
    return new Response(JSON.stringify({ error: 'missing ?url= query param' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...CORS },
    })
  }

  const { status, headers, body } = await relay({
    method: req.method,
    targetUrl: target,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? null : await req.arrayBuffer(),
  })

  return new Response(body, { status, headers: { ...headers, ...CORS } })
}
