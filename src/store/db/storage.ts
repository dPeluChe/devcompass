import { db } from './core'

export type PrefSummary = { key: string; updatedAt: number }
export type StorageBreakdown = {
  repos: number
  orgs: number
  prefs: number
  pinned: number
  snoozed: number
  prefKeys: PrefSummary[]
  /** Browser-reported total IndexedDB+localStorage size in bytes, when supported. */
  usageBytes: number | null
  quotaBytes: number | null
}

/**
 * Detailed storage snapshot for the Settings → Storage panel. Counts every
 * Dexie table plus the per-key prefs index (used to render which API
 * responses are currently cached) and the browser-reported quota.
 */
export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  const [repos, orgs, prefs, pinned, snoozed, prefRows] = await Promise.all([
    db.repos.count(),
    db.orgs.count(),
    db.prefs.count(),
    db.pinnedRepos.count(),
    db.snoozedPRs.count(),
    db.prefs.toArray()
  ])
  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate()
      usageBytes = est.usage ?? null
      quotaBytes = est.quota ?? null
    } catch { /* permission denied or unsupported — fine */ }
  }
  return {
    repos,
    orgs,
    prefs,
    pinned,
    snoozed,
    prefKeys: prefRows.map((r) => ({ key: r.key, updatedAt: r.updatedAt })).toSorted((a, b) => b.updatedAt - a.updatedAt),
    usageBytes,
    quotaBytes
  }
}
