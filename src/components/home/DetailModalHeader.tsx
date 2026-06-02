import { useMemo, useState } from 'react'
import { FaCodeBranch } from 'react-icons/fa'
import type { PRDetail } from '../../api/github'
import { ConfirmDialog } from '../ConfirmDialog'
import { OrgChip } from './OrgChip'
import type { AttentionItem } from './types'
import { buildReviewers, reviewerStateLabel } from './detail/Summary'

export function ModalHead({ item, detail, onClose }: { item: AttentionItem; detail: PRDetail | undefined; onClose: () => void }) {
  return (
    <header className="hs-modal-head">
      <div className="hs-modal-head-top">
        <h2 className="hs-modal-title-row">
          <span className="hs-title-bc">
            <OrgChip login={item.org} avatarUrl={item.orgAvatarUrl} />
            <span className="hs-org-name">{item.org}</span>
            <span className="hs-sep">/</span>
            <span className="hs-repo-name">{item.repo}</span>
          </span>
          <span className="hs-title-sep">·</span>
          <span className="hs-pr-num">#{item.number}</span>
          <span className="hs-title-text">
            {item.isDraft ? 'Draft: ' : ''}{item.title}
          </span>
          {item.reasons.map((r) => (
            <span key={r} className={`hs-reason r-${r}`}>{r.replace(/-/g, ' ')}</span>
          ))}
        </h2>
        <button className="hs-modal-close" title="Close (esc)" onClick={onClose}>×</button>
      </div>
      {detail && <HeaderMeta detail={detail} item={item} />}
    </header>
  )
}

function HeaderMeta({ detail, item }: { detail: PRDetail; item: AttentionItem }) {
  const reviewers = useMemo(() => buildReviewers(detail), [detail])
  return (
    <div className="hs-head-meta-row">
      {detail.author && (
        <span className="hs-people-chip">
          <img src={detail.author.avatarUrl} alt="" />
          <span>@{detail.author.login}</span>
        </span>
      )}
      <span className="hs-head-sep">·</span>
      <span className="hs-head-branch" title={`${detail.headRefName} → ${detail.baseRefName}`}>
        <FaCodeBranch className="hs-branch-icon" />
        <code>{detail.headRefName}</code>
        <span className="hs-branch-arrow">→</span>
        <code>{detail.baseRefName}</code>
      </span>
      {reviewers.length > 0 && (
        <>
          <span className="hs-head-sep">·</span>
          {reviewers.map((r) => (
            <span key={r.login} className={`hs-people-chip state-${r.state}`} title={`${r.login} — ${reviewerStateLabel(r.state)}`}>
              <img src={r.avatarUrl} alt="" />
              <span>{r.state === 'team' ? r.login : `@${r.login}`}</span>
              <span className="hs-people-state">{reviewerStateLabel(r.state)}</span>
            </span>
          ))}
        </>
      )}
      {detail.labels.nodes.length > 0 && (
        <>
          <span className="hs-head-sep">·</span>
          {detail.labels.nodes.slice(0, 5).map((l) => (
            <span key={l.name} className="hs-label-chip">{l.name}</span>
          ))}
          {detail.labels.nodes.length > 5 && (
            <span className="hs-muted-text" style={{ fontSize: '0.78em' }}>+{detail.labels.nodes.length - 5}</span>
          )}
        </>
      )}
      <LinkActions item={item} />
    </div>
  )
}

function LinkActions({ item }: { item: AttentionItem }) {
  const [copied, setCopied] = useState(false)
  // When the Clipboard API fails (insecure context, denied permission, etc.)
  // we surface the URL in a styled dialog so the user can manually select +
  // copy. Replaces the old window.prompt fallback.
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  async function copyLink() {
    const url = item.url || `${window.location.origin}${window.location.pathname}?pr=${item.org}/${item.repo}/${item.number}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setFallbackUrl(url)
    }
  }
  return (
    <div className="hs-head-link-actions">
      <button className="hs-modal-btn" onClick={copyLink} title="Copy GitHub URL">
        {copied ? '✓ Copied' : '⎘ Copy link'}
      </button>
      <a className="hs-modal-btn link" href={item.url} target="_blank" rel="noopener noreferrer">
        Open on GitHub ↗
      </a>
      <ConfirmDialog
        open={!!fallbackUrl}
        title="Copy this link"
        hideConfirm
        cancelLabel="Done"
        body={
          <>
            <p>The browser blocked automatic copy. Select the link and copy it manually:</p>
            <input
              type="text"
              readOnly
              value={fallbackUrl ?? ''}
              onFocus={(e) => e.currentTarget.select()}
              autoFocus
            />
          </>
        }
        onCancel={() => setFallbackUrl(null)}
      />
    </div>
  )
}
