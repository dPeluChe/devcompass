// Vercel REST API client. Routed through devcompass's same-origin relay
// (api/proxy.ts) since api.vercel.com doesn't send CORS headers for browser
// calls. The user's BYO token rides in Authorization and is only ever
// forwarded — never persisted server-side. Mirrors the Sentry client.

export type VercelAuth = {
  token: string
  /** Team id/slug for team-scoped accounts; '' for a personal account. */
  teamId: string
  /** Relay endpoint, default '/api/proxy' (same-origin). Overridable for self-host. */
  proxyBase: string
}

const VERCEL_BASE = 'https://api.vercel.com'
const MAX_RETRIES = 3
const RETRY_DELAY = 1500
const TIMEOUT_MS = 20_000

export async function vercelFetch<T>(
  path: string,
  auth: VercelAuth,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const upstream = new URL(VERCEL_BASE + path)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') upstream.searchParams.set(k, String(v))
    }
  }
  // Team scoping: most v-endpoints accept ?teamId=. Harmless for personal tokens.
  if (auth.teamId) upstream.searchParams.set('teamId', auth.teamId)

  const proxied = `${auth.proxyBase || '/api/proxy'}?url=${encodeURIComponent(upstream.toString())}`
  const headers = { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' }

  // Retry transient failures (network/timeout, 429, 5xx); 4xx fails fast.
  let lastError: Error | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY))
    let res: Response
    try {
      res = await fetch(proxied, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      continue
    }
    if (res.ok) return (await res.json()) as T
    const text = (await res.text().catch(() => '')).slice(0, 300)
    const hint = res.status === 403 ? ' — check the token scope and the team (teamId) selection' : ''
    const err = new Error(`Vercel ${res.status}: ${text || res.statusText}${hint}`)
    if (res.status !== 429 && res.status < 500) throw err
    lastError = err
  }
  throw lastError ?? new Error('Vercel request failed')
}
