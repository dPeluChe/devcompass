import { useState } from 'react'
import { OrgChip } from '../OrgChip'
import { useSinceLastVisit, type SinceEvent } from '../useSinceLastVisit'
import type { AttentionItem } from '../types'
import { shortAgo, type ScopeProps } from './common'

export function SinceScope({ repos, onOpenItem, onOpenRepo }: ScopeProps) {
  const { events, isFirstRun, snapshot, markSeen } = useSinceLastVisit(repos)
  const [seen, setSeen] = useState(false)
  const showEvents = !seen ? events : []

  async function handleMarkSeen() {
    await markSeen()
    setSeen(true)
    setTimeout(() => setSeen(false), 1500)
  }

  function handleEvent(ev: SinceEvent) {
    if (ev.kind === 'commits') {
      const r = repos.find((rr) => rr.nameWithOwner === ev.nameWithOwner)
      if (r) onOpenRepo(r)
      return
    }
    const item = buildItemFromEvent(ev)
    if (item) onOpenItem(item)
  }

  return (
    <main className="hs-main">
      <div className="hs-main-head">
        <h1>Since last visit</h1>
        <span className="hs-h-count">{showEvents.length}</span>
        <span className="hs-h-meta">
          {isFirstRun ? 'No baseline yet' :
            snapshot ? `Snapshot from ${shortAgo(new Date(snapshot.takenAt).toISOString())} ago` : '—'}
        </span>
        <button className="hs-mark-seen" onClick={handleMarkSeen}>
          {seen ? '✓ Saved' : 'Mark as seen'}
        </button>
      </div>

      {isFirstRun ? (
        <div className="hs-empty">
          <strong>No baseline yet.</strong>
          Click <em>Mark as seen</em> to start tracking changes. Next time you load the app
          we'll show what changed since now: new PRs, CI flips, merges, and pushes to
          default branches across your repos.
        </div>
      ) : showEvents.length === 0 ? (
        <div className="hs-empty">
          <strong>Nothing changed since you last looked.</strong>
          {snapshot && <span>You were last here {shortAgo(new Date(snapshot.takenAt).toISOString())} ago.</span>}
        </div>
      ) : (
        <section className="hs-surface">
          {showEvents.map((ev) => (
            <SinceRow key={ev.key} event={ev} onClick={() => handleEvent(ev)} />
          ))}
        </section>
      )}
    </main>
  )
}

function SinceRow({ event, onClick }: { event: SinceEvent; onClick: () => void }) {
  return (
    <div className="hs-row" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}>
      <span className={`hs-dot ${event.dot}`} />
      <div className="hs-row-main">
        <div className="hs-row-title">
          <OrgChip login={event.org} avatarUrl={event.orgAvatarUrl} />
          <span className="hs-org-name">{event.org}</span>
          <span className="hs-sep">/</span>
          <span className="hs-repo-name">{event.repo}</span>
          {event.prNumber && <span className="hs-pr-num">#{event.prNumber}</span>}
          <span className="hs-pr-title">{eventHeadline(event)}</span>
        </div>
        <div className="hs-row-meta">
          <span className={`hs-since-kind k-${event.kind}`}>{kindLabel(event.kind)}</span>
          <span className="hs-row-time">{shortAgo(event.time)}</span>
        </div>
      </div>
    </div>
  )
}

function eventHeadline(ev: SinceEvent): string {
  if (ev.kind === 'commits') return `New commits on default branch`
  if (ev.kind === 'merged-or-closed') return 'PR closed or merged'
  if (ev.kind === 'ci-changed') return ev.dot === 'critical'
    ? `CI started failing — ${ev.prTitle ?? ''}`
    : `CI recovered — ${ev.prTitle ?? ''}`
  if (ev.kind === 'new-pr') return ev.prTitle ?? 'New PR'
  return ev.text
}

function kindLabel(k: SinceEvent['kind']): string {
  if (k === 'new-pr') return 'new PR'
  if (k === 'ci-changed') return 'CI changed'
  if (k === 'merged-or-closed') return 'closed/merged'
  if (k === 'commits') return 'commits'
  return k
}

function buildItemFromEvent(ev: SinceEvent): AttentionItem | null {
  if (!ev.prId || !ev.prNumber || !ev.prTitle || !ev.prUrl) return null
  const reasons: AttentionItem['reasons'] = []
  if (ev.kind === 'new-pr') reasons.push('new-pr')
  if (ev.kind === 'ci-changed' && ev.dot === 'critical') reasons.push('ci-failing')
  if (ev.kind === 'merged-or-closed') reasons.push('merged')
  return {
    id: ev.prId,
    org: ev.org,
    orgAvatarUrl: ev.orgAvatarUrl,
    repo: ev.repo,
    nameWithOwner: ev.nameWithOwner,
    number: ev.prNumber,
    title: ev.prTitle,
    url: ev.prUrl,
    isDraft: false,
    updatedAt: ev.time,
    ciState: ev.prCiState ?? null,
    reviewDecision: null,
    author: null,
    reasons,
    dot: ev.dot
  }
}
