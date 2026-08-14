import { MdStar, MdTrendingUp } from 'react-icons/md'
import { EmptyState } from '../EmptyState'
import { CompactRow, Header, type ScopeProps } from './common'

export function PinnedScope({ repos, pinned, onOpenRepo, onScopeChange }: ScopeProps) {
  const pinnedById = new Map(pinned.map((p) => [p.repoId, p]))
  const rows = repos
    .filter((r) => pinnedById.has(r.id))
    .sort((a, b) => (pinned.findIndex(p => p.repoId === a.id)) - (pinned.findIndex(p => p.repoId === b.id)))

  return (
    <main className="hs-main">
      <Header title="Pinned" count={rows.length} meta="Pinned systems with status & open PRs" />
      {rows.length === 0 ? (
        <EmptyState
          icon={<MdStar size={48} />}
          title="No pinned systems yet."
          description="Pin repos from the Repos tab to track them here."
          cta={onScopeChange ? { label: 'Browse repos →', onClick: () => onScopeChange('repos') } : undefined}
        />
      ) : (
        <section className="hs-surface">
          {rows.map((r) => <CompactRow key={r.id} repo={r} onClick={() => onOpenRepo(r)} />)}
        </section>
      )}
    </main>
  )
}

export function ActiveScope({ repos, onOpenRepo }: ScopeProps) {
  const cutoff = Date.now() - 7 * 86_400_000
  const rows = repos
    .filter((r) => new Date(r.pushedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
    .slice(0, 50)

  return (
    <main className="hs-main">
      <Header title="Active 7d" count={rows.length} meta="Recently pushed across all enabled orgs" />
      {rows.length === 0 ? (
        <EmptyState
          icon={<MdTrendingUp size={48} />}
          title="Nothing pushed in the last 7 days."
          description="Repos with recent commits will show up here."
        />
      ) : (
        <section className="hs-surface">
          {rows.map((r) => <CompactRow key={r.id} repo={r} onClick={() => onOpenRepo(r)} />)}
        </section>
      )}
    </main>
  )
}
