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
  pinnedRepos!: Table<PinnedRepo, string>
  snoozedPRs!: Table<SnoozedPR, string>

  constructor() {
    super('devcompass')

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

    // v4 drops the tokens table: it stored the raw token string but had no
    // readers — metadata lives in the tokenInfo pref cache instead.
    this.version(4).stores({ tokens: null })
  }
}

export const db = new GHDatabase()
