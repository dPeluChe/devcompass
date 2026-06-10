import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseNextCursor, sentryFetch, type SentryAuth } from './client'

const AUTH: SentryAuth = { token: 'sntryu_test', region: '', proxyBase: '/api/proxy' }

describe('parseNextCursor', () => {
  it('extracts the cursor only when rel="next" has results', () => {
    const link = '<https://sentry.io/p>; rel="previous"; results="false"; cursor="0:0:1", <https://sentry.io/n>; rel="next"; results="true"; cursor="0:100:0"'
    expect(parseNextCursor(link)).toBe('0:100:0')
  })

  it('returns null when next has no more results, or no header', () => {
    expect(parseNextCursor('<u>; rel="next"; results="false"; cursor="0:100:0"')).toBeNull()
    expect(parseNextCursor(null)).toBeNull()
    expect(parseNextCursor('')).toBeNull()
  })
})

describe('sentryFetch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('routes through the proxy with the upstream url encoded and bearer auth', async () => {
    const fetchSpy = vi.fn(async (..._args: unknown[]) => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    await sentryFetch('/organizations/acme/issues/', AUTH, { query: 'is:unresolved', empty: undefined })
    const [url, init] = fetchSpy.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url.startsWith('/api/proxy?url=')).toBe(true)
    const upstream = decodeURIComponent(url.slice('/api/proxy?url='.length))
    expect(upstream).toContain('https://sentry.io/api/0/organizations/acme/issues/')
    expect(upstream).toContain('query=is%3Aunresolved')
    expect(upstream).not.toContain('empty=')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sntryu_test')
  })

  it('uses the regional host when region is set', async () => {
    const fetchSpy = vi.fn(async (..._args: unknown[]) => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    await sentryFetch('/organizations/', { ...AUTH, region: 'de' })
    expect(decodeURIComponent(fetchSpy.mock.calls[0]![0] as string)).toContain('https://de.sentry.io/api/0/')
  })

  it('returns data + nextCursor from the Link header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[{"id":"1"}]', {
      status: 200,
      headers: { link: '<u>; rel="next"; results="true"; cursor="0:100:0"' },
    })))
    const page = await sentryFetch<{ id: string }[]>('/x/', AUTH)
    expect(page.data).toEqual([{ id: '1' }])
    expect(page.nextCursor).toBe('0:100:0')
  })

  it('fails fast on 4xx without retrying', async () => {
    const fetchSpy = vi.fn(async () => new Response('{"detail":"nope"}', { status: 404 }))
    vi.stubGlobal('fetch', fetchSpy)
    await expect(sentryFetch('/missing/', AUTH)).rejects.toThrow(/Sentry 404/)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
