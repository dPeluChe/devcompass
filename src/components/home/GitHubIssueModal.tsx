import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addIssueComment, fetchIssueDetail, setIssueState } from '../../api/github'
import { relativeTime } from '../../utils/time'
import { buildGithubIssueAgentText } from '../../utils/agentPrompt'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import { CopyButton } from '../CopyButton'

export type GitHubIssueRef = { token: string; owner: string; name: string; number: number }

type StatusMsg = { kind: 'ok' | 'err'; text: string } | null

/** In-app detail for a GitHub issue: body + labels, with comment / close / copy-for-agent. */
export function GitHubIssueModal({ issue, onClose }: { issue: GitHubIssueRef | null; onClose: () => void }) {
  const open = !!issue
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<StatusMsg>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!open) return
    setBody('')
    setStatus(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  const detailQuery = useQuery({
    queryKey: ['github', 'issue', issue?.owner, issue?.name, issue?.number],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchIssueDetail(issue!.token, issue!.owner, issue!.name, issue!.number),
  })

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['github', 'issue', issue?.owner, issue?.name, issue?.number] })
    queryClient.invalidateQueries({ queryKey: ['issues', 'search'] })
  }

  const commentMutation = useMutation({
    mutationFn: (text: string) => addIssueComment(issue!.token, issue!.owner, issue!.name, issue!.number, text),
    onSuccess: () => {
      setBody('')
      setStatus({ kind: 'ok', text: 'Comment posted' })
      refresh()
    },
    onError: (e) => setStatus({ kind: 'err', text: e instanceof Error ? e.message : String(e) }),
  })
  const stateMutation = useMutation({
    mutationFn: (state: 'closed' | 'open') => setIssueState(issue!.token, issue!.owner, issue!.name, issue!.number, state),
    onSuccess: (_d, state) => {
      setStatus({ kind: 'ok', text: state === 'closed' ? 'Issue closed' : 'Issue reopened' })
      refresh()
    },
    onError: (e) => setStatus({ kind: 'err', text: e instanceof Error ? e.message : String(e) }),
  })

  if (!issue) return null
  const detail = detailQuery.data
  const busy = commentMutation.isPending || stateMutation.isPending

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
          <span className="connector-issue-level" style={{ background: detail?.state === 'CLOSED' ? '#8d5494' : '#3fb950' }}>
            {detail?.state === 'CLOSED' ? 'closed' : 'issue'}
          </span>
          <h2 className="issue-modal-title">{detail?.title ?? `${issue.owner}/${issue.name}#${issue.number}`}</h2>
          <button className="issue-modal-close" onClick={onClose} title="Close (esc)">×</button>
        </header>

        <div className="issue-modal-meta muted">
          <code>{issue.owner}/{issue.name}#{issue.number}</code>
          {detail && <> · {detail.state.toLowerCase()} · {detail.comments.totalCount} comments · opened {relativeTime(detail.createdAt)}{detail.author ? ` by @${detail.author.login}` : ''}</>}
        </div>

        {detail && detail.labels.nodes.length > 0 && (
          <div className="issue-modal-labels">
            {detail.labels.nodes.map((l) => (
              <span key={l.name} className="issue-modal-label" style={{ borderColor: `#${l.color}` }}>{l.name}</span>
            ))}
          </div>
        )}

        <div className="issue-modal-actions">
          {detail && <CopyButton getText={() => buildGithubIssueAgentText(detail)} />}
          {detail && detail.state === 'OPEN' && (
            <button className="hs-modal-btn danger" onClick={() => stateMutation.mutate('closed')} disabled={busy}>
              {stateMutation.isPending ? 'Closing…' : '✕ Close issue'}
            </button>
          )}
          {detail && detail.state === 'CLOSED' && (
            <button className="hs-modal-btn ok" onClick={() => stateMutation.mutate('open')} disabled={busy}>
              {stateMutation.isPending ? 'Reopening…' : '↻ Reopen'}
            </button>
          )}
          <a className="hs-modal-btn link" href={detail?.url ?? `https://github.com/${issue.owner}/${issue.name}/issues/${issue.number}`} target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>
        </div>

        {status && (
          <div className={`hs-status ${status.kind === 'err' ? 'hs-status-err' : 'hs-status-ok'}`} style={{ whiteSpace: 'pre-line' }}>
            {status.text}
          </div>
        )}

        <div className="issue-modal-body">
          {detailQuery.isLoading && <p className="muted">Loading issue…</p>}
          {detailQuery.error && <p className="muted">Couldn't load the issue ({detailQuery.error instanceof Error ? detailQuery.error.message : String(detailQuery.error)}).</p>}
          {!detailQuery.isLoading && !detailQuery.error && detail === null && <p className="muted">Issue not found, or you don't have access.</p>}
          {detail && (detail.bodyHTML
            ? <div className="hs-description-html"><SanitizedMarkdown html={detail.bodyHTML} /></div>
            : <p className="muted">No description provided.</p>)}

          {detail && (
            <section className="hs-composer">
              <h4>Add a comment</h4>
              <textarea
                className="hs-composer-textarea"
                placeholder="Markdown supported. ⌘↵ to submit."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && body.trim()) {
                    e.preventDefault()
                    commentMutation.mutate(body.trim())
                  }
                }}
                disabled={busy}
              />
              <div className="hs-composer-actions">
                <button
                  className="hs-modal-btn primary"
                  onClick={() => commentMutation.mutate(body.trim())}
                  disabled={busy || !body.trim()}
                  title="Comment (⌘↵)"
                >
                  {commentMutation.isPending ? 'Posting…' : '💬 Comment'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
