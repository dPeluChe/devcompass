import { useMemo } from 'react'
import type { PRCommit, PRDetail } from '../../api/github'
import { relativeTime } from './detail/utils'

export function FilesList({ nodes, total }: { nodes: PRDetail['files']['nodes']; total: number }) {
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

export function CommitsList({ nodes, totalCount }: { nodes: PRCommit[]; totalCount: number }) {
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
