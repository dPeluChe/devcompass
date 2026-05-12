import type { RepoDetail as RepoDetailT } from '../../api/github'

type CommitHistoryNode = {
  oid: string
  messageHeadline: string
  committedDate: string
  url: string
  author: { name: string | null; user: { login: string; avatarUrl: string } | null } | null
  /** Populated by associatedPullRequests(first: 1). PR merges expose their source branch via headRefName. */
  associatedPullRequests?: { nodes: { number: number; headRefName: string }[] }
}

/** Extracts commit history from defaultBranchRef.target — only present when it's a Commit. */
export function branchCommits(d: RepoDetailT): CommitHistoryNode[] {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'history' in t) {
    return (t as { history: { nodes: CommitHistoryNode[] } }).history.nodes
  }
  return []
}

export function branchCommitsTotal(d: RepoDetailT): number | null {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'history' in t) {
    return (t as { history: { totalCount: number } }).history.totalCount
  }
  return null
}

export function statusCheck(d: RepoDetailT): string | null {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'statusCheckRollup' in t) {
    return (t as { statusCheckRollup: { state: string } | null }).statusCheckRollup?.state ?? null
  }
  return null
}

export function ciClass(state: string): string {
  if (state === 'SUCCESS') return 'ok'
  if (state === 'FAILURE' || state === 'ERROR') return 'fail'
  return 'pending'
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(day / 365)}y ago`
}

export function pct(size: number, total: number): string {
  return `${((size / total) * 100).toFixed(1)}%`
}
