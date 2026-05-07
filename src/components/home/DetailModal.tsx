import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FaAlignLeft, FaFileCode, FaComments, FaCheckCircle } from 'react-icons/fa'
import {
  addIssueComment,
  fetchJobLogs,
  fetchPullRequestDetail,
  fetchWorkflowRunJobs,
  rerunFailedJobs,
  submitReview,
  type CheckContext,
  type PRDetail,
  type Review,
  type ReviewEvent,
  type WorkflowJob
} from '../../api/github'
import { queryKeys } from '../../store/queries'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import { OrgChip } from './OrgChip'
import type { AttentionItem } from './types'

type TabKey = 'description' | 'changes' | 'comments' | 'checks'

type Props = {
  token: string
  item: AttentionItem | null
  onClose: () => void
  onSnooze: (item: AttentionItem) => void
}

type StatusMsg = { kind: 'ok' | 'err'; text: string } | null

export function DetailModal({ token, item, onClose, onSnooze }: Props) {
  const open = !!item
  const [tab, setTab] = useState<TabKey>('description')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<StatusMsg>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  // Reset to description whenever a new item opens.
  useEffect(() => {
    if (item) {
      setTab('description')
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

  const isBusy = reviewMutation.isPending || commentMutation.isPending || rerunMutation.isPending

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
    reviewMutation.mutate({ event: 'APPROVE', body: body.trim() || undefined })
  }
  const submitRequestChanges = () => {
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
            />
            <ModalFooter
              item={item}
              canRerun={canRerun}
              rerunBusy={rerunMutation.isPending}
              onRerun={submitRerun}
              onSnooze={() => { onSnooze(item); onClose() }}
            />
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
          <OrgChip login={item.org} avatarUrl={item.orgAvatarUrl} />
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
}) {
  const { token, item, detail, loading, error, tab, onTabChange, composerRef, body, onBodyChange,
          status, busy, busyKind, onSubmitComment, onSubmitApprove, onSubmitRequestChanges } = props

  const filesCount = detail?.changedFiles ?? 0
  const conv = useMemo(() => buildConversation(detail), [detail])
  const checksCount = detail?.checks.length ?? 0

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
          <TabButton active={tab === 'checks'} onClick={() => onTabChange('checks')} icon={<FaCheckCircle />} label="Checks" count={checksCount || undefined} />
          <TabButton active={tab === 'comments'} onClick={() => onTabChange('comments')} icon={<FaComments />} label="Comments" count={conv.length || undefined} />
        </div>

        {error && (
          <div className="hs-status hs-status-err">
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
            />
          </>
        )}
      </div>
    </div>
  )
}

function Composer({
  composerRef, body, onBodyChange, status, busy, busyKind,
  onSubmitComment, onSubmitApprove, onSubmitRequestChanges
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
}) {
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
        {rows.map((r, i) => (
          <CheckItem key={i} row={r} token={token} owner={owner} repo={repo} />
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
        const stateClassName = rv.state === 'APPROVED' ? 'approved' :
                           rv.state === 'CHANGES_REQUESTED' ? 'changes' : 'requested'
        const label = rv.state === 'APPROVED' ? 'approved' :
                      rv.state === 'CHANGES_REQUESTED' ? 'changes' : rv.state.toLowerCase()
        return (
          <div className="hs-meta-row" key={`r-${i}`}>
            {rv.author && <img src={rv.author.avatarUrl} alt="" />}
            <span>{rv.author?.login}</span>
            <span className={`hs-meta-state ${stateClassName}`}>{label}</span>
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

function ModalFooter({ item, canRerun, rerunBusy, onRerun, onSnooze }: {
  item: AttentionItem
  canRerun: boolean
  rerunBusy: boolean
  onRerun: () => void
  onSnooze: () => void
}) {
  return (
    <div className="hs-modal-footer">
      {canRerun && (
        <button className="hs-modal-btn" onClick={onRerun} disabled={rerunBusy} title="Re-run failing jobs in the relevant workflow runs">
          {rerunBusy ? 'Requesting…' : '↻ Re-run failing'}
        </button>
      )}
      <button className="hs-modal-btn" onClick={onSnooze} title="Hide until tomorrow (s)">
        Snooze <kbd>s</kbd>
      </button>
      <a className="hs-modal-btn link" href={item.url} target="_blank" rel="noopener noreferrer">
        Open on GitHub ↗
      </a>
    </div>
  )
}
