import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
    }[]
  }
  openIssues: { totalCount: number }
  fetchedAt: number
}

export interface CachedRepoDetail {
  id: string
  nameWithOwner: string
  url: string
  description: string | null
  homepageUrl: string | null
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  isTemplate: boolean
  diskUsage: number | null
  forkCount: number
  stargazerCount: number
  watchers: { totalCount: number }
  createdAt: string
  pushedAt: string
  updatedAt: string
  licenseInfo: { name: string; spdxId: string | null } | null
  primaryLanguage: { name: string; color: string | null } | null
  owner: { login: string; avatarUrl: string; url: string }
  defaultBranchRef: { name: string; target: unknown } | null
  repositoryTopics: { nodes: { topic: { name: string }[] } }
  languages: { totalSize: number; edges: { size: number; node: { name: string; color: string | null } }[] }
  pullRequests: { totalCount: number; nodes: unknown[] }
  issues: { totalCount: number; nodes: unknown[] }
  releases: { totalCount: number; nodes: unknown[] }
  mentionableUsers: { totalCount: number }
  fetchedAt: number
}

export interface CachedPR {
  id: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  createdAt: string
  updatedAt: string
  author: { login: string; avatarUrl: string } | null
  repository: { nameWithOwner: string; url: string; isPrivate: boolean }
  labels: { nodes: { name: string; color: string }[] }
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  comments: { totalCount: number }
  additions: number
  deletions: number
  changedFiles: number
  ciState: string | null
  fetchedAt: number
}

export interface CachedPRDetail {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  bodyHTML: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  mergeStateStatus: string
  createdAt: string
  updatedAt: string
  author: { login: string; avatarUrl: string; url: string } | null
  baseRefName: string
  headRefName: string
  additions: number
  deletions: number
  changedFiles: number
  repository: { nameWithOwner: string; url: string }
  labels: { nodes: { name: string; color: string }[] }
  assignees: { nodes: { login: string; avatarUrl: string }[] }
  reviewRequests: { nodes: unknown[] }
  reviews: { nodes: unknown[] }
  comments: { nodes: unknown[] }
  files: { nodes: unknown[] }
  ciState: string | null
  checks: unknown[]
  fetchedAt: number
}

interface CacheState {
  repos: Map<string, CachedRepo>
  repoDetails: Map<string, CachedRepoDetail>
  prs: Map<string, CachedPR>
  prDetails: Map<string, CachedPRDetail>
  
  getRepo: (key: string, maxAge?: number) => CachedRepo | null
  setRepo: (key: string, repo: CachedRepo) => void
  getRepoDetail: (key: string, maxAge?: number) => CachedRepoDetail | null
  setRepoDetail: (key: string, detail: CachedRepoDetail) => void
  getPR: (key: string, maxAge?: number) => CachedPR | null
  setPR: (key: string, pr: CachedPR) => void
  getPRDetail: (key: string, maxAge?: number) => CachedPRDetail | null
  setPRDetail: (key: string, detail: CachedPRDetail) => void
  clearCache: () => void
  invalidateRepo: (key: string) => void
  invalidatePR: (key: string) => void
}

const DEFAULT_MAX_AGE = 5 * 60 * 1000 

export const cache = create<CacheState>()(
  persist(
    (set, get) => ({
      repos: new Map(),
      repoDetails: new Map(),
      prs: new Map(),
      prDetails: new Map(),

      getRepo: (key, maxAge = DEFAULT_MAX_AGE) => {
        const repo = get().repos.get(key)
        if (!repo) return null
        if (Date.now() - repo.fetchedAt > maxAge) return null
        return repo
      },
      
      setRepo: (key, repo) => {
        const newRepos = new Map(get().repos)
        newRepos.set(key, repo)
        set({ repos: newRepos })
      },
      
      getRepoDetail: (key, maxAge = DEFAULT_MAX_AGE) => {
        const detail = get().repoDetails.get(key)
        if (!detail) return null
        if (Date.now() - detail.fetchedAt > maxAge) return null
        return detail
      },
      
      setRepoDetail: (key, detail) => {
        const newDetails = new Map(get().repoDetails)
        newDetails.set(key, detail)
        set({ repoDetails: newDetails })
      },
      
      getPR: (key, maxAge = DEFAULT_MAX_AGE) => {
        const pr = get().prs.get(key)
        if (!pr) return null
        if (Date.now() - pr.fetchedAt > maxAge) return null
        return pr
      },
      
      setPR: (key, pr) => {
        const newPRs = new Map(get().prs)
        newPRs.set(key, pr)
        set({ prs: newPRs })
      },
      
      getPRDetail: (key, maxAge = DEFAULT_MAX_AGE) => {
        const detail = get().prDetails.get(key)
        if (!detail) return null
        if (Date.now() - detail.fetchedAt > maxAge) return null
        return detail
      },
      
      setPRDetail: (key, detail) => {
        const newDetails = new Map(get().prDetails)
        newDetails.set(key, detail)
        set({ prDetails: newDetails })
      },
      
      clearCache: () => {
        set({ repos: new Map(), repoDetails: new Map(), prs: new Map(), prDetails: new Map() })
      },
      
      invalidateRepo: (key) => {
        const newRepos = new Map(get().repos)
        newRepos.delete(key)
        const newDetails = new Map(get().repoDetails)
        newDetails.delete(key)
        set({ repos: newRepos, repoDetails: newDetails })
      },
      
      invalidatePR: (key) => {
        const newPRs = new Map(get().prs)
        newPRs.delete(key)
        const newDetails = new Map(get().prDetails)
        newDetails.delete(key)
        set({ prs: newPRs, prDetails: newDetails })
      }
    }),
    {
      name: 'ghviewer-cache',
      partialize: () => ({})
    }
  )
)

export function repoKey(owner: string, name: string): string {
  return `${owner}/${name}`
}

export function prKey(owner: string, name: string, number: number): string {
  return `${owner}/${name}#${number}`
}
