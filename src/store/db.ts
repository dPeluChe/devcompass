import Dexie, { type Table } from 'dexie'

export interface CachedRepo {
  id: string
  name: string
  nameWithOwner: string
  url: string
  description: string | null
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  stargazerCount: number
  pushedAt: string
  updatedAt: string
  primaryLanguage: { name: string; color: string | null } | null
  owner: { login: string; avatarUrl: string }
  defaultBranchRef: { name: string } | null
  openPRs: {
    totalCount: number
    nodes?: {
      id: string
      number: number
      title: string
      url: string
      updatedAt: string
      isDraft: boolean
      author: { login: string; avatarUrl: string } | null
      ciState?: string | null
    }[]
  }
  openIssues: { totalCount: number }
  cachedAt: number
}

export interface CachedOrg {
  login: string
  avatarUrl: string
  enabled: boolean
  syncEnabled: boolean
  lastSyncedAt: number | null
  order: number
}

export interface TokenMeta {
  id: string
  token: string
  expiresAt: number | null
  scopes: string[]
  note: string
  lastCheckedAt: number
}

export interface PinnedRepo {
  repoId: string
  nameWithOwner: string
  pinnedAt: number
}

export interface SnoozedPR {
  prId: string
  untilTs: number
  createdAt: number
  /** Stored for diagnostics — UI never trusts this, it re-derives from current data. */
  nameWithOwner?: string
  number?: number
}

export interface UserPrefs {
  id: string
  key: string
  value: unknown
  updatedAt: number
}

class GHDatabase extends Dexie {
  repos!: Table<CachedRepo, string>
  orgs!: Table<CachedOrg, string>
  prefs!: Table<UserPrefs, string>
  tokens!: Table<TokenMeta, string>
  pinnedRepos!: Table<PinnedRepo, string>
  snoozedPRs!: Table<SnoozedPR, string>

  constructor() {
    super('ghviewer')

    this.version(1).stores({
      repos: 'id, nameWithOwner, owner.login, pushedAt, cachedAt',
      orgs: 'login',
      prefs: 'key'
    })

    this.version(2).stores({
      repos: 'id, nameWithOwner, owner.login, pushedAt, cachedAt',
      orgs: 'login, order',
      prefs: 'key',
      tokens: 'id',
      pinnedRepos: 'repoId, pinnedAt'
    }).upgrade(tx => {
      tx.table('orgs').toCollection().modify(org => {
        org.order = 0
      })
    })

    this.version(3).stores({
      repos: 'id, nameWithOwner, owner.login, pushedAt, cachedAt',
      orgs: 'login, order',
      prefs: 'key',
      tokens: 'id',
      pinnedRepos: 'repoId, pinnedAt',
      // untilTs lets us cheaply prune expired rows; no upgrade needed since the table is new.
      snoozedPRs: 'prId, untilTs'
    })
  }
}

export const db = new GHDatabase()

type RepoCacheInput = Omit<CachedRepo, 'cachedAt'>

export async function cacheRepos(_orgLogin: string, repos: RepoCacheInput[]) {
  await db.repos.bulkPut(
    repos.map(r => ({
      ...r,
      cachedAt: Date.now()
    }))
  )
}

export async function getCachedRepos(orgLogin: string, maxAgeHours = 24 * 7): Promise<CachedRepo[]> {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  return db.repos
    .where('owner.login')
    .equals(orgLogin)
    .filter(r => r.cachedAt > cutoff)
    .toArray()
}

/**
 * Returns every cached repo regardless of owner. Needed because collaborator
 * repos come through the viewer's COLLABORATOR affiliation: they're stored
 * with `owner.login = <collab-org>`, but that login isn't in sourcesToSync,
 * so the per-org getCachedRepos read would miss them on a normal reload.
 */
export async function getAllCachedRepos(maxAgeHours = 24 * 7): Promise<CachedRepo[]> {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  return db.repos.filter(r => r.cachedAt > cutoff).toArray()
}

export async function clearOldRepos(maxAgeHours = 24) {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  await db.repos.where('cachedAt').below(cutoff).delete()
}

export async function getRepoCount(): Promise<number> {
  return db.repos.count()
}

export async function clearAllRepos() {
  await db.repos.clear()
}

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

export async function saveTokenMeta(token: string, expiresAt: number | null, scopes: string[], note = 'github_pat') {
  await db.tokens.put({
    id: 'current',
    token,
    expiresAt,
    scopes,
    note,
    lastCheckedAt: Date.now()
  })
}

export async function getTokenMeta(): Promise<TokenMeta | undefined> {
  return db.tokens.get('current')
}

export async function isTokenExpiringSoon(daysThreshold = 7): Promise<boolean> {
  const meta = await getTokenMeta()
  if (!meta?.expiresAt) return false
  const msFromNow = meta.expiresAt - Date.now()
  return msFromNow < daysThreshold * 24 * 60 * 60 * 1000
}

export async function pinRepo(repoId: string, nameWithOwner: string) {
  await db.pinnedRepos.put({
    repoId,
    nameWithOwner,
    pinnedAt: Date.now()
  })
}

export async function unpinRepo(repoId: string) {
  await db.pinnedRepos.delete(repoId)
}

export async function getPinnedRepos(): Promise<PinnedRepo[]> {
  return db.pinnedRepos.orderBy('pinnedAt').reverse().toArray()
}

export async function isPinned(repoId: string): Promise<boolean> {
  return (await db.pinnedRepos.get(repoId)) !== undefined
}

export async function setOrgOrder(login: string, order: number) {
  await db.orgs.update(login, { order })
}

export async function getOrgsByOrder(): Promise<CachedOrg[]> {
  return db.orgs.orderBy('order').toArray()
}

export async function getDbStats() {
  const [repoCount, orgCount, pinnedCount, tokenCount] = await Promise.all([
    db.repos.count(),
    db.orgs.count(),
    db.pinnedRepos.count(),
    db.tokens.count()
  ])
  return { repoCount, orgCount, pinnedCount, tokenCount }
}

export type PrefSummary = { key: string; updatedAt: number }
export type StorageBreakdown = {
  repos: number
  orgs: number
  prefs: number
  tokensMeta: number
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
  const [repos, orgs, prefs, tokensMeta, pinned, snoozed, prefRows] = await Promise.all([
    db.repos.count(),
    db.orgs.count(),
    db.prefs.count(),
    db.tokens.count(),
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
    tokensMeta,
    pinned,
    snoozed,
    prefKeys: prefRows.map((r) => ({ key: r.key, updatedAt: r.updatedAt })).toSorted((a, b) => b.updatedAt - a.updatedAt),
    usageBytes,
    quotaBytes
  }
}

// ---------- snooze ----------

export async function snoozePr(prId: string, untilTs: number, meta?: { nameWithOwner?: string; number?: number }) {
  await db.snoozedPRs.put({
    prId,
    untilTs,
    createdAt: Date.now(),
    nameWithOwner: meta?.nameWithOwner,
    number: meta?.number
  })
}

export async function unsnoozePr(prId: string) {
  await db.snoozedPRs.delete(prId)
}

/** Returns the set of currently-snoozed PR ids and prunes expired rows along the way. */
export async function getActiveSnoozes(): Promise<Set<string>> {
  const now = Date.now()
  const expired = await db.snoozedPRs.where('untilTs').belowOrEqual(now).primaryKeys()
  if (expired.length > 0) await db.snoozedPRs.bulkDelete(expired)
  const live = await db.snoozedPRs.where('untilTs').above(now).primaryKeys()
  return new Set(live)
}

// ---------- visit snapshot (Since last visit) ----------

/**
 * Compact snapshot of the user's "world" the last time they marked the home as
 * seen. Diffing the current repos against this is what powers the Since-last-
 * visit scope. Stored in `prefs` (single row), versioned so we can evolve the
 * shape without colliding with the legacy v1 snapshot from the old home.
 */
export type VisitSnapshot = {
  takenAt: number
  repos: Record<string, VisitSnapshotRepo>
}
export type VisitSnapshotRepo = {
  pushedAt: string
  /** Keyed by PR id. Captures everything we need to detect transitions. */
  openPRs: Record<string, { id: string; number: number; updatedAt: string; ciState: string | null }>
}

const VISIT_SNAPSHOT_KEY = 'home.visitSnapshot.v2'

export async function getVisitSnapshot(): Promise<VisitSnapshot | null> {
  return getPref<VisitSnapshot | null>(VISIT_SNAPSHOT_KEY, null)
}

export async function saveVisitSnapshot(snapshot: VisitSnapshot): Promise<void> {
  await savePref(VISIT_SNAPSHOT_KEY, snapshot)
}
