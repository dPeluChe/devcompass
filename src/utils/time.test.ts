import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { relativeTime } from './time'

const NOW = new Date('2026-06-01T12:00:00Z').getTime()

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('relativeTime', () => {
  beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(NOW))
  afterEach(() => vi.restoreAllMocks())

  it('handles empty input', () => {
    expect(relativeTime('')).toBe('')
  })

  it('covers minute/hour/day/month bands', () => {
    expect(relativeTime(ago(5 * MIN))).toBe('5m ago')
    expect(relativeTime(ago(59 * MIN))).toBe('59m ago')
    expect(relativeTime(ago(60 * MIN))).toBe('1h ago')
    expect(relativeTime(ago(23 * HOUR))).toBe('23h ago')
    expect(relativeTime(ago(24 * HOUR))).toBe('1d ago')
    expect(relativeTime(ago(29 * DAY))).toBe('29d ago')
    expect(relativeTime(ago(30 * DAY))).toBe('1mo ago')
  })

  it('never says "0y" near the year boundary (360-364d regression)', () => {
    expect(relativeTime(ago(362 * DAY))).toBe('12mo ago')
    expect(relativeTime(ago(364 * DAY))).toBe('12mo ago')
    expect(relativeTime(ago(365 * DAY))).toBe('1y ago')
    expect(relativeTime(ago(800 * DAY))).toBe('2y ago')
  })

  it('omits the suffix when asked', () => {
    expect(relativeTime(ago(3 * HOUR), false)).toBe('3h')
    expect(relativeTime(ago(2 * DAY), false)).toBe('2d')
  })
})
