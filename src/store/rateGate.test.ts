import { afterEach, describe, expect, it } from 'vitest'
import { isLowFor, isRateLow, noteGraphqlRateLimit, noteRateHeaders, rateSnapshot, resetRateGate } from './rateGate'

function headers(map: Record<string, string>): Headers {
  return new Headers(map)
}

afterEach(() => resetRateGate())

describe('isLowFor', () => {
  it('flags under 5% (min 100)', () => {
    expect(isLowFor(99, 1000)).toBe(true)     // under the 100 floor
    expect(isLowFor(100, 1000)).toBe(false)
    expect(isLowFor(249, 5000)).toBe(true)    // under 5% of 5000
    expect(isLowFor(250, 5000)).toBe(false)
  })
})

describe('noteRateHeaders / isRateLow', () => {
  it('starts permissive and reacts to low core quota', () => {
    expect(isRateLow()).toBe(false)
    noteRateHeaders(headers({ 'x-ratelimit-remaining': '10', 'x-ratelimit-limit': '5000', 'x-ratelimit-resource': 'core', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600) }))
    expect(isRateLow()).toBe(true)
  })

  it('ignores the volatile search pool', () => {
    noteRateHeaders(headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-limit': '30', 'x-ratelimit-resource': 'search' }))
    expect(isRateLow()).toBe(false)
  })

  it('ignores malformed headers', () => {
    noteRateHeaders(headers({ 'x-ratelimit-remaining': 'abc' }))
    expect(rateSnapshot()).toBeNull()
  })

  it('stops gating once the window has reset', () => {
    const past = Math.floor(Date.now() / 1000) - 10
    noteRateHeaders(headers({ 'x-ratelimit-remaining': '1', 'x-ratelimit-limit': '5000', 'x-ratelimit-resource': 'core', 'x-ratelimit-reset': String(past) }))
    expect(isRateLow()).toBe(false)
  })
})

describe('noteGraphqlRateLimit', () => {
  it('feeds the graphql pool from the dedicated query', () => {
    noteGraphqlRateLimit(40, 5000, new Date(Date.now() + 3600_000).toISOString())
    expect(isRateLow()).toBe(true)
    const snap = rateSnapshot()
    expect(snap?.remaining).toBe(40)
    expect(snap?.low).toBe(true)
  })
})
