import { useMemo, useState } from 'react'
import { FaEye, FaPen } from 'react-icons/fa'
import type { ReviewEvent } from '../../../api/github'
import { SanitizedMarkdown } from '../../SanitizedMarkdown'
import { miniMarkdown } from '../../../utils/miniMarkdown'
import type { StatusMsg } from '../DetailModalBody'

export type ComposerProps = {
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  body: string
  onBodyChange: (s: string) => void
  status: StatusMsg
  busy: boolean
  busyKind: ReviewEvent | 'COMMENT-ISSUE' | null
  onSubmitComment: () => void
  onSubmitApprove: () => void
  onSubmitRequestChanges: () => void
  isOwnPR: boolean
}

export function Composer({
  composerRef, body, onBodyChange, status, busy, busyKind,
  onSubmitComment, onSubmitApprove, onSubmitRequestChanges, isOwnPR
}: ComposerProps) {
  const [preview, setPreview] = useState(false)
  const reviewBlockedTitle = isOwnPR ? 'You can\'t review your own PR' : undefined
  const previewHtml = useMemo(() => (body.trim() ? miniMarkdown(body) : ''), [body])
  return (
    <section className="hs-composer">
      <div className="hs-composer-head">
        <h4>Add a comment or review</h4>
        <div className="hs-composer-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={!preview}
            className={`hs-composer-tab ${!preview ? 'active' : ''}`}
            onClick={() => setPreview(false)}
          ><FaPen size={11} /> Write</button>
          <button
            role="tab"
            aria-selected={preview}
            className={`hs-composer-tab ${preview ? 'active' : ''}`}
            onClick={() => setPreview(true)}
            disabled={!body.trim()}
          ><FaEye size={11} /> Preview</button>
        </div>
      </div>
      {preview ? (
        <div className="hs-composer-preview">
          {previewHtml ? (
            <SanitizedMarkdown html={previewHtml} />
          ) : (
            <span className="hs-muted-text">Nothing to preview.</span>
          )}
        </div>
      ) : (
        <textarea
          ref={composerRef}
          className="hs-composer-textarea"
          placeholder="Markdown supported. Press c to focus, ⌘↵ to submit a comment."
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSubmitComment()
            }
          }}
          disabled={busy}
        />
      )}
      <div className="hs-composer-actions">
        <button
          className="hs-modal-btn primary"
          onClick={onSubmitComment}
          disabled={busy || !body.trim()}
          title="Comment (⌘↵)"
        >
          {busyKind === 'COMMENT-ISSUE' ? 'Posting…' : <>💬 Comment</>}
        </button>
        {!isOwnPR && (
          <>
            <button
              className="hs-modal-btn ok"
              onClick={onSubmitApprove}
              disabled={busy}
              title="Approve (a)"
            >
              {busyKind === 'APPROVE' ? 'Approving…' : <>✓ Approve <kbd>a</kbd></>}
            </button>
            <button
              className="hs-modal-btn danger"
              onClick={onSubmitRequestChanges}
              disabled={busy || !body.trim()}
              title="Request changes (Shift+R)"
            >
              {busyKind === 'REQUEST_CHANGES' ? 'Submitting…' : <>✗ Request changes <kbd>⇧R</kbd></>}
            </button>
          </>
        )}
        {isOwnPR && (
          <span className="hs-status-inline" title={reviewBlockedTitle}>
            Your own PR — comment here, merge from the footer.
          </span>
        )}
        {status && (
          <span className={`hs-status-inline ${status.kind === 'ok' ? 'ok' : 'err'}`}>
            {status.text}
          </span>
        )}
      </div>
    </section>
  )
}
