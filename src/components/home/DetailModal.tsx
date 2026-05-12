import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FaAlignLeft, FaFileCode, FaComments, FaCheckCircle, FaCodeBranch, FaInfoCircle } from 'react-icons/fa'
import {
  addIssueComment,
  fetchPullRequestDetail,
  mergePullRequest,
  rerunFailedJobs,
  submitReview,
  type MergeMethod,
  type PRCommit,
  type PRDetail,
  type ReviewEvent
} from '../../api/github'
import { queryKeys } from '../../store/queries'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import { OrgChip } from './OrgChip'
import type { AttentionItem } from './types'
import { ChecksList, Skeleton } from './detail/Checks'
import { ConversationList, buildConversation } from './detail/Conversation'
import { SummaryTab, buildReviewers, reviewerStateLabel } from './detail/Summary'
import { ModalFooter } from './detail/Footer'
import { relativeTime } from './detail/utils'

type TabKey = 'summary' | 'description' | 'commits' | 'changes' | 'checks' | 'comments'

type Props = {
  token: string
  /** Used to detect "you authored this" so we can hide review actions GitHub would reject (422). */
  viewerLogin?: string
  item: AttentionItem | null
  onClose: () => void
  onSnooze: (item: AttentionItem) => void
}

type StatusMsg = { kind: 'ok' | 'err'; text: string } | null

export function DetailModal({ token, viewerLogin, item, onClose, onSnooze }: Props) {
  const open = !!item
  const [tab, setTab] = useState<TabKey>('summary')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<StatusMsg>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  // Reset to summary whenever a new item opens.
  useEffect(() => {
    if (item) {
      setTab('summary')
      setBody('')
      setStatus(null)
    }
  }, [item?.id])

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

  const detail = detailQuery.data

  // GitHub 422s any review you submit on a PR you authored. Detecting this up
  // front lets the UI hide / disable those actions instead of letting the
  // error surface mid-click.
  const isOwnPR = useMemo(() => {
    if (!viewerLogin) return false
    if (item?.reasons.includes('my-pr')) return true
    if (detail?.author?.login === viewerLogin) return true
    return false
  }, [viewerLogin, item, detail])

  function invalidatePr() {
    if (!item) return
    queryClient.invalidateQueries({ queryKey: queryKeys.pr(item.org, item.repo, item.number) })
  }

  // ---- Mutations ----
  const reviewMutation = useMutation({
    mutationFn: (input: { event: ReviewEvent; body?: string }) =>
      submitReview(token, item!.org, item!.repo, item!.number, input.event, input.body),
    onSuccess: (_data, input) => {
      const label = input.event === 'APPROVE' ? 'Approved' :
                    input.event === 'REQUEST_CHANGES' ? 'Changes requested' : 'Comment posted'
      setStatus({ kind: 'ok', text: label })
      setBody('')
      invalidatePr()
    },
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })
  const commentMutation = useMutation({
    mutationFn: (input: { body: string }) =>
      addIssueComment(token, item!.org, item!.repo, item!.number, input.body),
    onSuccess: () => {
      setStatus({ kind: 'ok', text: 'Comment posted' })
      setBody('')
      invalidatePr()
    },
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })
  const rerunMutation = useMutation({
    mutationFn: (input: { runIds: number[] }) =>
      Promise.all(input.runIds.map((id) => rerunFailedJobs(token, item!.org, item!.repo, id))).then(() => undefined),
    onSuccess: () => setStatus({ kind: 'ok', text: 'Re-run requested' }),
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })
  const mergeMutation = useMutation({
    mutationFn: (input: { method: MergeMethod }) =>
      mergePullRequest(token, item!.org, item!.repo, item!.number, input.method),
    onSuccess: (_data, input) => {
      setStatus({ kind: 'ok', text: `Merged via ${input.method}` })
      invalidatePr()
    },
    onError: (err: Error) => setStatus({ kind: 'err', text: err.message })
  })

  const isBusy = reviewMutation.isPending || commentMutation.isPending || rerunMutation.isPending || mergeMutation.isPending

  // Auto-clear status after 4s.
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(t)
  }, [status])

  // ---- Action handlers (kept for both buttons & shortcuts) ----
  const focusComposer = () => {
    setTab('comments')
    queueMicrotask(() => composerRef.current?.focus())
  }
  const submitComment = () => {
    if (!body.trim()) { focusComposer(); setStatus({ kind: 'err', text: 'Comment body required' }); return }
    commentMutation.mutate({ body: body.trim() })
  }
  const submitApprove = () => {
    if (isOwnPR) { setStatus({ kind: 'err', text: "You can't review your own PR" }); return }
    reviewMutation.mutate({ event: 'APPROVE', body: body.trim() || undefined })
  }
  const submitRequestChanges = () => {
    if (isOwnPR) { setStatus({ kind: 'err', text: "You can't review your own PR" }); return }
    if (!body.trim()) { focusComposer(); setStatus({ kind: 'err', text: 'Body required for request changes' }); return }
    reviewMutation.mutate({ event: 'REQUEST_CHANGES', body: body.trim() })
  }

  // Find unique workflow run IDs from failing checks for the re-run button.
  const failingRunIds = useMemo(() => {
    if (!detail) return [] as number[]
    const ids = new Set<number>()
    for (const c of detail.checks) {
      if (c.__typename !== 'CheckRun') continue
      if (c.conclusion !== 'FAILURE' && c.conclusion !== 'TIMED_OUT' && c.conclusion !== 'CANCELLED') continue
      const id = c.checkSuite?.workflowRun?.databaseId
      if (id) ids.add(id)
    }
    return [...ids]
  }, [detail])

  const canRerun = failingRunIds.length > 0
  const submitRerun = () => {
    if (!canRerun) return
    rerunMutation.mutate({ runIds: failingRunIds })
  }

  // ---- Keyboard shortcuts (modal-scoped) ----
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Esc always closes
      if (e.key === 'Escape') { onClose(); return }
      // Skip when typing in composer / inputs / contentEditable
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // 'a' approve
      if (e.key === 'a') { e.preventDefault(); submitApprove(); return }
      // Shift+R request changes
      if (e.key === 'R') { e.preventDefault(); submitRequestChanges(); return }
      // 'c' focus composer
      if (e.key === 'c') { e.preventDefault(); focusComposer(); return }
      // 's' snooze + close
      if (e.key === 's' && item) { e.preventDefault(); onSnooze(item); onClose(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, item, body, detail])

  return (
    <div className={`hs-modal-shell ${open ? 'hs-modal-open' : ''}`}>
      <div
        className="hs-modal-backdrop"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        role="button"
        tabIndex={-1}
        aria-label="Close detail"
      />
      <div
        className="hs-modal"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {item && (
          <>
            <ModalHead item={item} detail={detail} onClose={onClose} />
            <ModalBody
              token={token}
              item={item}
              detail={detail}
              loading={detailQuery.isLoading}
              error={detailQuery.error}
              tab={tab}
              onTabChange={setTab}
              composerRef={composerRef}
              body={body}
              onBodyChange={setBody}
              status={status}
              busy={isBusy}
              busyKind={
                reviewMutation.isPending ? (reviewMutation.variables?.event ?? null) :
                commentMutation.isPending ? 'COMMENT-ISSUE' :
                null
              }
              onSubmitComment={submitComment}
              onSubmitApprove={submitApprove}
              onSubmitRequestChanges={submitRequestChanges}
              isOwnPR={isOwnPR}
            />
            <ModalFooter
              detail={detail}
              isOwnPR={isOwnPR}
              canRerun={canRerun}
              rerunBusy={rerunMutation.isPending}
              onRerun={submitRerun}
              onApprove={submitApprove}
              approveBusy={reviewMutation.isPending && reviewMutation.variables?.event === 'APPROVE'}
              onMerge={(method) => mergeMutation.mutate({ method })}
              mergeBusy={mergeMutation.isPending}
              onSnooze={() => { onSnooze(item); onClose() }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function ModalHead({ item, detail, onClose }: { item: AttentionItem; detail: PRDetail | undefined; onClose: () => void }) {
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
  async function copyLink() {
    const url = item.url || `${window.location.origin}${window.location.pathname}?pr=${item.org}/${item.repo}/${item.number}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', url)
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
    </div>
  )
}

function ModalBody(props: {
  token: string
  item: AttentionItem
  detail: PRDetail | undefined
  loading: boolean
  error: Error | null
  tab: TabKey
  onTabChange: (t: TabKey) => void
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
}) {
  const { token, item, detail, loading, error, tab, onTabChange, composerRef, body, onBodyChange,
          status, busy, busyKind, onSubmitComment, onSubmitApprove, onSubmitRequestChanges, isOwnPR } = props

  const filesCount = detail?.changedFiles ?? 0
  const conv = useMemo(() => buildConversation(detail), [detail])
  const checksCount = detail?.checks.length ?? 0
  const commitsCount = detail?.commits.totalCount ?? 0

  return (
    <div className="hs-modal-body">
      <div className="hs-modal-content">
        <div className="hs-modal-tabs" role="tablist">
          <TabButton active={tab === 'summary'} onClick={() => onTabChange('summary')} icon={<FaInfoCircle />} label="Summary" />
          <TabButton active={tab === 'description'} onClick={() => onTabChange('description')} icon={<FaAlignLeft />} label="Description" />
          <TabButton active={tab === 'commits'} onClick={() => onTabChange('commits')} icon={<FaCodeBranch />} label="Commits" count={commitsCount || undefined} />
          <TabButton active={tab === 'changes'} onClick={() => onTabChange('changes')} icon={<FaFileCode />} label="Changes" count={filesCount || undefined} />
          <TabButton active={tab === 'checks'} onClick={() => onTabChange('checks')} icon={<FaCheckCircle />} label="Checks" count={checksCount || undefined} />
          <TabButton active={tab === 'comments'} onClick={() => onTabChange('comments')} icon={<FaComments />} label="Comments" count={conv.length || undefined} />
        </div>

        {error && (
          <div className="hs-status hs-status-err">
            Failed to load PR: {error.message}
          </div>
        )}

        {tab === 'summary' && (
          loading ? <Skeleton lines={6} /> :
            detail ? (
              <SummaryTab
                detail={detail}
                onReadFull={() => onTabChange('description')}
                onOpenCommits={() => onTabChange('commits')}
                onOpenChecks={() => onTabChange('checks')}
                onOpenComments={() => onTabChange('comments')}
              />
            ) : <span className="hs-muted-text">No data.</span>
        )}

        {tab === 'description' && (
          loading ? <Skeleton lines={4} /> :
            detail?.bodyHTML ? (
              <div className="hs-description-html"><SanitizedMarkdown html={detail.bodyHTML} /></div>
            ) : <span className="hs-muted-text">No description provided.</span>
        )}

        {tab === 'commits' && (
          loading ? <Skeleton lines={5} /> :
            detail?.commits.nodes && detail.commits.nodes.length > 0 ? (
              <CommitsList nodes={detail.commits.nodes} totalCount={detail.commits.totalCount} />
            ) : <span className="hs-muted-text">No commits.</span>
        )}

        {tab === 'changes' && (
          loading ? <Skeleton lines={6} /> :
            detail?.files.nodes && detail.files.nodes.length > 0 ? (
              <FilesList nodes={detail.files.nodes} total={detail.changedFiles} />
            ) : <span className="hs-muted-text">No file changes available.</span>
        )}

        {tab === 'checks' && (
          loading ? <Skeleton lines={5} /> :
            detail?.checks && detail.checks.length > 0 ? (
              <ChecksList token={token} owner={item.org} repo={item.repo} checks={detail.checks} />
            ) : <span className="hs-muted-text">No checks for this PR.</span>
        )}

        {tab === 'comments' && (
          <>
            {loading ? <Skeleton lines={6} /> :
              conv.length > 0 ? (
                <ConversationList items={conv} />
              ) : <span className="hs-muted-text">No comments or reviews yet.</span>}

            <Composer
              composerRef={composerRef}
              body={body}
              onBodyChange={onBodyChange}
              status={status}
              busy={busy}
              busyKind={busyKind}
              onSubmitComment={onSubmitComment}
              onSubmitApprove={onSubmitApprove}
              onSubmitRequestChanges={onSubmitRequestChanges}
              isOwnPR={isOwnPR}
            />
          </>
        )}
      </div>
    </div>
  )
}

function Composer({
  composerRef, body, onBodyChange, status, busy, busyKind,
  onSubmitComment, onSubmitApprove, onSubmitRequestChanges, isOwnPR
}: {
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
}) {
  const reviewBlockedTitle = isOwnPR ? 'You can\'t review your own PR' : undefined
  return (
    <section className="hs-composer">
      <h4>Add a comment or review</h4>
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
      {nodes.slice(0, 100).map((f) => (
        <div key={f.path} className="hs-file-row">
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

function CommitsList({ nodes, totalCount }: { nodes: PRCommit[]; totalCount: number }) {
  // GraphQL returns oldest → newest within the slice. Reverse so HEAD is at the
  // top — what people expect when scanning recent work.
  const ordered = useMemo(() => [...nodes].reverse(), [nodes])
  const truncated = totalCount > nodes.length
  return (
    <div className="hs-commits-list">
      {ordered.map((c) => (
        <article className="hs-commit" key={c.oid}>
          {c.author?.user?.avatarUrl ? (
            <img className="hs-commit-avatar" src={c.author.user.avatarUrl} alt="" />
          ) : (
            <span className="hs-commit-avatar hs-commit-avatar-fallback">·</span>
          )}
          <div className="hs-commit-main">
            <div className="hs-commit-headline">{c.messageHeadline || '(no message)'}</div>
            <div className="hs-commit-meta">
              <span className="hs-commit-author">
                {c.author?.user?.login ? `@${c.author.user.login}` : c.author?.name ?? 'unknown'}
              </span>
              <span className="hs-commit-time" title={c.committedDate}>{relativeTime(c.committedDate)}</span>
            </div>
          </div>
          <a className="hs-commit-sha" href={c.url} target="_blank" rel="noopener noreferrer" title="Open commit on GitHub">
            {c.abbreviatedOid}
          </a>
        </article>
      ))}
      {truncated && (
        <div className="hs-muted-text" style={{ padding: '6px 8px', fontSize: '0.85em' }}>
          Showing the latest {nodes.length} of {totalCount} commits.
        </div>
      )}
    </div>
  )
}
