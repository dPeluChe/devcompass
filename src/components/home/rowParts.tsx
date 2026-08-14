import type { ReactNode } from 'react'
import { relativeTime } from '../../utils/time'
import type { AttentionItem, Reason } from './types'

export type RowProps = {
  item: AttentionItem
  failingCheckName?: string
  changesRequestedBy?: string
  reviewerCount?: number
}

/** Renders the per-row reason chips. Some chips embed extra context derived locally. */
export function ReasonChips({ item, failingCheckName, changesRequestedBy, reviewerCount }: RowProps) {
  const r = item.reasons
  const out: ReactNode[] = []

  if (r.includes('ci-failing')) {
    out.push(
      <span key="ci" className="hs-reason r-ci-failing">
        {failingCheckName ? <>CI: <b>{failingCheckName}</b> failed</> : 'CI failing'}
      </span>
    )
  }
  if (r.includes('changes')) {
    out.push(
      <span key="changes" className="hs-reason r-changes">
        {changesRequestedBy ? <><b>{changesRequestedBy}</b> requested changes</> : 'changes requested'}
      </span>
    )
  }
  if (r.includes('review-requested')) {
    out.push(
      <span key="review" className="hs-reason r-review-requested">
        {reviewerCount && reviewerCount > 1 ? `${reviewerCount} reviewers waiting` : 'review requested'}
      </span>
    )
  }
  if (r.includes('mentioned')) out.push(<span key="m" className="hs-reason r-mentioned">mentioned in review</span>)
  if (r.includes('assigned')) out.push(<span key="a" className="hs-reason r-assigned">assigned</span>)
  if (r.includes('my-pr')) out.push(<span key="my" className="hs-reason r-my-pr">my PR</span>)
  if (r.includes('stale')) out.push(<span key="s" className="hs-reason r-stale">stale {relativeTime(item.updatedAt, false)}</span>)
  if (r.includes('new-pr')) out.push(<span key="n" className="hs-reason r-new-pr">new</span>)
  if (r.includes('merged')) out.push(<span key="mg" className="hs-reason r-merged">merged</span>)
  if (r.includes('review-pool')) out.push(<span key="rp" className="hs-reason r-review-pool">open · unassigned</span>)

  return <>{out}</>
}

export type ActionDef = { label: string; kbd?: string; kind?: 'primary' | 'ok' | 'danger'; title?: string; action: 'open' | 'approve' | 'request-changes' | 'snooze' | 'github' }

export function actionsFor(reasons: Reason[]): ActionDef[] {
  if (reasons.includes('ci-failing')) return [
    { label: 'View log', kbd: '↵', kind: 'primary', action: 'open' },
    { label: '↻', kbd: 'r', title: 'Re-run failing checks', action: 'github' },
    { label: 'zZ', kbd: 's', title: 'Snooze', action: 'snooze' }
  ]
  if (reasons.includes('changes') && reasons.includes('my-pr')) return [
    { label: 'Thread', kbd: '↵', kind: 'primary', action: 'open' },
    { label: 'zZ', kbd: 's', title: 'Snooze', action: 'snooze' }
  ]
  if (reasons.includes('review-requested')) return [
    { label: '✓', kbd: 'a', kind: 'ok', title: 'Approve — opens detail and submits', action: 'approve' },
    { label: '✗', kbd: 'R', kind: 'danger', title: 'Request changes — opens detail composer', action: 'request-changes' },
    { label: 'zZ', kbd: 's', title: 'Snooze', action: 'snooze' }
  ]
  if (reasons.includes('mentioned')) return [
    { label: 'Comment', kbd: '↵', kind: 'primary', action: 'open' },
    { label: 'Mark read', kbd: '.', title: 'Snooze 18h (marks as read until tomorrow)', action: 'snooze' }
  ]
  if (reasons.includes('assigned') && reasons.includes('stale')) return [
    { label: 'Triage', kbd: '↵', kind: 'primary', action: 'open' },
    { label: 'zZ', kbd: 's', title: 'Snooze', action: 'snooze' }
  ]
  return [{ label: 'Open', kbd: '↵', kind: 'primary', action: 'open' }]
}
