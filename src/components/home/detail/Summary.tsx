import { useMemo } from 'react'
import type { PRDetail } from '../../../api/github'
import { mergeChecksLine } from './Checks'
import { buildConversation } from './Conversation'
import { relativeTime, reviewStateClass, reviewStateLabel } from './utils'

export type ReviewerEntry = {
  login: string
  avatarUrl: string
  state: 'approved' | 'changes' | 'requested' | 'commented' | 'team'
}

export function buildReviewers(detail: PRDetail): ReviewerEntry[] {
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

export function reviewerStateLabel(s: ReviewerEntry['state']): string {
  if (s === 'approved') return 'approved'
  if (s === 'changes') return 'changes'
  if (s === 'requested') return 'requested'
  if (s === 'commented') return 'commented'
  return 'team'
}

type Props = {
  detail: PRDetail
  onReadFull: () => void
  onOpenCommits: () => void
  onOpenChecks: () => void
  onOpenComments: () => void
}

export function SummaryTab({ detail, onReadFull, onOpenCommits, onOpenChecks, onOpenComments }: Props) {
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
                  <span className={`hs-conv-state ${reviewStateClass(latest.state)}`}>{reviewStateLabel(latest.state)}</span>
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
