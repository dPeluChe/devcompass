import { useMemo } from 'react'
import type { Repo, RepoOpenPR, Viewer } from '../../api/github'
import type { PinnedRepo } from '../../store/db'
import { OrgChip } from './OrgChip'
import { AttentionRow } from './AttentionRow'
import { useNeedsMe } from './useNeedsMe'
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
    <div className="hs-row-compact" onClick={onClick} role="button" tabIndex={0}>
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
