import { describe, expect, it } from 'vitest'
import { bucketize, formatDuration } from './useDigestExtras'

const NOW = new Date('2026-06-01T12:00:00Z').getTime()
const DAY = 86_400_000

describe('bucketize', () => {
  it('spreads timestamps across 12 buckets, oldest first', () => {
    const times = [NOW - 1, NOW - 7 * DAY + 1000, NOW - 3.5 * DAY]
    const buckets = bucketize(times, 7, NOW)
    expect(buckets).toHaveLength(12)
    expect(buckets[11]).toBe(1)            // just now → last bucket
    expect(buckets[0]).toBe(1)             // window start → first bucket
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('drops timestamps outside the window', () => {
    const buckets = bucketize([NOW - 10 * DAY, NOW + 1000], 7, NOW)
    expect(buckets.every((b) => b === 0)).toBe(true)
  })
})

describe('formatDuration', () => {
  it('picks sensible units', () => {
    expect(formatDuration(30 * 60_000)).toBe('30m')
    expect(formatDuration(16 * 3600_000)).toBe('16h')
    expect(formatDuration(43 * 3600_000)).toBe('43h')
    expect(formatDuration(3.5 * 24 * 3600_000)).toBe('3.5d')
  })
})
