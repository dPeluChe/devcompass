import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FaAlignLeft, FaFileCode, FaComments, FaCheckCircle, FaCodeBranch, FaInfoCircle } from 'react-icons/fa'
import {
  addIssueComment,
  fetchJobLogs,
  fetchPullRequestDetail,
  fetchWorkflowRunJobs,
  mergePullRequest,
  rerunFailedJobs,
  submitReview,
  type CheckContext,
  type MergeMethod,
  type PRCommit,
  type PRDetail,
  type Review,
  type ReviewEvent,
  type WorkflowJob
} from '../../api/github'
import { queryKeys } from '../../store/queries'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import { OrgChip } from './OrgChip'
import type { AttentionItem } from './types'

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

type CheckRow = {
  name: string
  workflow?: string
  state: 'ok' | 'fail' | 'pending' | 'neutral' | 'skipped'
  detailLabel: string
  detailUrl: string | null
  /** Workflow run id — only for CheckRun-from-Actions; lets us match the job and fetch the log. */
  workflowRunId?: number
}

function normalizeCheck(c: CheckContext): CheckRow {
  if (c.__typename === 'CheckRun') {
    const status = c.status
    const conclusion = c.conclusion
    let state: CheckRow['state'] = 'neutral'
    let detailLabel = conclusion ?? status ?? 'unknown'
    if (conclusion === 'SUCCESS') { state = 'ok'; detailLabel = 'passed' }
    else if (conclusion === 'FAILURE' || conclusion === 'TIMED_OUT' || conclusion === 'CANCELLED') { state = 'fail'; detailLabel = conclusion.toLowerCase() }
    else if (conclusion === 'SKIPPED' || conclusion === 'NEUTRAL') { state = 'skipped'; detailLabel = conclusion.toLowerCase() }
    else if (status === 'IN_PROGRESS' || status === 'QUEUED' || status === 'PENDING' || status === 'WAITING' || status === 'REQUESTED' || conclusion === null) {
      state = 'pending'
      detailLabel = status === 'IN_PROGRESS' ? 'running' : status?.toLowerCase() ?? 'pending'
    }
    return {
      name: c.name,
      workflow: c.checkSuite?.workflowRun?.workflow.name,
      state,
      detailLabel,
      detailUrl: c.detailsUrl,
      workflowRunId: c.checkSuite?.workflowRun?.databaseId ?? undefined
    }
  }
  // StatusContext
  const s = c.state
  let state: CheckRow['state'] = 'neutral'
  if (s === 'SUCCESS') state = 'ok'
  else if (s === 'FAILURE' || s === 'ERROR') state = 'fail'
  else if (s === 'PENDING' || s === 'EXPECTED') state = 'pending'
  return {
    name: c.context,
    workflow: undefined,
    state,
    detailLabel: s.toLowerCase(),
    detailUrl: c.targetUrl
  }
}

function ChecksList({ token, owner, repo, checks }: { token: string; owner: string; repo: string; checks: CheckContext[] }) {
  const rows = useMemo(() => {
    const order: Record<CheckRow['state'], number> = { fail: 0, pending: 1, neutral: 2, skipped: 3, ok: 4 }
    return checks
      .map(normalizeCheck)
      .sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name))
  }, [checks])

  const counts = useMemo(() => {
    const c = { ok: 0, fail: 0, pending: 0, other: 0 }
    for (const r of rows) {
      if (r.state === 'ok') c.ok++
      else if (r.state === 'fail') c.fail++
      else if (r.state === 'pending') c.pending++
      else c.other++
    }
    return c
  }, [rows])

  return (
    <div className="hs-checks-tab">
      <div className="hs-checks-summary">
        {counts.fail > 0 && <span className="hs-checks-pill fail">✕ {counts.fail} failing</span>}
        {counts.pending > 0 && <span className="hs-checks-pill pending">⋯ {counts.pending} pending</span>}
        {counts.ok > 0 && <span className="hs-checks-pill ok">✓ {counts.ok} passed</span>}
        {counts.other > 0 && <span className="hs-checks-pill neutral">⊘ {counts.other} skipped/neutral</span>}
      </div>
      <div className="hs-checks-list">
        {rows.map((r) => (
          <CheckItem key={r.name} row={r} token={token} owner={owner} repo={repo} />
        ))}
      </div>
    </div>
  )
}

const MAX_LOG_LINES = 500

function CheckItem({ row, token, owner, repo }: { row: CheckRow; token: string; owner: string; repo: string }) {
  const [expanded, setExpanded] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [matchedJob, setMatchedJob] = useState<WorkflowJob | null>(null)

  // Only Actions-driven CheckRuns can yield logs (need workflow run id + matching job).
  const supportsLog = !!row.workflowRunId

  async function loadLog() {
    if (!row.workflowRunId) return
    setLoading(true)
    setErr(null)
    try {
      const jobs = await fetchWorkflowRunJobs(token, owner, repo, row.workflowRunId)
      const job = jobs.find((j) => j.name === row.name) ?? jobs[0]
      if (!job) {
        setErr('No matching job found in this workflow run.')
        return
      }
      setMatchedJob(job)
      const text = await fetchJobLogs(token, owner, repo, job.id)
      const lines = text.split('\n')
      const trimmed = lines.length > MAX_LOG_LINES
        ? lines.slice(-MAX_LOG_LINES).join('\n')
        : text
      setLog(trimmed)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!expanded && log === null && supportsLog) {
      loadLog()
    }
    setExpanded((v) => !v)
  }

  const totalLines = log?.split('\n').length ?? 0

  return (
    <div className={`hs-check-item state-${row.state} ${expanded ? 'expanded' : ''}`}>
      <button className="hs-check-row-btn" onClick={toggle} disabled={!supportsLog && !row.detailUrl}>
        <span className="hs-check-icon">{checkIcon(row.state)}</span>
        <div className="hs-check-body">
          <div className="hs-check-line">
            <span className="hs-check-namebig">{row.name}</span>
            {row.workflow && <span className="hs-check-workflow">{row.workflow}</span>}
          </div>
          <div className="hs-check-detail">{row.detailLabel}</div>
        </div>
        {supportsLog ? (
          <span className="hs-check-log-btn">{expanded ? 'Hide log' : 'Show log'} {expanded ? '▴' : '▾'}</span>
        ) : row.detailUrl ? (
          <a
            className="hs-check-log"
            href={row.detailUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >View log →</a>
        ) : null}
      </button>
      {expanded && supportsLog && (
        <div className="hs-check-log-panel">
          {loading && <Skeleton lines={5} />}
          {err && (
            <div className="hs-status hs-status-err">
              {err}
              {row.detailUrl && (
                <> · <a href={row.detailUrl} target="_blank" rel="noopener noreferrer">Open on GitHub →</a></>
              )}
            </div>
          )}
          {log != null && (
            <>
              <div className="hs-log-meta">
                {matchedJob ? (
                  <span>
                    Job <strong>{matchedJob.name}</strong> · {totalLines} lines{' '}
                    {matchedJob.html_url && (
                      <a href={matchedJob.html_url} target="_blank" rel="noopener noreferrer">Open full log on GitHub →</a>
                    )}
                  </span>
                ) : null}
              </div>
              <pre className="hs-log-pre">{log}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function checkIcon(state: CheckRow['state']): string {
  if (state === 'ok') return '✓'
  if (state === 'fail') return '✕'
  if (state === 'pending') return '⋯'
  if (state === 'skipped') return '⊘'
  return '○'
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
      {items.map((item) => (
        <article className="hs-conv-item" key={`${item.kind}:${item.time}:${item.author?.login ?? '?'}`}>
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


function SummaryTab({
  detail, onReadFull, onOpenCommits, onOpenChecks, onOpenComments
}: {
  detail: PRDetail
  onReadFull: () => void
  onOpenCommits: () => void
  onOpenChecks: () => void
  onOpenComments: () => void
}) {
  // detail.commits.nodes is PRCommit[] after the fetch flattening — no .commit access.
  const head = detail.commits.nodes[detail.commits.nodes.length - 1]
  const bodyExcerpt = useMemo(() => {
    if (!detail.bodyHTML) return ''
    // Strip HTML tags + collapse whitespace, then take first ~280 chars.
    const text = detail.bodyHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 280 ? text.slice(0, 280) + '…' : text
  }, [detail.bodyHTML])
  const checksLine = mergeChecksLine(detail)
  const conv = useMemo(() => buildConversation(detail), [detail])
  const latest = conv[conv.length - 1]
  const latestExcerpt = useMemo(() => {
    if (!latest?.bodyHTML) return ''
    const text = latest.bodyHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 240 ? text.slice(0, 240) + '…' : text
  }, [latest])

  return (
    <div className="hs-summary">
      {/* 1. Description */}
      {bodyExcerpt && (
        <section className="hs-summary-desc">
          <h5>Description</h5>
          <p>{bodyExcerpt}</p>
          <button className="hs-summary-readmore" onClick={onReadFull}>Read full description →</button>
        </section>
      )}

      {/* 2. Last commit / Diff / CI */}
      <div className="hs-summary-grid">
        {head && (
          <a className="hs-summary-card" href={head.url} target="_blank" rel="noopener noreferrer" title="Open commit on GitHub">
            <h5>Last commit</h5>
            <div className="hs-summary-commit-line">{head.messageHeadline || '(no message)'}</div>
            <div className="hs-summary-sub">
              <code>{head.abbreviatedOid}</code> · {head.author?.user?.login ? `@${head.author.user.login}` : head.author?.name ?? 'unknown'} · {relativeTime(head.committedDate)}
            </div>
          </a>
        )}

        <button className="hs-summary-card" onClick={onOpenCommits} title="Open commits tab">
          <h5>Diff</h5>
          <div className="hs-summary-big">
            <span style={{ color: '#3fb950' }}>+{detail.additions}</span>{' '}
            <span style={{ color: 'var(--muted)' }}>/</span>{' '}
            <span style={{ color: 'var(--danger)' }}>−{detail.deletions}</span>
          </div>
          <div className="hs-summary-sub">
            {detail.changedFiles} files · {detail.commits.totalCount} commits
          </div>
        </button>

        <button className="hs-summary-card" onClick={onOpenChecks} title="Open checks tab">
          <h5>CI</h5>
          <div className={`hs-summary-big state-${checksLine.kind}`}>
            {checksLine.kind === 'ok' ? '✓' : checksLine.kind === 'fail' ? '✕' : '⋯'} {checksLine.title}
          </div>
          {checksLine.detail && <div className="hs-summary-sub">{checksLine.detail}</div>}
        </button>
      </div>

      {/* 3. Latest comment */}
      {latest && (
        <section className="hs-summary-latest">
          <div className="hs-summary-latest-head">
            <h5>Latest comment</h5>
            <button className="hs-summary-readmore" onClick={onOpenComments}>View all {conv.length} →</button>
          </div>
          <div className="hs-summary-latest-row">
            {latest.author?.avatarUrl ? (
              <img className="hs-conv-avatar" src={latest.author.avatarUrl} alt="" />
            ) : (
              <span className="hs-conv-avatar hs-conv-avatar-fallback">·</span>
            )}
            <div className="hs-summary-latest-body">
              <div className="hs-conv-head">
                <strong>@{latest.author?.login ?? 'ghost'}</strong>
                {latest.kind === 'review' && latest.state && (
                  <span className={`hs-conv-state ${stateClass(latest.state)}`}>{stateLabel(latest.state)}</span>
                )}
                {latest.kind === 'comment' && <span className="hs-conv-state">commented</span>}
                <span className="hs-conv-time">{relativeTime(latest.time)}</span>
              </div>
              {latestExcerpt ? (
                <p className="hs-summary-latest-text">{latestExcerpt}</p>
              ) : (
                <span className="hs-muted-text">— no body —</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Closed/merged banner — for OPEN PRs the merge action lives in the modal footer. */}
      {detail.state !== 'OPEN' && (
        <div className={`hs-summary-state-banner state-${detail.state.toLowerCase()}`}>
          {detail.state === 'MERGED' ? '✓ Merged' : '✕ Closed'} · {detail.headRefName} → {detail.baseRefName}
        </div>
      )}
    </div>
  )
}

type ReviewerEntry = {
  login: string
  avatarUrl: string
  state: 'approved' | 'changes' | 'requested' | 'commented' | 'team'
}

function buildReviewers(detail: PRDetail): ReviewerEntry[] {
  // Latest review per author (people who already responded), plus people still
  // on the request list (haven't responded yet). Latest review wins for state.
  const byAuthor = new Map<string, ReviewerEntry>()
  for (const r of detail.reviews.nodes) {
    if (!r.author || r.state === 'PENDING') continue
    const state =
      r.state === 'APPROVED' ? 'approved' :
      r.state === 'CHANGES_REQUESTED' ? 'changes' :
      r.state === 'COMMENTED' ? 'commented' : 'requested'
    byAuthor.set(r.author.login, { login: r.author.login, avatarUrl: r.author.avatarUrl, state })
  }
  for (const rr of detail.reviewRequests.nodes) {
    const r = rr.requestedReviewer
    if (!r) continue
    if (r.__typename === 'User') {
      if (!byAuthor.has(r.login)) {
        byAuthor.set(r.login, { login: r.login, avatarUrl: r.avatarUrl, state: 'requested' })
      }
    } else {
      // Team — skip if already represented.
      const key = `team:${r.name}`
      if (!byAuthor.has(key)) {
        byAuthor.set(key, { login: r.name, avatarUrl: r.avatarUrl, state: 'team' })
      }
    }
  }
  const order: Record<ReviewerEntry['state'], number> = { changes: 0, requested: 1, commented: 2, team: 3, approved: 4 }
  return Array.from(byAuthor.values()).toSorted((a, b) => order[a.state] - order[b.state] || a.login.localeCompare(b.login))
}

function reviewerStateLabel(s: ReviewerEntry['state']): string {
  if (s === 'approved') return 'approved'
  if (s === 'changes') return 'changes'
  if (s === 'requested') return 'requested'
  if (s === 'commented') return 'commented'
  return 'team'
}

const MERGE_METHOD_KEY = 'home.mergeMethod'
const METHOD_LABELS: Record<MergeMethod, string> = {
  squash: 'Squash and merge',
  merge: 'Create a merge commit',
  rebase: 'Rebase and merge'
}

type MergeStatus = { kind: 'ok' | 'fail' | 'pending'; title: string; detail?: string }

function mergeChecksLine(d: PRDetail): MergeStatus {
  const checks = d.checks
  if (checks.length === 0) return { kind: 'ok', title: 'No checks configured' }
  let ok = 0
  let fail = 0
  let pending = 0
  for (const c of checks) {
    if (c.__typename === 'CheckRun') {
      if (c.conclusion === 'SUCCESS' || c.conclusion === 'NEUTRAL' || c.conclusion === 'SKIPPED') ok++
      else if (c.conclusion === 'FAILURE' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'CANCELLED' || c.conclusion === 'ACTION_REQUIRED') fail++
      else pending++
    } else {
      if (c.state === 'SUCCESS') ok++
      else if (c.state === 'FAILURE' || c.state === 'ERROR') fail++
      else pending++
    }
  }
  if (fail > 0) return { kind: 'fail', title: `${fail} failing check${fail === 1 ? '' : 's'}`, detail: `${ok} passed, ${pending} pending` }
  if (pending > 0) return { kind: 'pending', title: `${pending} check${pending === 1 ? '' : 's'} running`, detail: `${ok} passed` }
  return { kind: 'ok', title: 'All checks passed', detail: `${ok} successful` }
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

function ModalFooter({
  detail, isOwnPR, canRerun, rerunBusy, onRerun,
  onApprove, approveBusy, onMerge, mergeBusy, onSnooze
}: {
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
}) {
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
