import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { extractEventContext, extractExceptions, fetchSentryLatestEvent, fetchSentrySuspectCommits, updateSentryIssueStatus, type SentryIssue } from '../../api/sentry'
import { fetchVercelDeployments, matchReleaseToDeploy, prNumberFromDeploy } from '../../api/vercel'
import { sentryConfigStore } from '../../store/sentryConfig'
import { vercelConfigStore, vercelAuthFor } from '../../store/vercelConfig'
import { clearPrefsByPrefix } from '../../store/db'
import { relativeTime } from '../../utils/time'
import { buildSentryAgentText } from '../../utils/agentPrompt'
import { CopyButton } from '../CopyButton'
import { LEVEL_COLOR } from './SentryIssueList'

/** In-app detail for a Sentry issue: summary + latest event's stacktrace + tags. */
export function SentryIssueModal({ issue, token, onClose }: { issue: SentryIssue | null; token: string; onClose: () => void }) {
  const open = !!issue

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  const eventQuery = useQuery({
    queryKey: ['sentry', 'event', issue?.id],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await fetchSentryLatestEvent(sentryConfigStore.getState().getAuth(), issue!.id)).data,
  })

  // Suspect commits: only when a real connector is configured; returns [] (no
  // throw) until the Sentry-side GitHub integration + commit tracking is set up.
  const suspectQuery = useQuery({
    queryKey: ['sentry', 'committers', issue?.id],
    enabled: open && sentryConfigStore.getState().isConfigured(),
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: () => fetchSentrySuspectCommits(sentryConfigStore.getState().getAuth(), issue!.id),
  })

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mutateError, setMutateError] = useState<string | null>(null)
  const statusMutation = useMutation({
    mutationFn: async (status: 'resolved' | 'ignored') => {
      const cfg = sentryConfigStore.getState()
      await updateSentryIssueStatus(cfg.getAuth(), cfg.orgSlug.trim(), issue!.id, status)
    },
    onSuccess: async () => {
      // Drop the IDB-backed issue lists too — invalidation alone would re-read
      // the still-fresh pref and resurrect the resolved issue.
      await clearPrefsByPrefix('sentryIssues:')
      queryClient.invalidateQueries({ queryKey: ['sentry'] })
      onClose()
    },
    onError: (e) => setMutateError(e instanceof Error ? e.message : String(e)),
  })

  // Release health: correlate this issue's release sha to a Vercel deploy of the
  // same repo → "shipped in deploy X (PR #N)".
  const mappedRepo = issue ? (sentryConfigStore.getState().projectRepoMap[issue.project.slug] ?? null) : null
  const vercelProject = mappedRepo ? vercelConfigStore.getState().projectForRepo(mappedRepo) : null
  const deployQuery = useQuery({
    queryKey: ['vercel', 'release-deploys', vercelProject?.id, mappedRepo],
    enabled: open && !!vercelProject,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchVercelDeployments(vercelAuthFor(token), { projectId: vercelProject!.id, repo: mappedRepo! }),
  })

  if (!issue) return null
  const exceptions = extractExceptions(eventQuery.data)
  const eventCtx = extractEventContext(eventQuery.data, exceptions)
  const suspects = suspectQuery.data ?? []
  const cfgState = sentryConfigStore.getState()
  const repo = cfgState.projectRepoMap[issue.project.slug] ?? null
  // Mutations need a real connector (demo rows have none) + event:write.
  const canMutate = cfgState.isConfigured()

  const shippedDeploy = matchReleaseToDeploy(eventCtx.release, deployQuery.data ?? [])
  const shippedPr = shippedDeploy ? prNumberFromDeploy(shippedDeploy) : null

  return (
    <div className="issue-modal-shell">
      <div
        className="issue-modal-backdrop"
        role="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      />
      <div className="issue-modal" role="dialog" aria-modal="true">
        <header className="issue-modal-head">
          <span className="connector-issue-level" style={{ background: LEVEL_COLOR[issue.level] ?? '#888' }}>{issue.level}</span>
          <h2 className="issue-modal-title">{issue.title}</h2>
          <button className="issue-modal-close" onClick={onClose} title="Close (esc)">×</button>
        </header>

        <div className="issue-modal-meta muted">
          <code>{issue.shortId}</code> · {issue.project.slug} · {issue.status} · {issue.count} events · {issue.userCount} users
          · first seen {relativeTime(issue.firstSeen)} · last {relativeTime(issue.lastSeen)}
        </div>

        {(() => {
          const unhandled = issue.isUnhandled ?? (eventCtx.handled == null ? null : !eventCtx.handled)
          const show = eventCtx.environment || unhandled !== null || eventCtx.release || eventCtx.client
          if (!show) return null
          return (
            <div className="issue-modal-tags">
              {eventCtx.environment && <span className="issue-tag">env: {eventCtx.environment}</span>}
              {unhandled !== null && (
                <span className={`issue-tag ${unhandled ? 'crit' : ''}`}>{unhandled ? 'unhandled' : 'handled'}</span>
              )}
              {issue.priority && <span className="issue-tag">priority: {issue.priority}</span>}
              {eventCtx.release && <span className="issue-tag">release: {eventCtx.release}</span>}
              {eventCtx.client && <span className="issue-tag">{eventCtx.client}</span>}
            </div>
          )
        })()}

        {shippedDeploy && (
          <div className="issue-modal-release">
            ▲ Shipped in deploy{' '}
            <a href={shippedDeploy.inspectorUrl ?? '#'} target="_blank" rel="noopener noreferrer">
              {shippedDeploy.meta?.githubCommitSha?.slice(0, 7)}
            </a>
            {shippedDeploy.meta?.githubCommitRef ? ` · ${shippedDeploy.meta.githubCommitRef}` : ''}
            {shippedPr && mappedRepo && (
              <> · <a href={`https://github.com/${mappedRepo}/pull/${shippedPr}`} target="_blank" rel="noopener noreferrer">PR #{shippedPr}</a></>
            )}
            <span className="muted"> — likely where this regression came from.</span>
          </div>
        )}

        {eventCtx.processingErrors.length > 0 && (
          <div className="issue-modal-warn">
            ⚠ Sentry couldn't fully process this event (frames may be minified — upload source maps):
            <ul>{eventCtx.processingErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <div className="issue-modal-actions">
          <CopyButton getText={() => buildSentryAgentText(issue, exceptions, repo, eventCtx, eventQuery.data, suspects)} />
          {repo && (
            <button
              className="hs-modal-btn"
              title={`Open ${repo} in devcompass`}
              onClick={() => { onClose(); navigate(`/repos/${repo}`) }}
            >⊞ View repo</button>
          )}
          {canMutate && (
            <>
              <button className="hs-modal-btn ok" onClick={() => statusMutation.mutate('resolved')} disabled={statusMutation.isPending}>
                {statusMutation.isPending ? 'Saving…' : '✓ Resolve'}
              </button>
              <button className="hs-modal-btn" onClick={() => statusMutation.mutate('ignored')} disabled={statusMutation.isPending}>
                🔇 Ignore
              </button>
            </>
          )}
          <a className="hs-modal-btn link" href={issue.permalink} target="_blank" rel="noopener noreferrer">Open in Sentry ↗</a>
        </div>

        {mutateError && <div className="hs-status hs-status-err" style={{ whiteSpace: 'pre-line' }}>{mutateError}</div>}

        {suspects.length > 0 && (
          <div className="sentry-suspects">
            <span className="muted">Suspect commit{suspects.length > 1 ? 's' : ''}:</span>
            {suspects.map((c, i) => (
              <span key={i} className="sentry-suspect">
                <code>{c.shortSha}</code> {c.message}
                {c.author && <span className="muted"> — @{c.author}</span>}
                {c.prUrl && <a href={c.prUrl} target="_blank" rel="noopener noreferrer"> PR #{c.prNumber}</a>}
              </span>
            ))}
          </div>
        )}

        <div className="issue-modal-body">
          {eventQuery.isLoading && <p className="muted">Loading latest event…</p>}
          {eventQuery.error && <p className="muted">Couldn't load the event ({eventQuery.error instanceof Error ? eventQuery.error.message : String(eventQuery.error)}).</p>}
          {eventQuery.data && exceptions.length === 0 && <p className="muted">No stacktrace in the latest event.</p>}

          {exceptions.map((ex, i) => (
            <div key={i} className="sentry-exc">
              <div className="sentry-exc-head">
                <strong>{ex.type ?? 'Exception'}</strong>{ex.value ? `: ${ex.value}` : ''}
              </div>
              {ex.stacktrace?.frames && ex.stacktrace.frames.length > 0 && (
                <ul className="sentry-frames">
                  {[...ex.stacktrace.frames].reverse().slice(0, 12).map((f, j) => (
                    <li key={j} className={f.inApp ? 'in-app' : ''}>
                      <code>{f.filename || f.module || '?'}</code>
                      {f.function ? <span className="sentry-frame-fn"> in {f.function}</span> : null}
                      {f.lineNo != null ? <span className="muted">:{f.lineNo}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {eventQuery.data?.tags && eventQuery.data.tags.length > 0 && (
            <div className="sentry-tags">
              {eventQuery.data.tags.slice(0, 14).map((t) => (
                <span key={t.key} className="sentry-tag"><span className="muted">{t.key}</span> {t.value}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
