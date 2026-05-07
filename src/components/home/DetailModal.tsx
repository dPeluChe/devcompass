import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FaAlignLeft, FaFileCode, FaComments } from 'react-icons/fa'
import { fetchPullRequestDetail, type PRDetail, type CheckContext, type Review } from '../../api/github'
import { queryKeys } from '../../store/queries'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import { OrgChip } from './OrgChip'
import type { AttentionItem } from './types'

type TabKey = 'description' | 'changes' | 'comments'

type Props = {
  token: string
  item: AttentionItem | null
  onClose: () => void
  onSnooze: (item: AttentionItem) => void
}

export function DetailModal({ token, item, onClose, onSnooze }: Props) {
  const open = !!item
  const [tab, setTab] = useState<TabKey>('description')

  // Reset to description whenever a new item opens.
  useEffect(() => {
    if (item) setTab('description')
  }, [item?.id])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  const detailQuery = useQuery<PRDetail, Error>({
    queryKey: item ? queryKeys.pr(item.org, item.repo, item.number) : ['pr-detail-disabled'],
    queryFn: () => fetchPullRequestDetail(token, item!.org, item!.repo, item!.number),
    enabled: open,
    staleTime: 60 * 1000
  })

  return (
    <div className={`hs-modal-shell ${open ? 'hs-modal-open' : ''}`}>
      <div className="hs-modal-backdrop" onClick={onClose} />
      <div
        className="hs-modal"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        onClick={(e) => e.stopPropagation()}
      >
        {item && (
          <>
            <ModalHead item={item} onClose={onClose} />
            <ModalBody
              item={item}
              detail={detailQuery.data}
              loading={detailQuery.isLoading}
              error={detailQuery.error}
              tab={tab}
              onTabChange={setTab}
            />
            <ModalFooter item={item} onSnooze={() => { onSnooze(item); onClose() }} />
          </>
        )}
      </div>
    </div>
  )
}

function ModalHead({ item, onClose }: { item: AttentionItem; onClose: () => void }) {
  return (
    <div className="hs-modal-head">
      <div className="hs-modal-head-main">
        <div className="hs-modal-head-bc">
          <OrgChip login={item.org} />
          <span>{item.org}</span>
          <span className="hs-sep">/</span>
          <span className="hs-repo-name">{item.repo}</span>
        </div>
        <h2>
          <span className="hs-pr-num">#{item.number}</span>
          {item.isDraft ? 'Draft: ' : ''}{item.title}
        </h2>
        <div className="hs-modal-head-meta">
          {item.reasons.map((r) => (
            <span key={r} className={`hs-reason r-${r}`}>{r.replace(/-/g, ' ')}</span>
          ))}
        </div>
      </div>
      <button className="hs-modal-close" title="Close (esc)" onClick={onClose}>×</button>
    </div>
  )
}

function ModalBody({
  item, detail, loading, error, tab, onTabChange
}: {
  item: AttentionItem
  detail: PRDetail | undefined
  loading: boolean
  error: Error | null
  tab: TabKey
  onTabChange: (t: TabKey) => void
}) {
  const filesCount = detail?.changedFiles ?? 0
  const conv = useMemo(() => buildConversation(detail), [detail])

  return (
    <div className="hs-modal-body">
      <aside className="hs-modal-meta">
        <MetaSection title="Author">
          {detail?.author ? (
            <div className="hs-meta-row">
              <img src={detail.author.avatarUrl} alt="" />
              <span>@{detail.author.login}</span>
            </div>
          ) : item.author ? (
            <div className="hs-meta-row">
              <img src={item.author.avatarUrl} alt="" />
              <span>@{item.author.login}</span>
            </div>
          ) : (
            <span className="hs-muted-text">unknown</span>
          )}
        </MetaSection>

        <MetaSection title="Branch">
          {detail ? (
            <div className="hs-branch">{detail.headRefName} → {detail.baseRefName}</div>
          ) : <Skeleton width="80%" />}
        </MetaSection>

        <MetaSection title="Reviewers">
          {detail ? <Reviewers detail={detail} /> : <Skeleton lines={2} />}
        </MetaSection>

        <MetaSection title="Checks">
          {loading ? <Skeleton lines={3} /> :
            detail?.checks && detail.checks.length > 0 ? <Checks checks={detail.checks} /> :
            <span className="hs-muted-text">no checks</span>}
        </MetaSection>

        <MetaSection title="Diff">
          {detail ? (
            <>
              <div><span style={{ color: '#3fb950' }}>+{detail.additions}</span> / <span style={{ color: 'var(--danger)' }}>−{detail.deletions}</span></div>
              <div style={{ fontSize: '0.85em', color: 'var(--muted)' }}>{detail.changedFiles} files</div>
            </>
          ) : <Skeleton width="60%" />}
        </MetaSection>

        {detail?.labels.nodes && detail.labels.nodes.length > 0 && (
          <MetaSection title="Labels">
            {detail.labels.nodes.map((l) => (
              <span key={l.name} className="hs-label-chip">{l.name}</span>
            ))}
          </MetaSection>
        )}
      </aside>

      <div className="hs-modal-content">
        <div className="hs-modal-tabs" role="tablist">
          <TabButton active={tab === 'description'} onClick={() => onTabChange('description')} icon={<FaAlignLeft />} label="Description" />
          <TabButton active={tab === 'changes'} onClick={() => onTabChange('changes')} icon={<FaFileCode />} label="Changes" count={filesCount || undefined} />
          <TabButton active={tab === 'comments'} onClick={() => onTabChange('comments')} icon={<FaComments />} label="Comments" count={conv.length || undefined} />
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', padding: '12px 0' }}>
            Failed to load PR: {error.message}
          </div>
        )}

        {tab === 'description' && (
          loading ? <Skeleton lines={4} /> :
            detail?.bodyHTML ? (
              <div className="hs-description-html"><SanitizedMarkdown html={detail.bodyHTML} /></div>
            ) : <span className="hs-muted-text">No description provided.</span>
        )}

        {tab === 'changes' && (
          loading ? <Skeleton lines={6} /> :
            detail?.files.nodes && detail.files.nodes.length > 0 ? (
              <FilesList nodes={detail.files.nodes} total={detail.changedFiles} />
            ) : <span className="hs-muted-text">No file changes available.</span>
        )}

        {tab === 'comments' && (
          loading ? <Skeleton lines={6} /> :
            conv.length > 0 ? (
              <ConversationList items={conv} />
            ) : <span className="hs-muted-text">No comments or reviews yet.</span>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, icon, count }: { active: boolean; onClick: () => void; label: string; icon: ReactNode; count?: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`hs-modal-tab ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="hs-modal-tab-icon">{icon}</span>
      <span>{label}</span>
      {count !== undefined && <span className="hs-modal-tab-count">{count}</span>}
    </button>
  )
}

function FilesList({ nodes, total }: { nodes: PRDetail['files']['nodes']; total: number }) {
  return (
    <div className="hs-file-list">
      {nodes.slice(0, 100).map((f, i) => (
        <div key={i} className="hs-file-row">
          <span className="hs-file-changetype">{changeTypeIcon(f.changeType)}</span>
          <span className="hs-file-path" title={f.path}>{f.path}</span>
          <span className="hs-file-stats">
            <span className="add">+{f.additions}</span> / <span className="del">−{f.deletions}</span>
          </span>
        </div>
      ))}
      {total > nodes.length && (
        <div style={{ color: 'var(--muted)', fontSize: '0.85em', padding: '6px 8px' }}>
          …{total - nodes.length} more files. <span className="hs-muted-text">Open on GitHub for the full diff.</span>
        </div>
      )}
    </div>
  )
}

function changeTypeIcon(t: string): string {
  if (t === 'ADDED') return 'A'
  if (t === 'DELETED') return 'D'
  if (t === 'RENAMED') return 'R'
  return 'M'
}

type ConvItem = {
  kind: 'review' | 'comment'
  state?: Review['state']
  author: { login: string; avatarUrl: string } | null
  bodyHTML: string
  time: string
}

function buildConversation(detail: PRDetail | undefined): ConvItem[] {
  if (!detail) return []
  const out: ConvItem[] = []
  for (const r of detail.reviews.nodes) {
    if (r.state === 'PENDING' || (!r.bodyHTML && r.state === 'COMMENTED')) continue
    out.push({
      kind: 'review',
      state: r.state,
      author: r.author,
      bodyHTML: r.bodyHTML,
      time: r.submittedAt ?? ''
    })
  }
  for (const c of detail.comments.nodes) {
    out.push({ kind: 'comment', author: c.author, bodyHTML: c.bodyHTML, time: c.createdAt })
  }
  return out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
}

function ConversationList({ items }: { items: ConvItem[] }) {
  return (
    <div className="hs-conv-list">
      {items.map((item, i) => (
        <article className="hs-conv-item" key={i}>
          {item.author?.avatarUrl ? (
            <img className="hs-conv-avatar" src={item.author.avatarUrl} alt="" />
          ) : (
            <span className="hs-conv-avatar hs-conv-avatar-fallback">·</span>
          )}
          <div className="hs-conv-main">
            <div className="hs-conv-head">
              <strong>@{item.author?.login ?? 'ghost'}</strong>
              {item.kind === 'review' && item.state && (
                <span className={`hs-conv-state ${stateClass(item.state)}`}>{stateLabel(item.state)}</span>
              )}
              {item.kind === 'comment' && <span className="hs-conv-state">commented</span>}
              <span className="hs-conv-time">{relativeTime(item.time)}</span>
            </div>
            {item.bodyHTML ? (
              <div className="hs-description-html"><SanitizedMarkdown html={item.bodyHTML} /></div>
            ) : (
              <span className="hs-muted-text">— no body —</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

function stateClass(s: Review['state']): string {
  if (s === 'APPROVED') return 'approved'
  if (s === 'CHANGES_REQUESTED') return 'changes'
  return ''
}
function stateLabel(s: Review['state']): string {
  if (s === 'APPROVED') return 'approved'
  if (s === 'CHANGES_REQUESTED') return 'requested changes'
  if (s === 'COMMENTED') return 'commented'
  if (s === 'DISMISSED') return 'dismissed'
  return s.toLowerCase()
}

function relativeTime(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(day / 365)}y ago`
}

function MetaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hs-meta-section">
      <h5>{title}</h5>
      {children}
    </div>
  )
}

function Reviewers({ detail }: { detail: PRDetail }) {
  const requested = detail.reviewRequests.nodes
    .map((rr) => rr.requestedReviewer)
    .filter((r): r is NonNullable<typeof r> => r !== null)
  const reviews = detail.reviews.nodes.filter((r) => r.author && r.state !== 'PENDING')

  if (requested.length === 0 && reviews.length === 0) {
    return <span className="hs-muted-text">none</span>
  }
  return (
    <>
      {reviews.map((rv, i) => {
        const stateClass = rv.state === 'APPROVED' ? 'approved' :
                           rv.state === 'CHANGES_REQUESTED' ? 'changes' : 'requested'
        const label = rv.state === 'APPROVED' ? 'approved' :
                      rv.state === 'CHANGES_REQUESTED' ? 'changes' : rv.state.toLowerCase()
        return (
          <div className="hs-meta-row" key={`r-${i}`}>
            {rv.author && <img src={rv.author.avatarUrl} alt="" />}
            <span>{rv.author?.login}</span>
            <span className={`hs-meta-state ${stateClass}`}>{label}</span>
          </div>
        )
      })}
      {requested.map((r, i) => (
        <div className="hs-meta-row" key={`req-${i}`}>
          <img src={r.avatarUrl} alt="" />
          <span>{r.__typename === 'User' ? r.login : r.name}</span>
          <span className="hs-meta-state requested">requested</span>
        </div>
      ))}
    </>
  )
}

function Checks({ checks }: { checks: CheckContext[] }) {
  return (
    <>
      {checks.map((c, i) => {
        const name = c.__typename === 'CheckRun' ? c.name : c.context
        const conclusion = c.__typename === 'CheckRun' ? c.conclusion : c.state
        const cls = conclusion === 'SUCCESS' ? 'ok' :
                    conclusion === 'FAILURE' || conclusion === 'ERROR' ? 'fail' :
                    conclusion === 'PENDING' || conclusion === 'EXPECTED' ? 'pending' : ''
        const icon = cls === 'ok' ? '✓' : cls === 'fail' ? '✕' : '⋯'
        return (
          <div key={i} className={`hs-check-row ${cls}`}>
            <span>{icon}</span>
            <span className="hs-check-name">{name}</span>
          </div>
        )
      })}
    </>
  )
}

function Skeleton({ lines = 1, width = '100%' }: { lines?: number; width?: string }) {
  return (
    <div className="hs-skeleton-block" style={{ padding: 0 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="hs-skeleton-bar" style={{ width: i === lines - 1 ? '70%' : width }} />
      ))}
    </div>
  )
}

function ModalFooter({ item, onSnooze }: { item: AttentionItem; onSnooze: () => void }) {
  return (
    <div className="hs-modal-footer">
      <button className="hs-modal-btn" onClick={onSnooze} title="Hide until tomorrow">
        Snooze <kbd>s</kbd>
      </button>
      <a className="hs-modal-btn link" href={item.url} target="_blank" rel="noopener noreferrer">
        Open on GitHub ↗
      </a>
    </div>
  )
}
