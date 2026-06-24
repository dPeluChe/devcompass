import { useState, useEffect, useRef, type MouseEvent } from 'react'
import { relativeTime } from '../../utils/time'
import { OrgChip } from './OrgChip'
import { ReasonChips, actionsFor, type ActionDef, type RowProps } from './rowParts'

type Props = RowProps & {
  onOpen: () => void
  onApprove?: () => void
  onRequestChanges?: () => void
  onSnooze: () => void
  onUnsnooze?: () => void
}

export function AttentionRow(props: Props) {
  const { item, onOpen, onApprove, onRequestChanges, onSnooze, onUnsnooze } = props
  const [snoozed, setSnoozed] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  function handleAction(e: MouseEvent, def: ActionDef) {
    e.stopPropagation()
    if (def.action === 'snooze') {
      setSnoozed(true)
      onSnooze()
      if (onUnsnooze) {
        setShowUndo(true)
        if (undoTimer.current) clearTimeout(undoTimer.current)
        undoTimer.current = setTimeout(() => setShowUndo(false), 5000)
      }
    } else if (def.action === 'github') {
      window.open(item.url, '_blank', 'noopener')
    } else if (def.action === 'approve') {
      if (onApprove) onApprove()
      else onOpen()
    } else if (def.action === 'request-changes') {
      if (onRequestChanges) onRequestChanges()
      else onOpen()
    } else {
      onOpen()
    }
  }

  function handleUndo(e: MouseEvent) {
    e.stopPropagation()
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setShowUndo(false)
    setSnoozed(false)
    onUnsnooze?.()
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
          <span className="hs-row-time">{relativeTime(item.updatedAt, false)}</span>
          {item.branch && (
            <span className="hs-branch" title={`${item.branch} → ${item.baseBranch ?? 'main'}`}>
              ⎇ {item.branch} <span className="hs-branch-arrow">→</span> {item.baseBranch ?? 'main'}
            </span>
          )}
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
      {showUndo && (
        <div className="hs-row-undo" role="status">
          <span>Snoozed 18h</span>
          <button className="hs-row-undo-btn" onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  )
}
