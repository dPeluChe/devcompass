import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { extractExceptions, fetchSentryLatestEvent, type SentryIssue } from '../../api/sentry'
import { sentryConfigStore } from '../../store/sentryConfig'
import { relativeTime } from '../../utils/time'
import { buildSentryAgentText } from '../../utils/agentPrompt'
import { CopyButton } from '../CopyButton'
import { LEVEL_COLOR } from './SentryIssueList'

/** In-app detail for a Sentry issue: summary + latest event's stacktrace + tags. */
export function SentryIssueModal({ issue, onClose }: { issue: SentryIssue | null; onClose: () => void }) {
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

  if (!issue) return null
  const exceptions = extractExceptions(eventQuery.data)
  const repo = sentryConfigStore.getState().projectRepoMap[issue.project.slug] ?? null

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

        <div className="issue-modal-actions">
          <CopyButton getText={() => buildSentryAgentText(issue, exceptions, repo)} />
          <a className="hs-modal-btn link" href={issue.permalink} target="_blank" rel="noopener noreferrer">Open in Sentry ↗</a>
        </div>

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
