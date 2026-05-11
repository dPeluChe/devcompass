import { useMemo, useState } from 'react'
import type { Repo, RepoOpenPR, Viewer } from '../../api/github'
import type { PinnedRepo } from '../../store/db'
import { OrgChip } from './OrgChip'
import { AttentionRow } from './AttentionRow'
import { useNeedsMe } from './useNeedsMe'
import { useSinceLastVisit, type SinceEvent } from './useSinceLastVisit'
import type { AttentionItem, ScopeKey } from './types'
import { ownerAndName } from './types'

type Props = {
  scope: ScopeKey
  token: string
  viewer: Viewer | undefined
  repos: Repo[]
  pinned: PinnedRepo[]
  snoozes: Set<string>
  onOpenItem: (item: AttentionItem) => void
  onSnoozeItem: (item: AttentionItem) => void
  onOpenRepo: (repo: Repo) => void
  onGotoRepos: () => void
}

export function ScopeView(props: Props) {
  const { scope } = props
  if (scope === 'needs') return <NeedsScope {...props} />
  if (scope === 'since') return <SinceScope {...props} />
  if (scope === 'pinned') return <PinnedScope {...props} />
  if (scope === 'active') return <ActiveScope {...props} />
  return <PlaceholderScope scope={scope} onGotoRepos={props.onGotoRepos} />
}

/* ===================== Needs me ===================== */

function NeedsScope({ token, viewer, snoozes, onOpenItem, onSnoozeItem }: Props) {
  const { data, isLoading, error } = useNeedsMe(token, viewer?.login)
  const items = useMemo(
    () => (data ?? []).filter((i) => !snoozes.has(i.id)),
    [data, snoozes]
  )

  return (
    <main className="hs-main">
      <Header
        title="Needs me"
        count={items.length}
        meta="PRs awaiting your review · your PRs with failing CI · mentions"
      />

      {isLoading && (
        <section className="hs-surface">
          <div className="hs-skeleton-block">
            <div className="hs-skeleton-bar" style={{ width: '60%' }} />
            <div className="hs-skeleton-bar" style={{ width: '40%' }} />
            <div className="hs-skeleton-bar" style={{ width: '90%' }} />
            <div className="hs-skeleton-bar" style={{ width: '80%' }} />
          </div>
        </section>
      )}

      {error && (
        <div className="hs-empty" style={{ color: 'var(--danger)' }}>
          <strong>Failed to load.</strong>{error.message}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="hs-empty">
          <strong>Nothing needs you right now.</strong>
          When something comes up it shows here first.
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <section className="hs-surface">
          {items.map((item) => (
            <AttentionRow
              key={item.id}
              item={item}
              onOpen={() => onOpenItem(item)}
              onSnooze={() => onSnoozeItem(item)}
            />
          ))}
        </section>
      )}
    </main>
  )
}

/* ===================== Since last visit ===================== */

function SinceScope({ repos, onOpenItem, onOpenRepo }: Props) {
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

/* ===================== Pinned ===================== */

function PinnedScope({ repos, pinned, onOpenRepo }: Props) {
  const pinnedById = new Map(pinned.map((p) => [p.repoId, p]))
  const rows = repos
    .filter((r) => pinnedById.has(r.id))
    .sort((a, b) => (pinned.findIndex(p => p.repoId === a.id)) - (pinned.findIndex(p => p.repoId === b.id)))

  return (
    <main className="hs-main">
      <Header title="Pinned" count={rows.length} meta="Pinned systems with status & open PRs" />
      {rows.length === 0 ? (
        <div className="hs-empty">
          <strong>No pinned systems yet.</strong>
          Pin repos from the Repos tab to track them here.
        </div>
      ) : (
        <section className="hs-surface">
          {rows.map((r) => <CompactRow key={r.id} repo={r} onClick={() => onOpenRepo(r)} />)}
        </section>
      )}
    </main>
  )
}

/* ===================== Active 7d ===================== */

function ActiveScope({ repos, onOpenRepo }: Props) {
  const cutoff = Date.now() - 7 * 86_400_000
  const rows = repos
    .filter((r) => new Date(r.pushedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
    .slice(0, 50)

  return (
    <main className="hs-main">
      <Header title="Active 7d" count={rows.length} meta="Recently pushed across all enabled orgs" />
      {rows.length === 0 ? (
        <div className="hs-empty"><strong>Nothing pushed in the last 7 days.</strong></div>
      ) : (
        <section className="hs-surface">
          {rows.map((r) => <CompactRow key={r.id} repo={r} onClick={() => onOpenRepo(r)} />)}
        </section>
      )}
    </main>
  )
}

/* ===================== Placeholders ===================== */

function PlaceholderScope({ scope, onGotoRepos }: { scope: ScopeKey; onGotoRepos: () => void }) {
  const titles: Record<string, { title: string; meta: string; body: string }> = {
    since: { title: 'Since last visit', meta: 'Diff against your local snapshot', body: 'Coming in Phase 2 — diff against IndexedDB visit snapshot.' },
    watching: { title: 'Watching', meta: 'Active PRs that don\'t need action right now', body: 'Coming in Phase 2 — lower-urgency rows from the same searchPRs cohorts.' },
    repos: { title: 'All repos', meta: 'Full repo list. Cmd+K to jump.', body: 'Use the Repos tab in the topbar (or ⌘K).' },
    digest: { title: 'Operational digest', meta: 'Trends and counts', body: 'Coming in Phase 3 as a separate /insights route.' },
    rate: { title: 'Token & rate', meta: 'Token type, scopes, SSO, rate limit', body: 'Available today under Config → Token.' }
  }
  const t = titles[scope] ?? { title: scope, meta: '', body: 'Placeholder.' }
  return (
    <main className="hs-main">
      <Header title={t.title} count={undefined} meta={t.meta} />
      <div className="hs-empty">
        <strong>{t.title}</strong>
        {t.body}
        {scope === 'repos' && (
          <div style={{ marginTop: 12 }}>
            <button className="hs-modal-btn primary" onClick={onGotoRepos}>Open Repos →</button>
          </div>
        )}
      </div>
    </main>
  )
}

/* ===================== Common pieces ===================== */

function Header({ title, count, meta }: { title: string; count?: number; meta: string }) {
  return (
    <div className="hs-main-head">
      <h1>{title}</h1>
      {count !== undefined && <span className="hs-h-count">{count}</span>}
      <span className="hs-h-meta">{meta}</span>
    </div>
  )
}

function CompactRow({ repo, onClick }: { repo: Repo; onClick: () => void }) {
  const { org, repo: repoName } = ownerAndName(repo.nameWithOwner)
  const failingPRs = (repo.openPRs.nodes ?? []).filter((pr: RepoOpenPR) => pr.ciState === 'FAILURE' || pr.ciState === 'ERROR').length
  const ciClass = failingPRs > 0 ? 'hs-ci-fail' : repo.openPRs.totalCount > 0 ? 'hs-ci-none' : 'hs-ci-ok'
  const ciLabel = failingPRs > 0 ? `CI ✕ (${failingPRs})` : repo.openPRs.totalCount > 0 ? 'CI —' : 'CI ✓'
  const dot = failingPRs > 0 ? 'critical' : repo.openPRs.totalCount > 0 ? 'warn' : 'ok'

  return (
    <div
      className="hs-row-compact"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      role="button"
      tabIndex={0}
    >
      <span className={`hs-dot ${dot}`} />
      <div className="hs-repo-cell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <OrgChip login={org} avatarUrl={repo.owner.avatarUrl} />
          <strong>{repoName}</strong>
          <span className="hs-muted-small">{org}</span>
        </div>
      </div>
      <span className="hs-pr-mini">{repo.openPRs.totalCount > 0 ? `${repo.openPRs.totalCount} PR` : '—'}</span>
      <span className={ciClass}>{ciLabel}</span>
      <span className="hs-time">{shortAgo(repo.pushedAt)}</span>
    </div>
  )
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  return `${Math.floor(day / 30)}mo`
}
