import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Hides the confirm button (one-button "OK"-style dialog). */
  hideConfirm?: boolean
  /** Switches the confirm button color: 'danger' = red, 'primary' = accent (default). */
  confirmKind?: 'primary' | 'danger'
  onConfirm?: () => void
  onCancel: () => void
}

/**
 * In-app confirmation dialog — replaces native window.confirm. Backdrop click
 * and Escape cancel; Enter confirms (when not focused on a text input).
 *
 * Pass `hideConfirm` for one-button informational dialogs (e.g. "Copy this
 * link manually") where the only action is to dismiss.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  hideConfirm = false,
  confirmKind = 'primary',
  onConfirm,
  onCancel
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Focus the confirm button (or cancel if no confirm) so Enter activates it.
    queueMicrotask(() => confirmBtnRef.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      else if (e.key === 'Enter' && !hideConfirm && onConfirm) {
        const tag = (document.activeElement as HTMLElement | null)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          onConfirm()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel, hideConfirm])

  if (!open) return null

  return (
    <div className="ui-confirm-shell">
      <div
        className="ui-confirm-backdrop"
        onClick={onCancel}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        role="button"
        tabIndex={-1}
        aria-label="Close dialog"
      />
      <div
        className="ui-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-confirm-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h3 id="ui-confirm-title" className="ui-confirm-title">{title}</h3>
        <div className="ui-confirm-body">{body}</div>
        <div className="ui-confirm-actions">
          <button type="button" className="ui-confirm-btn" onClick={onCancel}>{cancelLabel}</button>
          {!hideConfirm && onConfirm && (
            <button
              ref={confirmBtnRef}
              type="button"
              className={`ui-confirm-btn ${confirmKind}`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
