import { useQuery } from '@tanstack/react-query'
import { searchPRs, type PullRequest } from '../../api/github'
import { useEffect, useState } from 'react'
import { getActiveSnoozes } from '../../store/db'
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

      const items = [...byId.values()].sort((a, b) => {
        // Critical first, then by recency.
        const dotRank = (d: AttentionItem['dot']) => (d === 'critical' ? 0 : d === 'warn' ? 1 : d === 'info' ? 2 : 3)
        const r = dotRank(a.dot) - dotRank(b.dot)
        if (r !== 0) return r
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })

      return items
    }
  })
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
