import { useState } from 'react'
import { MdRefresh } from 'react-icons/md'
import { OrgChip } from '../OrgChip'
import { EmptyState } from '../EmptyState'
import { useSinceLastVisit, type SinceEvent, type SinceEventKind } from '../useSinceLastVisit'
import { useFlash } from '../../../hooks/useFlash'
import type { AttentionItem } from '../types'
import { relativeTime } from '../../../utils/time'
import { type ScopeProps } from './common'

const KIND_CHIPS: { kind: SinceEventKind; label: string }[] = [
  { kind: 'new-pr', label: 'new PRs' },
  { kind: 'ci-changed', label: 'CI changed' },
  { kind: 'merged-or-closed', label: 'closed · merged' },
  { kind: 'commits', label: 'commits' },
]

/** "Today" / "Yesterday" / a readable date — calendar-day bucket for a timestamp. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function SinceScope({ repos, onOpenItem, onOpenRepo }: ScopeProps) {
  const { events, isFirstRun, snapshot, markSeen } = useSinceLastVisit(repos)
  const [seen, flashSeen] = useFlash(1500)
  const [kindFilter, setKindFilter] = useState<'all' | SinceEventKind>('all')
  const showEvents = !seen ? events : []

  // Plain derivations (no useMemo): `events` is itself recomputed per render by
  // useSinceLastVisit, so memoizing on it would never hit.
  const counts = new Map<SinceEventKind, number>()
  for (const ev of showEvents) counts.set(ev.kind, (counts.get(ev.kind) ?? 0) + 1)

  const filtered = kindFilter === 'all' ? showEvents : showEvents.filter((ev) => ev.kind === kindFilter)

  // Events arrive sorted desc — bucket them by calendar day, insertion order
  // preserves the chronology.
  const dayGroups = new Map<string, SinceEvent[]>()
  for (const ev of filtered) {
    const label = dayLabel(ev.time)
    const list = dayGroups.get(label)
    if (list) list.push(ev)
    else dayGroups.set(label, [ev])
  }

  async function handleMarkSeen() {
    await markSeen()
    flashSeen()
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
            snapshot ? `Snapshot from ${relativeTime(new Date(snapshot.takenAt).toISOString(), false)} ago` : '—'}
        </span>
        <button className="hs-mark-seen" onClick={handleMarkSeen}>
          {seen ? '✓ Saved' : 'Mark as seen'}
        </button>
      </div>

      {showEvents.length > 0 && (
        <div className="hs-issue-filters">
          <button className={kindFilter === 'all' ? 'active' : ''} onClick={() => setKindFilter('all')}>
            All <span className="muted">{showEvents.length}</span>
          </button>
          {KIND_CHIPS.filter((c) => (counts.get(c.kind) ?? 0) > 0).map((c) => (
            <button key={c.kind} className={kindFilter === c.kind ? 'active' : ''} onClick={() => setKindFilter(c.kind)}>
              {c.label} <span className="muted">{counts.get(c.kind)}</span>
            </button>
          ))}
        </div>
      )}

      {isFirstRun ? (
        <EmptyState
          icon={<MdRefresh size={48} />}
          title="No baseline yet."
          description="Click Mark as seen to start tracking changes. Next time you load the app we'll show what changed: new PRs, CI flips, merges, and pushes to default branches across your repos."
        />
      ) : showEvents.length === 0 ? (
        <EmptyState
          icon={<MdRefresh size={48} />}
          title="Nothing changed since you last looked."
          description={snapshot ? `You were last here ${relativeTime(new Date(snapshot.takenAt).toISOString(), false)} ago.` : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No events of this kind." description="Try switching to All." />
      ) : (
        [...dayGroups.entries()].map(([label, list]) => (
          <section key={label} className="hs-issue-group">
            <h3 className="hs-issue-group-head"><span className="hs-day-label">{label}</span><span className="muted"> · {list.length}</span></h3>
            <div className="hs-surface">
              {list.map((ev) => (
                <SinceRow key={ev.key} event={ev} onClick={() => handleEvent(ev)} />
              ))}
            </div>
          </section>
        ))
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
          <span className="hs-row-time">{relativeTime(event.time, false)}</span>
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
