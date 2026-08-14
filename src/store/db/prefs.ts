import { db } from './core'

export async function savePref(key: string, value: unknown) {
  await db.prefs.put({
    id: key,
    key,
    value,
    updatedAt: Date.now()
  })
}

export async function getPref<T>(key: string, defaultValue: T): Promise<T> {
  const row = await db.prefs.get(key)
  return row ? (row.value as T) : defaultValue
}

const DISMISSED_DEPLOYS_KEY = 'vercelDismissedDeploys'

/** Deploys the user has marked as handled (local acknowledgement; not a Vercel change). */
export async function getDismissedDeploys(): Promise<Set<string>> {
  return new Set(await getPref<string[]>(DISMISSED_DEPLOYS_KEY, []))
}

export async function dismissDeploy(uid: string): Promise<void> {
  const arr = await getPref<string[]>(DISMISSED_DEPLOYS_KEY, [])
  if (!arr.includes(uid)) await savePref(DISMISSED_DEPLOYS_KEY, [...arr, uid])
}

/**
 * Single source of truth for which prefs keys are TTL-bound caches and their
 * freshness windows. Used by `pruneExpiredCachePrefs` and by the Cache tab
 * to render chips per group. `visit:` is intentionally absent — the
 * since-last-visit snapshot is a baseline and never expires.
 */
export const CACHE_TTLS: Record<string, number> = {
  'viewer:': 60 * 60 * 1000,
  'tokenInfo:': 60 * 60 * 1000,
  'userOrgs:': 60 * 60 * 1000,
  'prDetail:': 15 * 60 * 1000,
  'branches:': 15 * 60 * 1000,
  'contrib:': 12 * 60 * 60 * 1000,
  // Inbox feeds: short windows (timely data) but enough for instant reload paint.
  'needsMe:': 5 * 60 * 1000,
  'issueSearch:': 5 * 60 * 1000,
  'notifications:': 5 * 60 * 1000,
  'sentryIssues:': 10 * 60 * 1000,
  // Digest v2 extras: slow-moving aggregates, one GraphQL call each per window.
  'digestMerged:': 30 * 60 * 1000,
  'digestActivity:': 30 * 60 * 1000,
  // Review pool: one cross-org PR search, timely but reload-instant.
  'reviewPool:': 5 * 60 * 1000,
  // Vercel failed-deploys alert (one cross-account call).
  'vercelFailed:': 5 * 60 * 1000
}

/**
 * Drop every cached pref under a prefix. Mutations MUST call this for the
 * feeds they affect before invalidating react-query — the queryFn reads the
 * IDB pref first, so invalidation alone would resurrect the pre-mutation state
 * until the TTL expires.
 */
export async function clearPrefsByPrefix(prefix: string): Promise<number> {
  return db.prefs.where('key').startsWith(prefix).delete()
}

/**
 * Sweep the prefs table and delete every TTL-bound row whose `updatedAt`
 * has aged past its bucket's window. Cheap to call — one scan + bulk
 * delete. Returns the number of rows evicted so callers can log it.
 */
export async function pruneExpiredCachePrefs(): Promise<number> {
  const now = Date.now()
  const all = await db.prefs.toArray()
  const toDelete: string[] = []
  for (const row of all) {
    for (const [prefix, ttlMs] of Object.entries(CACHE_TTLS)) {
      if (row.key.startsWith(prefix) && now - row.updatedAt > ttlMs) {
        toDelete.push(row.key)
        break
      }
    }
  }
  if (toDelete.length > 0) await db.prefs.bulkDelete(toDelete)
  return toDelete.length
}

/**
 * TTL-aware cache backed by the `prefs` table. Returns null when the row is
 * missing or older than `ttlMs`. Use savePref(key, value) to write — the
 * timestamp is the row's `updatedAt`.
 *
 * Wrap a fetch with `getCachedPref` to skip the network when fresh data is
 * already in IndexedDB:
 *
 *   const cached = await getCachedPref<T>('viewer', 60 * 60 * 1000)
 *   if (cached) return cached
 *   const fresh = await fetchViewer(token)
 *   await savePref('viewer', fresh)
 *   return fresh
 */
export async function getCachedPref<T>(key: string, ttlMs: number): Promise<T | null> {
  const row = await db.prefs.get(key)
  if (!row) return null
  if (Date.now() - row.updatedAt > ttlMs) return null
  return row.value as T
}
