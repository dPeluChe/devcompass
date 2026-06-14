import { useQuery } from '@tanstack/react-query'
import { searchPRs, type PullRequest, type Repo } from '../../api/github'
import { useEffect, useMemo, useState } from 'react'
import { getActiveSnoozes, getCachedPref, savePref, CACHE_TTLS } from '../../store/db'
import {
  type AttentionItem,
  type Reason,
  dotForReasons,
  isFailingCi,
  isStale,
  ownerAndName
} from './types'

/**
 * Runs the four PR cohorts that put something in front of the user:
 *   1. review-requested:@me           — somebody is waiting on my review
 *   2. author:@me + ciState=FAIL      — my own PRs with broken CI
 *   3. mentions:@me                   — I was @'d in a thread
 *   4. assignee:@me + stale           — assigned & old, candidate for triage
 *
 * Cohorts can overlap (e.g. authored + ci-failing) so we merge by PR id and
 * collect all matching reasons. Snoozed PRs are filtered locally.
 */
export function useNeedsMe(token: string, viewerLogin: string | undefined) {
  const enabled = !!token && !!viewerLogin
  return useQuery({
    queryKey: ['home', 'needs-me', viewerLogin ?? ''],
    enabled,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<AttentionItem[]> => {
      const me = viewerLogin!
      // IDB-backed so reloads paint instantly (same pattern as Sentry/PR detail).
      const prefKey = `needsMe:${me}`
      const cached = await getCachedPref<AttentionItem[]>(prefKey, CACHE_TTLS['needsMe:'])
      if (cached) return cached
      const [reviewRequested, authored, mentioned, assigned] = await Promise.all([
        searchPRs(token, `is:pr is:open review-requested:${me} archived:false sort:updated-desc`, 100),
        searchPRs(token, `is:pr is:open author:${me} archived:false sort:updated-desc`, 100),
        searchPRs(token, `is:pr is:open mentions:${me} archived:false sort:updated-desc`, 50),
        searchPRs(token, `is:pr is:open assignee:${me} archived:false sort:updated-desc`, 50)
      ])

      const byId = new Map<string, AttentionItem>()
      const tag = (pr: PullRequest, reason: Reason) => {
        const existing = byId.get(pr.id)
        if (existing) {
          if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
          return
        }
        const { org, repo } = ownerAndName(pr.repository.nameWithOwner)
        byId.set(pr.id, {
          id: pr.id,
          org,
          orgAvatarUrl: pr.repository.owner?.avatarUrl,
          repo,
          nameWithOwner: pr.repository.nameWithOwner,
          number: pr.number,
          title: pr.title,
          url: pr.url,
          isDraft: pr.isDraft,
          updatedAt: pr.updatedAt,
          ciState: pr.ciState,
          reviewDecision: pr.reviewDecision,
          author: pr.author,
          reasons: [reason],
          dot: 'info'
        })
      }

      for (const pr of reviewRequested) tag(pr, 'review-requested')
      // Every open PR I authored shows up — it's work I own. CI failing and
      // "changes requested" become additional reasons on top of my-pr so the
      // chip set on the row tells the full story.
      for (const pr of authored) {
        tag(pr, 'my-pr')
        if (isFailingCi(pr)) tag(pr, 'ci-failing')
        if (pr.reviewDecision === 'CHANGES_REQUESTED') tag(pr, 'changes')
      }
      for (const pr of mentioned) tag(pr, 'mentioned')
      for (const pr of assigned) {
        if (isStale(pr)) tag(pr, 'assigned')
        // and mark stale alongside, so the row chip can read "stale 3y"
        const existing = byId.get(pr.id)
        if (existing && isStale(pr) && !existing.reasons.includes('stale')) existing.reasons.push('stale')
      }

      // Compute dot color from final reason set.
      for (const item of byId.values()) item.dot = dotForReasons(item.reasons)

      // Strict reverse-chronological by updatedAt: the row's "9h"/"6mo" badge
      // matches the position. Severity is communicated by the dot color and the
      // reason chips, not by the order.
      const result = Array.from(byId.values()).toSorted(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      await savePref(prefKey, result)
      return result
    }
  })
}

/** Distinct repo owners → GitHub search scope (user: for you, org: for the rest), capped. */
export const SCOPE_CAP = 12
export function buildOwnerScope(repos: Pick<Repo, 'owner'>[], me: string): { scope: string; truncated: boolean } {
  const owners: string[] = []
  const seen = new Set<string>()
  for (const r of repos) {
    if (!seen.has(r.owner.login)) { seen.add(r.owner.login); owners.push(r.owner.login) }
  }
  const used = owners.slice(0, SCOPE_CAP)
  const scope = used.map((o) => (o === me ? `user:${o}` : `org:${o}`)).join(' ')
  return { scope, truncated: owners.length > SCOPE_CAP }
}

function prToPoolItem(pr: PullRequest): AttentionItem {
  const { org, repo } = ownerAndName(pr.repository.nameWithOwner)
  return {
    id: pr.id, org, orgAvatarUrl: pr.repository.owner?.avatarUrl, repo,
    nameWithOwner: pr.repository.nameWithOwner, number: pr.number, title: pr.title,
    url: pr.url, isDraft: pr.isDraft, updatedAt: pr.updatedAt, ciState: pr.ciState,
    reviewDecision: pr.reviewDecision, author: pr.author, reasons: ['review-pool'], dot: 'muted',
  }
}

/**
 * "Review pool": open PRs across the orgs/users whose repos you can see, that you
 * didn't author and aren't requested/assigned on — discoverable to review. One
 * live search, IDB-cached (5m). Scope is capped at SCOPE_CAP owners.
 */
export function useReviewPool(token: string, viewerLogin: string | undefined, repos: Repo[]) {
  const { scope, truncated } = useMemo(
    () => (viewerLogin ? buildOwnerScope(repos, viewerLogin) : { scope: '', truncated: false }),
    [repos, viewerLogin]
  )
  const query = useQuery({
    queryKey: ['home', 'review-pool', viewerLogin ?? '', scope],
    enabled: !!token && !!viewerLogin && scope.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AttentionItem[]> => {
      const me = viewerLogin!
      const prefKey = `reviewPool:${me}`
      const cached = await getCachedPref<AttentionItem[]>(prefKey, CACHE_TTLS['reviewPool:'])
      if (cached) return cached
      const q = `is:pr is:open archived:false draft:false -author:${me} -review-requested:${me} -assignee:${me} ${scope} sort:updated-desc`
      const items = (await searchPRs(token, q, 40)).map(prToPoolItem)
      await savePref(prefKey, items)
      return items
    },
  })
  return { ...query, truncated }
}

/** Reactive snooze set. Updates after manual snooze/unsnooze via setSnoozes. */
export function useSnoozes(): { snoozes: Set<string>; refresh: () => void } {
  const [snoozes, setSnoozes] = useState<Set<string>>(new Set())
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    getActiveSnoozes().then((s) => { if (alive) setSnoozes(s) })
    return () => { alive = false }
  }, [tick])
  return { snoozes, refresh: () => setTick((n) => n + 1) }
}
