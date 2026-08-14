import type { Repo, RepoOpenPR } from '../../../api/github'

export type Window = '24h' | '7d' | '30d'

export const WINDOW_DAYS: Record<Window, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
}

export const WINDOW_LABELS: Record<Window, string> = {
  '24h': 'Last 24h',
  '7d': 'This week',
  '30d': 'This month',
}

export const STALE_PR_DAYS = 14
export const DORMANT_REPO_DAYS = 90

export type DigestStats = {
  totalRepos: number
  activeInWindow: number
  openPRs: number
  reposWithFailingCi: number
  stalePRs: number
  dormantRepos: number
  mostActive: Repo[]
  contributors: { login: string; avatarUrl?: string; prs: number; repoCount: number }[]
}

export function hasFailingCi(r: Repo): boolean {
  return (r.openPRs.nodes ?? []).some((pr: RepoOpenPR) => pr.ciState === 'FAILURE' || pr.ciState === 'ERROR')
}

export function computeDigest(repos: Repo[], _pinnedCount: number, window: Window): DigestStats {
  const now = Date.now()
  const windowMs = WINDOW_DAYS[window] * 86_400_000
  const staleMs = STALE_PR_DAYS * 86_400_000
  const dormantMs = DORMANT_REPO_DAYS * 86_400_000

  let activeInWindow = 0
  let openPRs = 0
  let reposWithFailingCi = 0
  let stalePRs = 0
  let dormantRepos = 0

  const byAuthor = new Map<string, { login: string; avatarUrl?: string; prs: number; repos: Set<string> }>()

  for (const r of repos) {
    const lastPush = new Date(r.pushedAt).getTime()
    if (now - lastPush < windowMs) activeInWindow += 1
    if (now - lastPush > dormantMs) dormantRepos += 1
    openPRs += r.openPRs.totalCount
    if (hasFailingCi(r)) reposWithFailingCi += 1
    for (const pr of r.openPRs.nodes ?? []) {
      if (pr.author?.login) {
        const cur = byAuthor.get(pr.author.login)
        if (cur) { cur.prs += 1; cur.repos.add(r.nameWithOwner) }
        else byAuthor.set(pr.author.login, { login: pr.author.login, avatarUrl: pr.author.avatarUrl, prs: 1, repos: new Set([r.nameWithOwner]) })
      }
      if (now - new Date(pr.updatedAt).getTime() > staleMs) stalePRs += 1
    }
  }

  const mostActive = repos
    .filter((r) => now - new Date(r.pushedAt).getTime() < windowMs)
    .toSorted((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
    .slice(0, 8)

  const contributors = Array.from(byAuthor.values())
    .map((e) => ({ login: e.login, avatarUrl: e.avatarUrl, prs: e.prs, repoCount: e.repos.size }))
    .toSorted((a, b) => b.prs - a.prs || b.repoCount - a.repoCount || a.login.localeCompare(b.login))
    .slice(0, 8)

  return {
    totalRepos: repos.length,
    activeInWindow,
    openPRs,
    reposWithFailingCi,
    stalePRs,
    dormantRepos,
    mostActive,
    contributors,
  }
}

export function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return `${Math.floor(day / 30)}mo ago`
}
