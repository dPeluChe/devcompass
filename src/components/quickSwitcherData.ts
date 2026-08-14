import type { Repo, RepoOpenPR } from '../api/github'
import type { ScopeKey } from './home/types'

export type QSAction =
  | { kind: 'view'; view: 'home' | 'repos' | 'config' }
  | { kind: 'scope'; scope: ScopeKey }
  | { kind: 'repo'; repo: Repo }
  | { kind: 'pr'; repo: Repo; pr: RepoOpenPR }

export type Item = {
  id: string
  primary: string
  secondary: string
  hint: string
  score: number
  action: QSAction
}

export const VIEWS: { view: 'home' | 'repos' | 'config'; label: string; hint: string }[] = [
  { view: 'home', label: 'Home', hint: 'g h' },
  { view: 'repos', label: 'Repos', hint: 'g r' },
  { view: 'config', label: 'Config', hint: 'g c' }
]

export const SCOPES: { scope: ScopeKey; label: string }[] = [
  { scope: 'digest', label: 'Digest' },
  { scope: 'needs', label: 'Needs me' },
  { scope: 'issues', label: 'Issues' },
  { scope: 'notifications', label: 'Notifications' },
  { scope: 'since', label: 'Since last visit' },
  { scope: 'pinned', label: 'Pinned' }
]

export function kindLabel(kind: QSAction['kind']): string {
  if (kind === 'view') return 'view'
  if (kind === 'repo') return 'repo'
  return 'pr'
}

export function buildItems(query: string, repos: Repo[]): Item[] {
  const q = query.toLowerCase().trim()
  const out: Item[] = []

  for (const v of VIEWS) {
    const score = q ? matchScore(v.label.toLowerCase(), q) : 100
    if (score > 0) {
      out.push({
        id: `view:${v.view}`,
        primary: v.label,
        secondary: '',
        hint: v.hint,
        score: score + 50, // views rank a bit lower than direct matches
        action: { kind: 'view', view: v.view }
      })
    }
  }

  for (const s of SCOPES) {
    const score = q ? matchScore(s.label.toLowerCase(), q) : 90
    if (score > 0) {
      out.push({
        id: `scope:${s.scope}`,
        primary: s.label,
        secondary: 'scope',
        hint: '',
        score: score + 45,
        action: { kind: 'scope', scope: s.scope }
      })
    }
  }

  for (const repo of repos) {
    const repoScore = q
      ? Math.max(
          matchScore(repo.name.toLowerCase(), q),
          matchScore(repo.nameWithOwner.toLowerCase(), q) - 5,
          matchScore((repo.description ?? '').toLowerCase(), q) - 30
        )
      : 80
    if (repoScore > 0) {
      out.push({
        id: `repo:${repo.id}`,
        primary: repo.name,
        secondary: repo.owner.login,
        hint: repo.openPRs.totalCount > 0 ? `${repo.openPRs.totalCount} PR` : '',
        score: repoScore,
        action: { kind: 'repo', repo }
      })
    }
    for (const pr of repo.openPRs.nodes ?? []) {
      const prScore = q
        ? Math.max(
            matchScore(pr.title.toLowerCase(), q),
            matchScore(`#${pr.number}`, q) + 10,
            matchScore(repo.nameWithOwner.toLowerCase(), q) - 20
          )
        : 40
      if (prScore > 0) {
        out.push({
          id: `pr:${pr.id}`,
          primary: `#${pr.number} ${pr.title}`,
          secondary: repo.nameWithOwner,
          hint: pr.isDraft ? 'draft' : '',
          score: prScore - 5, // PRs slightly below repos when scores tie
          action: { kind: 'pr', repo, pr }
        })
      }
    }
  }

  out.sort((a, b) => b.score - a.score)
  return out.slice(0, 60)
}

// Cheap scorer: prefix > word-start > substring. Returns 0 for no match.
export function matchScore(haystack: string, needle: string): number {
  if (!needle) return 0
  if (haystack === needle) return 1000
  if (haystack.startsWith(needle)) return 800
  // word boundary
  if (new RegExp(`\\b${escapeRegExp(needle)}`).test(haystack)) return 500
  const idx = haystack.indexOf(needle)
  if (idx >= 0) return Math.max(50, 200 - idx)
  // subsequence fallback (each needle char appears in order)
  let i = 0
  for (const c of haystack) {
    if (c === needle[i]) i++
    if (i === needle.length) break
  }
  if (i === needle.length) return 30
  return 0
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
