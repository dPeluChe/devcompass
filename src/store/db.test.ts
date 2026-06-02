import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getCachedPref, pruneExpiredCachePrefs, savePref } from './db'

describe('prefs cache', () => {
  beforeEach(async () => {
    await db.prefs.clear()
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00Z').getTime())
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await db.prefs.clear()
  })

  it('returns cached values while they are fresh', async () => {
    await savePref('viewer:test', { login: 'octo' })

    await expect(getCachedPref('viewer:test', 60_000)).resolves.toEqual({ login: 'octo' })
  })

  it('returns null for stale cached values', async () => {
    await savePref('viewer:test', { login: 'octo' })
    vi.mocked(Date.now).mockReturnValue(new Date('2026-01-01T00:02:00Z').getTime())

    await expect(getCachedPref('viewer:test', 60_000)).resolves.toBeNull()
  })

  it('prunes expired TTL-bound prefs only', async () => {
    await savePref('viewer:test', { login: 'octo' })
    await savePref('visit:test', { count: 1 })
    vi.mocked(Date.now).mockReturnValue(new Date('2026-01-01T02:00:00Z').getTime())

    await expect(pruneExpiredCachePrefs()).resolves.toBe(1)
    await expect(db.prefs.get('viewer:test')).resolves.toBeUndefined()
    await expect(db.prefs.get('visit:test')).resolves.toBeDefined()
  })
})
