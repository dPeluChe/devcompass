import { useEffect, useState } from 'react'
import { fetchPullRequestDetail, type CheckContext, type FileChange, type PRDetail as PRDetailT } from '../api/github'
import { SanitizedMarkdown } from './SanitizedMarkdown'

type Props = { token: string; owner: string; name: string; number: number }

export function PRDetail({ token, owner, name, number }: Props) {
  const [data, setData] = useState<PRDetailT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'conversation' | 'files' | 'checks'>('conversation')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    setTab('conversation')
    ;(async () => {
      try {
        const d = await fetchPullRequestDetail(token, owner, name, number)
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, owner, name, number])

  if (error) return <div className="pr-detail"><pre className="error-inline">{error}</pre></div>
  if (!data) return <div className="pr-detail"><p className="muted">Loading PR…</p></div>

  const timeline = buildTimeline(data)

  return (
    <div className="pr-detail">
      <header className="pr-detail-header">
        <div className="pr-detail-meta muted">
          <a href={data.repository.url} target="_blank" rel="noreferrer">{data.repository.nameWithOwner}</a>
          <span>·</span>
          <span>#{data.number}</span>
          <span>·</span>
          <span className={`state-pill state-${data.state.toLowerCase()}`}>{data.state}</span>
          {data.isDraft && <span className="badge">draft</span>}
        </div>
        <h1 className="pr-detail-title">
          <a href={data.url} target="_blank" rel="noreferrer">{data.title}</a>
        </h1>
        <div className="pr-detail-sub muted">
          {data.author && (
            <span>
              <img src={data.author.avatarUrl} alt="" width={16} height={16} className="avatar-xs" /> {data.author.login}
            </span>
          )}
          <span>wants to merge</span>
          <code>{data.headRefName}</code>
          <span>→</span>
          <code>{data.baseRefName}</code>
          <span>·</span>
          <span><span className="add">+{data.additions}</span> <span className="del">−{data.deletions}</span> in {data.changedFiles} files</span>
        </div>
        <MergeBanner detail={data} />
      </header>

      {data.labels.nodes.length > 0 && (
        <div className="pr-detail-labels">
          {data.labels.nodes.map((l) => (
            <span key={l.name} className="label" style={{ background: `#${l.color}33`, borderColor: `#${l.color}` }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      <div className="pr-detail-tabs">
        <button className={`tab ${tab === 'conversation' ? 'active' : ''}`} onClick={() => setTab('conversation')}>
          Conversation ({data.reviews.nodes.length + data.comments.nodes.length})
        </button>
        <button className={`tab ${tab === 'files' ? 'active' : ''}`} onClick={() => setTab('files')}>
          Files ({data.files.nodes.length})
        </button>
        <button className={`tab ${tab === 'checks' ? 'active' : ''}`} onClick={() => setTab('checks')}>
          Checks ({data.checks.length})
        </button>
      </div>

      {tab === 'conversation' && (
        <div className="pr-conv">
          {data.bodyHTML && (
            <article className="comment-card">
              <header className="muted">
                {data.author && (
                  <span>
                    <img src={data.author.avatarUrl} alt="" width={20} height={20} className="avatar-xs" /> <strong>{data.author.login}</strong>
                  </span>
                )}
                <span>·</span>
                <span title={data.createdAt}>description · {fmt(data.createdAt)}</span>
              </header>
              <SanitizedMarkdown html={data.bodyHTML} />
            </article>
          )}
          {timeline.map((item) => (
            <TimelineItem key={timelineKey(item)} item={item} />
          ))}
          {timeline.length === 0 && !data.bodyHTML && <p className="muted">No activity yet.</p>}

          {data.reviewRequests.nodes.length > 0 && (
            <div className="reviewers-pending">
              <strong className="muted">Waiting for review from:</strong>
              {data.reviewRequests.nodes.map((r) => {
                const rev = r.requestedReviewer
                if (!rev) return null
                const label = rev.__typename === 'User' ? rev.login : rev.name
                return (
                  <span key={label} className="reviewer-chip">
                    <img src={rev.avatarUrl} alt="" width={16} height={16} className="avatar-xs" />
                    {label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'files' && (
        <ul className="files-list">
          {data.files.nodes.map((f) => (
            <li key={f.path}>
              <span className={`change-type ct-${f.changeType.toLowerCase()}`}>{changeIcon(f.changeType)}</span>
              <a href={`${data.url}/files`} target="_blank" rel="noreferrer">{f.path}</a>
              <span className="diff">
                <span className="add">+{f.additions}</span>
                <span className="del">−{f.deletions}</span>
              </span>
            </li>
          ))}
          {data.files.nodes.length === 0 && <li className="muted">No files changed.</li>}
        </ul>
      )}

      {tab === 'checks' && (
        <ul className="checks-list">
          {data.checks.map((c) => (
            <CheckRow key={c.__typename === 'CheckRun' ? c.name : c.context} check={c} />
          ))}
          {data.checks.length === 0 && <li className="muted">Este PR no tiene checks configurados.</li>}
        </ul>
      )}
    </div>
  )
}

function MergeBanner({ detail }: { detail: PRDetailT }) {
  if (detail.state === 'MERGED') {
    return <div className="merge-banner ok">✓ This PR has been merged.</div>
  }
  if (detail.state === 'CLOSED') {
    return <div className="merge-banner danger">✕ Closed without merging.</div>
  }
  if (detail.mergeable === 'CONFLICTING') {
    return <div className="merge-banner danger">⚠ Has conflicts. Must resolve before merge.</div>
  }
  if (detail.mergeStateStatus === 'BLOCKED') {
    return <div className="merge-banner warn">🔒 Merge blocked (missing reviews or required checks).</div>
  }
  if (detail.mergeStateStatus === 'BEHIND') {
    return <div className="merge-banner warn">↓ Branch behind base. Must update.</div>
  }
  if (detail.mergeStateStatus === 'CLEAN') {
    return <div className="merge-banner ok">✓ Ready to merge.</div>
  }
  return null
}

type TLItem =
  | { kind: 'review'; review: PRDetailT['reviews']['nodes'][number]; date: string }
  | { kind: 'comment'; comment: PRDetailT['comments']['nodes'][number]; date: string }

function buildTimeline(d: PRDetailT): TLItem[] {
  const items: TLItem[] = []
  for (const r of d.reviews.nodes) items.push({ kind: 'review', review: r, date: r.submittedAt ?? '' })
  for (const c of d.comments.nodes) items.push({ kind: 'comment', comment: c, date: c.createdAt })
  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function timelineKey(item: TLItem): string {
  const author = item.kind === 'review' ? item.review.author?.login : item.comment.author?.login
  return `${item.kind}:${item.date}:${author ?? '?'}`
}

function TimelineItem({ item }: { item: TLItem }) {
  if (item.kind === 'review') {
    const r = item.review
    if (!r.bodyHTML && r.state === 'COMMENTED') return null
    return (
      <article className={`comment-card review-${r.state.toLowerCase()}`}>
        <header className="muted">
          {r.author && (
            <span>
              <img src={r.author.avatarUrl} alt="" width={20} height={20} className="avatar-xs" /> <strong>{r.author.login}</strong>
            </span>
          )}
          <span>·</span>
          <span className={`review-state state-${r.state.toLowerCase()}`}>{reviewLabel(r.state)}</span>
          <span>·</span>
          <span>{fmt(r.submittedAt ?? '')}</span>
        </header>
        {r.bodyHTML && <SanitizedMarkdown html={r.bodyHTML} />}
      </article>
    )
  }
  const c = item.comment
  return (
    <article className="comment-card">
      <header className="muted">
        {c.author && (
          <span>
            <img src={c.author.avatarUrl} alt="" width={20} height={20} className="avatar-xs" /> <strong>{c.author.login}</strong>
          </span>
        )}
        <span>·</span>
        <span>{fmt(c.createdAt)}</span>
      </header>
      <SanitizedMarkdown html={c.bodyHTML} />
    </article>
  )
}

function CheckRow({ check }: { check: CheckContext }) {
  if (check.__typename === 'CheckRun') {
    const concl = check.conclusion ?? check.status
    return (
      <li>
        <span className={`check-icon ci-${concl.toLowerCase()}`}>{checkIcon(concl)}</span>
        <span className="check-name">
          {check.checkSuite?.workflowRun?.workflow.name ? `${check.checkSuite.workflowRun.workflow.name} / ` : ''}{check.name}
        </span>
        <span className={`check-state ci-${concl.toLowerCase()}`}>{concl}</span>
        {check.detailsUrl && (
          <a href={check.detailsUrl} target="_blank" rel="noreferrer" className="muted">logs ↗</a>
        )}
      </li>
    )
  }
  return (
    <li>
      <span className={`check-icon ci-${check.state.toLowerCase()}`}>{checkIcon(check.state)}</span>
      <span className="check-name">{check.context}</span>
      <span className={`check-state ci-${check.state.toLowerCase()}`}>{check.state}</span>
      {check.targetUrl && <a href={check.targetUrl} target="_blank" rel="noreferrer" className="muted">link ↗</a>}
    </li>
  )
}

function changeIcon(t: FileChange['changeType']): string {
  return { ADDED: '+', MODIFIED: '~', DELETED: '−', RENAMED: '→', COPIED: '⎘', CHANGED: '~' }[t]
}

function checkIcon(s: string): string {
  const u = s.toUpperCase()
  if (u === 'SUCCESS' || u === 'COMPLETED' || u === 'NEUTRAL') return '✓'
  if (u === 'FAILURE' || u === 'ERROR' || u === 'TIMED_OUT' || u === 'CANCELLED') return '✕'
  if (u === 'PENDING' || u === 'IN_PROGRESS' || u === 'QUEUED' || u === 'EXPECTED') return '⋯'
  if (u === 'SKIPPED') return '⊘'
  return '○'
}

function reviewLabel(s: string): string {
  return { APPROVED: '✓ aprobó', CHANGES_REQUESTED: '⚠ pidió cambios', COMMENTED: 'comentó', DISMISSED: 'dismissed', PENDING: 'pendiente' }[s] ?? s
}

function fmt(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}
