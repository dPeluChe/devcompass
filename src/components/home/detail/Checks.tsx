import { useMemo, useState } from 'react'
import {
  fetchJobLogs,
  fetchWorkflowRunJobs,
  type CheckContext,
  type PRDetail,
  type WorkflowJob
} from '../../../api/github'

const MAX_LOG_LINES = 500

export type MergeStatus = { kind: 'ok' | 'fail' | 'pending'; title: string; detail?: string }

export type CheckRow = {
  name: string
  workflow?: string
  state: 'ok' | 'fail' | 'pending' | 'neutral' | 'skipped'
  detailLabel: string
  detailUrl: string | null
  /** Workflow run id — only for CheckRun-from-Actions; lets us match the job and fetch the log. */
  workflowRunId?: number
}

export function normalizeCheck(c: CheckContext): CheckRow {
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

export function checkIcon(state: CheckRow['state']): string {
  if (state === 'ok') return '✓'
  if (state === 'fail') return '✕'
  if (state === 'pending') return '⋯'
  if (state === 'skipped') return '⊘'
  return '○'
}

/**
 * Folds the GraphQL checks array into an "all checks passed" / "N failing" /
 * "N running" line. Used in two places: the Merge column inside SummaryTab
 * and the in-modal merge-readiness banner.
 */
export function mergeChecksLine(d: PRDetail): MergeStatus {
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

export function Skeleton({ lines = 1, width = '100%' }: { lines?: number; width?: string }) {
  return (
    <div className="hs-skeleton-block" style={{ padding: 0 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="hs-skeleton-bar" style={{ width: i === lines - 1 ? '70%' : width }} />
      ))}
    </div>
  )
}

export function ChecksList({ token, owner, repo, checks }: { token: string; owner: string; repo: string; checks: CheckContext[] }) {
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
