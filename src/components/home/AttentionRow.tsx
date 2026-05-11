import { useState, type MouseEvent, type ReactNode } from 'react'
import { OrgChip } from './OrgChip'
import type { AttentionItem, Reason } from './types'

type Props = {
  item: AttentionItem
  failingCheckName?: string
  changesRequestedBy?: string
  reviewerCount?: number
  onOpen: () => void
  onSnooze: () => void
}

/** Renders the per-row reason chips. Some chips embed extra context derived locally. */
function ReasonChips({ item, failingCheckName, changesRequestedBy, reviewerCount }: Props) {
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
  if (r.includes('stale')) out.push(<span key="s" className="hs-reason r-stale">stale {timeAgo(item.updatedAt)}</span>)
  if (r.includes('new-pr')) out.push(<span key="n" className="hs-reason r-new-pr">new</span>)
  if (r.includes('merged')) out.push(<span key="mg" className="hs-reason r-merged">merged</span>)

  return <>{out}</>
}

type ActionDef = { label: string; kbd?: string; kind?: 'primary' | 'ok' | 'danger'; title?: string; action: 'open' | 'snooze' | 'github' }

function actionsFor(reasons: Reason[]): ActionDef[] {
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
    { label: '✓', kbd: 'a', kind: 'ok', title: 'Approve (Phase 2)', action: 'open' },
    { label: '✗', kbd: 'R', kind: 'danger', title: 'Request changes (Phase 2)', action: 'open' },
    { label: 'zZ', kbd: 's', title: 'Snooze', action: 'snooze' }
  ]
  if (reasons.includes('mentioned')) return [
    { label: 'Comment', kbd: '↵', kind: 'primary', action: 'open' },
    { label: '·', kbd: '.', title: 'Mark read (Phase 2)', action: 'snooze' }
  ]
  if (reasons.includes('assigned') && reasons.includes('stale')) return [
    { label: 'Triage', kbd: '↵', kind: 'primary', action: 'open' },
    { label: 'zZ', kbd: 's', title: 'Snooze', action: 'snooze' }
  ]
  return [{ label: 'Open', kbd: '↵', kind: 'primary', action: 'open' }]
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(day / 365)}y`
}

export function AttentionRow(props: Props) {
  const { item, onOpen, onSnooze } = props
  const [snoozed, setSnoozed] = useState(false)

  function handleAction(e: MouseEvent, def: ActionDef) {
    e.stopPropagation()
    if (def.action === 'snooze') {
      setSnoozed(true)
      onSnooze()
    } else if (def.action === 'github') {
      window.open(item.url, '_blank', 'noopener')
    } else {
      onOpen()
    }
  }

  return (
    <div
      className={`hs-row ${snoozed ? 'snoozed' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <span className={`hs-dot ${item.dot}`} />
      <div className="hs-row-main">
        <div className="hs-row-title">
          <OrgChip login={item.org} avatarUrl={item.orgAvatarUrl} />
          <span className="hs-org-name">{item.org}</span>
          <span className="hs-sep">/</span>
          <span className="hs-repo-name">{item.repo}</span>
          <span className="hs-pr-num">#{item.number}</span>
          <span className="hs-pr-title">{item.isDraft ? 'Draft: ' : ''}{item.title}</span>
        </div>
        <div className="hs-row-meta">
          <ReasonChips {...props} />
          <span className="hs-row-time">{timeAgo(item.updatedAt)}</span>
        </div>
      </div>
      <div
        className="hs-row-actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {actionsFor(item.reasons).map((a) => (
          <button
            key={a.label}
            className={`hs-row-action ${a.kind ?? ''}`}
            title={a.title || a.label}
            onClick={(e) => handleAction(e, a)}
          >
            {a.label}
            {a.kbd && <kbd>{a.kbd}</kbd>}
          </button>
        ))}
      </div>
    </div>
  )
}
