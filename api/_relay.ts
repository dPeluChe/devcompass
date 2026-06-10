// Shared, framework-agnostic core for the devcompass API-connector proxy.
// Used by BOTH the Vercel Edge function (api/proxy.ts) and the Vite dev
// middleware (vite.config.ts) so the allowlist + forwarding rules live once.
//
// SECURITY — this is a credential-forwarding relay, so it is deliberately strict:
//   • allowlist of hosts only (NEVER an open proxy) → prevents SSRF/abuse
//   • https targets only
//   • forwards a minimal request-header set (carries the user's Authorization,
//     drops cookies / sec-* / browser noise)
//   • stateless, and MUST NOT log tokens or bodies

export const ALLOWED_HOST_PATTERNS: RegExp[] = [
  // Sentry SaaS incl. regional hosts (us./de.sentry.io) and sentry.io itself.
  /^([a-z0-9-]+\.)?sentry\.io$/i,
  // Future connectors — add + test one at a time:
  // /^api\.linear\.app$/i,
  // /^[a-z0-9-]+\.atlassian\.net$/i,
]

// Only these request headers reach the upstream API.
const FORWARD_REQUEST_HEADERS = ['authorization', 'content-type', 'accept']

// Response headers stripped before handing back to the browser (the runtime
// re-derives length/encoding; hop-by-hop and set-cookie must not be relayed —
// the browser must never receive an upstream cookie under this origin).
const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie',
])

export type RelayHeaders = Headers | Record<string, string | string[] | undefined>

export type RelayInput = {
  method: string
  targetUrl: string
  headers: RelayHeaders
  body?: BodyInit | null
}

export type RelayResult = {
  status: number
  headers: Record<string, string>
  body: ArrayBuffer
}

/** Returns the parsed URL if it is an allowed https target, else null. */
export function isAllowedTarget(rawUrl: string): URL | null {
  let url: URL
  try { url = new URL(rawUrl) } catch { return null }
  if (url.protocol !== 'https:') return null
  if (!ALLOWED_HOST_PATTERNS.some((re) => re.test(url.hostname))) return null
  return url
}

function readHeader(headers: RelayHeaders, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const hit = Object.keys(headers).find((k) => k.toLowerCase() === name)
  if (!hit) return undefined
  const v = headers[hit]
  return Array.isArray(v) ? v[0] : v ?? undefined
}

function errorResult(status: number, message: string): RelayResult {
  // Fresh encode() spans its whole backing buffer (offset 0), so .buffer is
  // exactly the encoded bytes.
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: new TextEncoder().encode(JSON.stringify({ error: message })).buffer as ArrayBuffer,
  }
}

/** Methods the connectors actually use — everything else is rejected. */
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

/** Refuse to relay bodies past this size — protects the browser from a hostile upstream. */
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function relay(input: RelayInput): Promise<RelayResult> {
  const url = isAllowedTarget(input.targetUrl)
  if (!url) return errorResult(400, 'target not allowed (must be https + allowlisted host)')
  if (!ALLOWED_METHODS.has(input.method.toUpperCase())) {
    return errorResult(405, `method ${input.method} not allowed`)
  }

  const fwd = new Headers()
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = readHeader(input.headers, h)
    if (v) fwd.set(h, v)
  }

  const upstream = await fetch(url.toString(), {
    method: input.method,
    headers: fwd,
    body: input.body ?? undefined,
    // 'manual', not 'follow': the allowlist is only checked on the initial URL,
    // so following a redirect could reach a non-allowlisted host (SSRF) with the
    // forwarded token. Sentry's REST endpoints answer 200 directly; a 3xx
    // surfaces to the caller instead of being chased.
    redirect: 'manual',
    // Don't let a hung upstream pin the function open.
    signal: AbortSignal.timeout(25_000),
  })

  const headers: Record<string, string> = {}
  upstream.headers.forEach((value, key) => {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) return
    headers[key] = value
  })
  // Sentry (and friends) paginate via the RFC5988 Link header — expose it so the
  // browser fetch can read the cursor.
  headers['access-control-expose-headers'] = 'link, x-hits, x-max-hits'

  // Size cap: trust content-length when present; otherwise verify after reading.
  const declared = parseInt(upstream.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    return errorResult(502, `upstream response too large (${declared} bytes)`)
  }
  const body = await upstream.arrayBuffer()
  if (body.byteLength > MAX_RESPONSE_BYTES) {
    return errorResult(502, `upstream response too large (${body.byteLength} bytes)`)
  }

  return { status: upstream.status, headers, body }
}
