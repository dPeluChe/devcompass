import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedTarget, relay } from './_relay'

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
}

describe('isAllowedTarget', () => {
  it('allows sentry.io and regional hosts over https', () => {
    expect(isAllowedTarget('https://sentry.io/api/0/organizations/')).not.toBeNull()
    expect(isAllowedTarget('https://us.sentry.io/api/0/issues/1/')).not.toBeNull()
    expect(isAllowedTarget('https://de.sentry.io/api/0/projects/')).not.toBeNull()
  })

  it('rejects non-allowlisted hosts, lookalikes and http', () => {
    expect(isAllowedTarget('https://evil.com/api')).toBeNull()
    expect(isAllowedTarget('https://sentry.io.evil.com/api')).toBeNull()
    expect(isAllowedTarget('https://notsentry.io/api')).toBeNull()
    expect(isAllowedTarget('http://sentry.io/api')).toBeNull()
    expect(isAllowedTarget('not a url')).toBeNull()
  })
})

describe('relay', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects non-allowlisted targets without calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await relay({ method: 'GET', targetUrl: 'https://evil.com/x', headers: {} })
    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects disallowed methods', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await relay({ method: 'TRACE', targetUrl: 'https://sentry.io/api/0/', headers: {} })
    expect(res.status).toBe(405)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('forwards only the auth/content/accept headers', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchSpy)
    await relay({
      method: 'GET',
      targetUrl: 'https://sentry.io/api/0/organizations/',
      headers: { authorization: 'Bearer tok', cookie: 'session=1', 'x-forwarded-for': '1.2.3.4', accept: 'application/json' },
    })
    const sent = fetchSpy.mock.calls[0]![1]!.headers as Headers
    expect(sent.get('authorization')).toBe('Bearer tok')
    expect(sent.get('accept')).toBe('application/json')
    expect(sent.get('cookie')).toBeNull()
    expect(sent.get('x-forwarded-for')).toBeNull()
  })

  it('strips set-cookie from the relayed response and exposes link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([], {
      headers: { 'set-cookie': 'sid=abc', link: '<https://sentry.io/x>; rel="next"; results="true"; cursor="0:100:0"' },
    })))
    const res = await relay({ method: 'GET', targetUrl: 'https://sentry.io/api/0/issues/', headers: {} })
    expect(res.status).toBe(200)
    const keys = Object.keys(res.headers).map((k) => k.toLowerCase())
    expect(keys).not.toContain('set-cookie')
    expect(res.headers['link']).toContain('cursor="0:100:0"')
    expect(res.headers['access-control-expose-headers']).toContain('link')
  })

  it('refuses oversized responses (declared content-length)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', {
      status: 200,
      headers: { 'content-length': String(100 * 1024 * 1024) },
    })))
    const res = await relay({ method: 'GET', targetUrl: 'https://sentry.io/api/0/issues/', headers: {} })
    expect(res.status).toBe(502)
  })
})
