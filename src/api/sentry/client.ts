// Sentry Web API client. Because Sentry's management API does NOT send CORS
// headers, every request is routed through devcompass's same-origin relay
// (api/proxy.ts). The user's BYO token rides in the Authorization header and is
// only ever forwarded — never persisted server-side.

export type SentryAuth = {
  token: string
  /** '' → sentry.io; 'us'/'de'/… → regional host like us.sentry.io */
  region: string
  /** Relay endpoint, default '/api/proxy' (same-origin). Overridable for self-host. */
  proxyBase: string
}

export type SentryPage<T> = { data: T; nextCursor: string | null }

function sentryBaseUrl(region: string): string {
  return `https://${region ? `${region}.` : ''}sentry.io/api/0`
}

const MAX_RETRIES = 3
const RETRY_DELAY = 1500
const TIMEOUT_MS = 20_000

export async function sentryFetch<T>(
  path: string,
  auth: SentryAuth,
  params?: Record<string, string | number | undefined>
): Promise<SentryPage<T>> {
  const upstream = new URL(sentryBaseUrl(auth.region) + path)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') upstream.searchParams.set(k, String(v))
    }
  }
  const proxied = `${auth.proxyBase || '/api/proxy'}?url=${encodeURIComponent(upstream.toString())}`
  const headers = { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' }

  // Retry transient failures (network/timeout, 429, 5xx) like the GitHub client.
  // 4xx (auth/not-found/bad query) fail fast — a retry won't change the answer.
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
    if (res.ok) {
      const data = (await res.json()) as T
      return { data, nextCursor: parseNextCursor(res.headers.get('link')) }
    }
    const text = (await res.text().catch(() => '')).slice(0, 300)
    const err = new Error(`Sentry ${res.status}: ${text || res.statusText}`)
    if (res.status !== 429 && res.status < 500) throw err
    lastError = err
  }
  throw lastError ?? new Error('Sentry request failed')
}

// Sentry cursor pagination (RFC5988): `<…>; rel="next"; results="true"; cursor="0:100:0"`.
// Only a next link with results="true" actually has more.
function parseNextCursor(link: string | null): string | null {
  if (!link) return null
  for (const part of link.split(',')) {
    if (part.includes('rel="next"') && part.includes('results="true"')) {
      const m = part.match(/cursor="([^"]+)"/)
      if (m) return m[1]
    }
  }
  return null
}

/**
 * Mutating call (PUT/POST/DELETE) through the relay. No retry — mutations
 * shouldn't be replayed blindly. 403 gets an actionable scope hint since the
 * recommended read-only token can't mutate.
 */
export async function sentryMutate<T>(
  path: string,
  auth: SentryAuth,
  method: 'PUT' | 'POST' | 'DELETE',
  body?: unknown
): Promise<T | null> {
  const upstream = sentryBaseUrl(auth.region) + path
  const proxied = `${auth.proxyBase || '/api/proxy'}?url=${encodeURIComponent(upstream)}`
  const res = await fetch(proxied, {
    method,
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 300)
    const hint = res.status === 403 ? ' — your token needs the event:write scope to do this' : ''
    throw new Error(`Sentry ${res.status}: ${text || res.statusText}${hint}`)
  }
  if (res.status === 204) return null
  return res.json().catch(() => null) as Promise<T | null>
}
