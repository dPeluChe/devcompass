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
  const proxyBase = auth.proxyBase || '/api/proxy'
  const res = await fetch(`${proxyBase}?url=${encodeURIComponent(upstream.toString())}`, {
    headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Sentry ${res.status}: ${text.slice(0, 300) || res.statusText}`)
  }
  const data = (await res.json()) as T
  return { data, nextCursor: parseNextCursor(res.headers.get('link')) }
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
