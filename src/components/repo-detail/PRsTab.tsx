import { useMemo, useState } from 'react'
import type { RepoDetail as RepoDetailT } from '../../api/github'
import { EmptyState } from './common'
import { shortAgo } from './utils'

type PRStateFilter = 'all' | 'OPEN' | 'MERGED' | 'CLOSED'

export function PRsTab({ data }: { data: RepoDetailT }) {
  const prs = data.pullRequests.nodes
  const [filter, setFilter] = useState<PRStateFilter>('all')

  const counts = useMemo(() => {
    const c = { all: prs.length, OPEN: 0, MERGED: 0, CLOSED: 0 }
    for (const pr of prs) c[pr.state] += 1
    return c
  }, [prs])

  const visible = useMemo(() => {
    if (filter === 'all') return prs
    return prs.filter((pr) => pr.state === filter)
  }, [prs, filter])

  if (prs.length === 0) return <EmptyState label="No pull requests in this repo." />

  return (
    <div className="rd-prs">
      <div className="rd-state-filters" role="tablist" aria-label="Filter by state">
        <StateFilterBtn label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        <StateFilterBtn label="Open" count={counts.OPEN} active={filter === 'OPEN'} onClick={() => setFilter('OPEN')} variant="open" />
        <StateFilterBtn label="Merged" count={counts.MERGED} active={filter === 'MERGED'} onClick={() => setFilter('MERGED')} variant="merged" />
        <StateFilterBtn label="Closed" count={counts.CLOSED} active={filter === 'CLOSED'} onClick={() => setFilter('CLOSED')} variant="closed" />
      </div>
      {visible.length === 0 ? (
        <EmptyState label={`No ${filter.toLowerCase()} pull requests.`} />
      ) : (
        <section className="hs-surface rd-list">
          {visible.map((pr) => (
            <a key={pr.number} className={`rd-row rd-pr-row state-${pr.state.toLowerCase()}`} href={pr.url} target="_blank" rel="noreferrer">
              <span className="rd-pr-num">#{pr.number}</span>
              <div className="rd-row-main">
                <div className="rd-row-title">
                  <PrStateBadge state={pr.state} isDraft={pr.isDraft} />
                  {pr.title}
                </div>
                <div className="rd-row-meta muted">
                  {pr.author?.login ?? 'unknown'} · {prTimeLabel(pr)}
                </div>
              </div>
            </a>
          ))}
        </section>
      )}
    </div>
  )
}

function StateFilterBtn({
  label, count, active, onClick, variant
}: { label: string; count: number; active: boolean; onClick: () => void; variant?: 'open' | 'merged' | 'closed' }) {
  return (
    <button
      type="button"
      className={`rd-state-filter ${active ? 'active' : ''} ${variant ? `v-${variant}` : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      <span className="rd-state-filter-count">{count}</span>
    </button>
  )
}

function PrStateBadge({ state, isDraft }: { state: 'OPEN' | 'CLOSED' | 'MERGED'; isDraft: boolean }) {
  if (isDraft && state === 'OPEN') return <span className="rd-state-pill state-draft">draft</span>
  if (state === 'OPEN') return <span className="rd-state-pill state-open">open</span>
  if (state === 'MERGED') return <span className="rd-state-pill state-merged">merged</span>
  return <span className="rd-state-pill state-closed">closed</span>
}

function prTimeLabel(pr: RepoDetailT['pullRequests']['nodes'][number]): string {
  if (pr.state === 'MERGED' && pr.mergedAt) return `merged ${shortAgo(pr.mergedAt)}`
  if (pr.state === 'CLOSED' && pr.closedAt) return `closed ${shortAgo(pr.closedAt)}`
  return `updated ${shortAgo(pr.updatedAt)}`
}
