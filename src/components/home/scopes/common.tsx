import type { Repo, RepoOpenPR, Viewer } from '../../../api/github'
import { relativeTime } from '../../../utils/time'
import type { PinnedRepo } from '../../../store/db'
import { OrgChip } from '../OrgChip'
import type { AttentionItem, ScopeKey } from '../types'
import { ownerAndName } from '../types'

/** Shared props consumed by every scope renderer + ScopeView's router. */
export type ScopeProps = {
  scope: ScopeKey
  token: string
  viewer: Viewer | undefined
  repos: Repo[]
  pinned: PinnedRepo[]
  snoozes: Set<string>
  onOpenItem: (item: AttentionItem) => void
  /** Open the detail modal and fire a review action once the PR loads. */
  onOpenItemWithAction?: (item: AttentionItem, action: 'approve' | 'request-changes') => void
  onSnoozeItem: (item: AttentionItem) => void
  onOpenRepo: (repo: Repo) => void
  onTogglePinned: (repo: Repo) => void
  /** Lets a scope navigate to another scope (e.g. Digest's "Show failing CI in Repos →" jump). */
  onScopeChange?: (key: ScopeKey) => void
}

/** Shared loading skeleton for scope bodies (NeedsScope-style bars). */
export function ScopeSkeleton() {
  return (
    <section className="hs-surface">
      <div className="hs-skeleton-block">
        <div className="hs-skeleton-bar" style={{ width: '60%' }} />
        <div className="hs-skeleton-bar" style={{ width: '40%' }} />
        <div className="hs-skeleton-bar" style={{ width: '90%' }} />
        <div className="hs-skeleton-bar" style={{ width: '75%' }} />
      </div>
    </section>
  )
}

export function Header({ title, count, meta }: { title: string; count?: number; meta: string }) {
  return (
    <div className="hs-main-head">
      <h1>{title}</h1>
      {count !== undefined && <span className="hs-h-count">{count}</span>}
      <span className="hs-h-meta">{meta}</span>
    </div>
  )
}

export function CompactRow({ repo, onClick }: { repo: Repo; onClick: () => void }) {
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
      <span className="hs-time">{relativeTime(repo.pushedAt, false)}</span>
    </div>
  )
}

