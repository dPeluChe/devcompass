import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchIssueDetail } from '../../api/github'
import { relativeTime } from '../../utils/time'
import { buildGithubIssueAgentText } from '../../utils/agentPrompt'
import { SanitizedMarkdown } from '../SanitizedMarkdown'
import { CopyButton } from '../CopyButton'

export type GitHubIssueRef = { token: string; owner: string; name: string; number: number }

/** In-app detail for a GitHub issue: body + labels + assignees, with copy-for-agent. */
export function GitHubIssueModal({ issue, onClose }: { issue: GitHubIssueRef | null; onClose: () => void }) {
  const open = !!issue

  useEffect(() => {
    if (!open) return
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

  if (!issue) return null
  const detail = detailQuery.data

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
          <span className="connector-issue-level" style={{ background: '#3fb950' }}>issue</span>
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
          <a className="hs-modal-btn link" href={detail?.url ?? `https://github.com/${issue.owner}/${issue.name}/issues/${issue.number}`} target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a>
        </div>

        <div className="issue-modal-body">
          {detailQuery.isLoading && <p className="muted">Loading issue…</p>}
          {detailQuery.error && <p className="muted">Couldn't load the issue ({detailQuery.error instanceof Error ? detailQuery.error.message : String(detailQuery.error)}).</p>}
          {!detailQuery.isLoading && !detailQuery.error && detail === null && <p className="muted">Issue not found, or you don't have access.</p>}
          {detail && (detail.bodyHTML
            ? <div className="hs-description-html"><SanitizedMarkdown html={detail.bodyHTML} /></div>
            : <p className="muted">No description provided.</p>)}
        </div>
      </div>
    </div>
  )
}
