import { CompactRow, Header, type ScopeProps } from './common'

export function PinnedScope({ repos, pinned, onOpenRepo }: ScopeProps) {
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
        <div className="hs-empty"><strong>Nothing pushed in the last 7 days.</strong></div>
      ) : (
        <section className="hs-surface">
          {rows.map((r) => <CompactRow key={r.id} repo={r} onClick={() => onOpenRepo(r)} />)}
        </section>
      )}
    </main>
  )
}
