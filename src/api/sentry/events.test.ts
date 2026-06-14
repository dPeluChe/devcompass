import { describe, expect, it } from 'vitest'
import { extractEventContext, extractExceptions, type SentryLatestEvent } from './events'

function event(over: Partial<SentryLatestEvent>): SentryLatestEvent {
  return {
    id: 'e1', eventID: 'deadbeef', title: 't', message: 'm',
    dateCreated: '2026-06-13T21:15:00Z', tags: [], entries: [], ...over,
  }
}

describe('extractEventContext', () => {
  it('reads environment / release / client / url from tags', () => {
    const ev = event({
      tags: [
        { key: 'environment', value: 'production' },
        { key: 'release', value: 'app@2.0.0' },
        { key: 'browser', value: 'Safari 17.4' },
        { key: 'os', value: 'iOS 17.4' },
        { key: 'url', value: '/quiniela/abc' },
      ],
    })
    const ctx = extractEventContext(ev, [])
    expect(ctx.environment).toBe('production')
    expect(ctx.release).toBe('app@2.0.0')
    expect(ctx.client).toBe('Safari 17.4 · iOS 17.4')
    expect(ctx.url).toBe('/quiniela/abc')
    expect(ctx.eventId).toBe('deadbeef')
  })

  it('prefers the exception mechanism for handled, then the tag', () => {
    expect(extractEventContext(event({}), [{ mechanism: { handled: false } }]).handled).toBe(false)
    expect(extractEventContext(event({ tags: [{ key: 'handled', value: 'yes' }] }), []).handled).toBe(true)
    expect(extractEventContext(event({}), []).handled).toBeNull()
  })

  it('builds readable breadcrumbs incl. http data, keeping the last few', () => {
    const values = Array.from({ length: 9 }, (_, i) => ({ timestamp: `2026-06-13T21:14:5${i}Z`, category: 'ui', message: `click ${i}` }))
    values.push({ timestamp: '2026-06-13T21:15:00Z', category: 'fetch', message: '', data: { method: 'POST', url: '/api', status_code: 500 } } as never)
    const ctx = extractEventContext(event({ entries: [{ type: 'breadcrumbs', data: { values } }] }), [])
    expect(ctx.breadcrumbs.length).toBe(6)                         // last 6 only
    expect(ctx.breadcrumbs.at(-1)!.message).toBe('POST /api → 500')
    expect(ctx.breadcrumbs.at(-1)!.ts).toBe('21:15:00')
  })

  it('returns the empty context for a missing event', () => {
    const ctx = extractEventContext(undefined, [])
    expect(ctx.handled).toBeNull()
    expect(ctx.breadcrumbs).toEqual([])
    expect(ctx.processingErrors).toEqual([])
  })

  it('surfaces processing errors, runtime, user, sdk and request method', () => {
    const ev = event({
      platform: 'node',
      errors: [{ type: 'js_no_source', message: 'Source map missing for index-BHCBVH7B.js' }],
      contexts: { runtime: { name: 'node', version: 'v20.11' } },
      user: { id: '123', email: 'ana@x.com' },
      sdk: { name: 'sentry.javascript.react', version: '7.119.0' },
      entries: [{ type: 'request', data: { url: '/api/action', method: 'POST' } }],
    })
    const ctx = extractEventContext(ev, [])
    expect(ctx.processingErrors).toEqual(['Source map missing for index-BHCBVH7B.js'])
    expect(ctx.platform).toBe('node')
    expect(ctx.runtime).toBe('node v20.11')
    expect(ctx.user).toBe('id:123 · ana@x.com')
    expect(ctx.sdk).toBe('sentry.javascript.react@7.119.0')
    expect(ctx.url).toBe('/api/action')
    expect(ctx.requestMethod).toBe('POST')
  })
})

describe('extractExceptions', () => {
  it('pulls values out of the exception entry', () => {
    const ev = event({ entries: [{ type: 'exception', data: { values: [{ type: 'TypeError' }] } }] })
    expect(extractExceptions(ev)).toEqual([{ type: 'TypeError' }])
  })
  it('is empty when there is no exception entry', () => {
    expect(extractExceptions(event({}))).toEqual([])
  })
})
