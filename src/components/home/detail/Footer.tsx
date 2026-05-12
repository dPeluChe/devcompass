import { useState } from 'react'
import type { MergeMethod, PRDetail } from '../../../api/github'

const MERGE_METHOD_KEY = 'home.mergeMethod'
const METHOD_LABELS: Record<MergeMethod, string> = {
  squash: 'Squash and merge',
  merge: 'Create a merge commit',
  rebase: 'Rebase and merge'
}

type FooterProps = {
  detail: PRDetail | undefined
  isOwnPR: boolean
  canRerun: boolean
  rerunBusy: boolean
  onRerun: () => void
  onApprove: () => void
  approveBusy: boolean
  onMerge: (method: MergeMethod) => void
  mergeBusy: boolean
  onSnooze: () => void
}

export function ModalFooter({
  detail, isOwnPR, canRerun, rerunBusy, onRerun,
  onApprove, approveBusy, onMerge, mergeBusy, onSnooze
}: FooterProps) {
  // Approve appears as a quick action when the PR is open and not yet approved.
  // GitHub rejects approving your own PR (422), so we hide the button entirely.
  const canApprove = detail?.state === 'OPEN' && detail.reviewDecision !== 'APPROVED' && !isOwnPR
  const isOpen = detail?.state === 'OPEN' && !detail.isDraft
  const canMerge = detail?.mergeable === 'MERGEABLE' && isOpen

  return (
    <div className="hs-modal-footer">
      <div className="hs-modal-footer-actions">
        {canApprove && (
          <button className="hs-modal-btn ok" onClick={onApprove} disabled={approveBusy} title="Approve PR (a)">
            {approveBusy ? 'Approving…' : '✓ Approve'} <kbd>a</kbd>
          </button>
        )}
        {canRerun && (
          <button className="hs-modal-btn" onClick={onRerun} disabled={rerunBusy} title="Re-run failing jobs">
            {rerunBusy ? 'Requesting…' : '↻ Re-run failing'}
          </button>
        )}
        {detail?.state === 'OPEN' && (
          <FooterMergeButton detail={detail} canMerge={canMerge} isOwnPR={isOwnPR} onMerge={onMerge} busy={mergeBusy} />
        )}
      </div>
      <div className="hs-modal-footer-utility">
        <button className="hs-modal-btn" onClick={onSnooze} title="Hide until tomorrow (s)">
          Snooze <kbd>s</kbd>
        </button>
      </div>
    </div>
  )
}

function FooterMergeButton({ detail, canMerge, isOwnPR, onMerge, busy }: {
  detail: PRDetail
  canMerge: boolean
  isOwnPR: boolean
  onMerge: (method: MergeMethod) => void
  busy: boolean
}) {
  const [method, setMethod] = useState<MergeMethod>(() => {
    try {
      const saved = localStorage.getItem(MERGE_METHOD_KEY) as MergeMethod | null
      if (saved === 'squash' || saved === 'merge' || saved === 'rebase') return saved
    } catch { /* ignore */ }
    return 'squash'
  })
  const [open, setOpen] = useState(false)
  function pick(m: MergeMethod) {
    setMethod(m)
    setOpen(false)
    try { localStorage.setItem(MERGE_METHOD_KEY, m) } catch { /* ignore */ }
  }
  // Own PRs don't need review approval to be ready — the green styling kicks
  // in based on CI + mergeability alone for the solo-dev workflow.
  const reviewOk = detail.reviewDecision === 'APPROVED' || isOwnPR
  const checksOk =
    detail.checks.length === 0 ||
    detail.checks.every((c) => {
      if (c.__typename === 'CheckRun') return c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED'
      return c.state === 'SUCCESS'
    })
  const allGreen = canMerge && reviewOk && checksOk
  return (
    <div className={`hs-merge-action ${allGreen ? 'green' : ''}`}>
      <button
        className="hs-merge-btn primary"
        onClick={() => onMerge(method)}
        disabled={!canMerge || busy}
        title={canMerge ? `Merge with method: ${method}` : 'Not mergeable yet'}
      >
        {busy ? 'Merging…' : METHOD_LABELS[method]}
      </button>
      <button
        className="hs-merge-method-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose merge method"
      >▾</button>
      {open && (
        <div className="hs-merge-menu" role="menu">
          {(['squash', 'merge', 'rebase'] as const).map((m) => (
            <button
              key={m}
              className={`hs-merge-menu-item ${m === method ? 'active' : ''}`}
              onClick={() => pick(m)}
            >
              {METHOD_LABELS[m]}
              {m === method && <span className="hs-merge-menu-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
