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
  openPRs: { totalCount: number }
  openIssues: { totalCount: number }
  cachedAt: number
}

export interface CachedOrg {
  login: string
  avatarUrl: string
  enabled: boolean
  syncEnabled: boolean
  lastSyncedAt: number | null
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

  constructor() {
    super('ghviewer')
    
    this.version(1).stores({
      repos: 'id, nameWithOwner, owner.login, pushedAt, cachedAt',
      orgs: 'login',
      prefs: 'key'
    })
  }
}

export const db = new GHDatabase()

export async function cacheRepos(_orgLogin: string, repos: CachedRepo[]) {
  await db.repos.bulkPut(
    repos.map(r => ({
      ...r,
      cachedAt: Date.now()
    }))
  )
}

export async function getCachedRepos(orgLogin: string): Promise<CachedRepo[]> {
  const cutoff = Date.now() - (60 * 60 * 1000)
  return db.repos
    .where('owner.login')
    .equals(orgLogin)
    .filter(r => r.cachedAt > cutoff)
    .toArray()
}

export async function clearOldRepos(maxAgeHours = 24) {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  await db.repos.where('cachedAt').below(cutoff).delete()
}

export async function getRepoCount(): Promise<number> {
  return db.repos.count()
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