import type { PullRequest } from '../../api/github'

export type ScopeKey =
  | 'needs'
  | 'since'
  | 'watching'
  | 'pinned'
  | 'active'
  | 'repos'
  | 'digest'
  | 'rate'
  | `org:${string}`

/** True for an org-specific scope key (e.g. "org:Iteristech"). */
export function isOrgScope(s: ScopeKey): s is `org:${string}` {
  return typeof s === 'string' && s.startsWith('org:')
}

/** Extract the login from an "org:LOGIN" scope key. */
export function loginFromOrgScope(s: `org:${string}`): string {
  return s.slice('org:'.length)
}

export type Reason =
  | 'ci-failing'
  | 'review-requested'
  | 'mentioned'
  | 'assigned'
  | 'my-pr'
  | 'stale'
  | 'changes'
  | 'new-pr'
  | 'merged'

export type DotLevel = 'critical' | 'warn' | 'info' | 'ok' | 'muted'

/**
 * One actionable item in the home list. Built from a PullRequest plus the reasons
 * that put it in front of the user. A single PR can have multiple reasons (e.g.
 * authored AND ci-failing).
 */
export type AttentionItem = {
  id: string
  org: string
  /** Real avatar URL of the repo owner from the GitHub API. Falls back to a generated chip if missing. */
  orgAvatarUrl?: string
  repo: string
  nameWithOwner: string
  number: number
  title: string
  url: string
  isDraft: boolean
  updatedAt: string
  ciState: string | null
  reviewDecision: PullRequest['reviewDecision']
  author: PullRequest['author']
  reasons: Reason[]
  dot: DotLevel
}

const STALE_DAYS = 14

export function ageInDays(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

export function isStale(pr: { updatedAt: string }): boolean {
  return ageInDays(pr.updatedAt) > STALE_DAYS
}

export function isFailingCi(pr: { ciState: string | null }): boolean {
  return pr.ciState === 'FAILURE' || pr.ciState === 'ERROR'
}

/** Pick the strongest dot color from the reason set. */
export function dotForReasons(reasons: Reason[]): DotLevel {
  if (reasons.includes('ci-failing') || reasons.includes('changes')) return 'critical'
  if (reasons.includes('review-requested') || reasons.includes('assigned')) return 'warn'
  if (reasons.includes('mentioned') || reasons.includes('new-pr')) return 'info'
  if (reasons.includes('merged')) return 'muted'
  // A PR I authored with no urgent signal — green (mine, healthy).
  if (reasons.includes('my-pr')) return 'ok'
  return 'info'
}

export function ownerAndName(nameWithOwner: string): { org: string; repo: string } {
  const [org, repo = ''] = nameWithOwner.split('/')
  return { org, repo }
}
