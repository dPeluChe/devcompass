import { useMemo, useState } from 'react'
import { AttentionRow } from '../AttentionRow'
import { FailedDeploys, useFailedDeploys } from '../FailedDeploys'
import { useNeedsMe, useReviewPool } from '../useNeedsMe'
import type { Reason } from '../types'
import { Header, ScopeSkeleton, type ScopeProps } from './common'

type Filter = 'all' | 'review' | 'mine' | 'failing' | 'mentioned'

// Each filter maps to the reasons it surfaces. 'failing' also pulls in deploys.
const FILTER_REASONS: Record<Exclude<Filter, 'all'>, Reason[]> = {
  review: ['review-requested'],
  mine: ['my-pr'],
  failing: ['ci-failing', 'changes'],
  mentioned: ['mentioned'],
}

export function NeedsScope({ token, viewer, repos, snoozes, onOpenItem, onOpenItemWithAction, onSnoozeItem }: ScopeProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const { data, isLoading, error } = useNeedsMe(token, viewer?.login)
  const items = useMemo(
    () => (data ?? []).filter((i) => !snoozes.has(i.id)),
    [data, snoozes]
  )

  // Discoverable: open PRs in your repos that aren't assigned/requested to you.
  const pool = useReviewPool(token, viewer?.login, repos)
  const poolItems = useMemo(() => {
    const seen = new Set((data ?? []).map((i) => i.id))
    return (pool.data ?? []).filter((i) => !seen.has(i.id) && !snoozes.has(i.id))
  }, [pool.data, data, snoozes])
  const failedCount = useFailedDeploys(token).data?.length ?? 0

  const counts = useMemo(() => ({
    review: items.filter((i) => i.reasons.includes('review-requested')).length,
    mine: items.filter((i) => i.reasons.includes('my-pr')).length,
    failing: items.filter((i) => i.reasons.some((r) => r === 'ci-failing' || r === 'changes')).length + failedCount,
    mentioned: items.filter((i) => i.reasons.includes('mentioned')).length,
  }), [items, failedCount])

  const visibleItems = filter === 'all'
    ? items
    : items.filter((i) => FILTER_REASONS[filter].some((r) => i.reasons.includes(r)))
  const showDeploys = filter === 'all' || filter === 'failing'
  const showPool = filter === 'all'

  const CHIPS: { key: Exclude<Filter, 'all'>; label: string }[] = [
    { key: 'review', label: 'Review requested' },
    { key: 'mine', label: 'My PRs' },
    { key: 'failing', label: 'Failing' },
    { key: 'mentioned', label: 'Mentioned' },
  ]
  const hasAnything = items.length > 0 || failedCount > 0

  return (
    <main className="hs-main">
      <Header
        title="Needs me"
        count={items.length}
        meta="PRs awaiting your review · your PRs with failing CI · mentions"
      />

      {!isLoading && hasAnything && (
        <div className="hs-issue-filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All <span className="muted">{items.length}</span>
          </button>
          {CHIPS.filter((c) => counts[c.key] > 0).map((c) => (
            <button key={c.key} className={filter === c.key ? 'active' : ''} onClick={() => setFilter(c.key)}>
              {c.label} <span className="muted">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      )}

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

      {/* Broken production deploys jump the queue — most urgent signal. */}
      {showDeploys && <FailedDeploys token={token} />}

      {!isLoading && !error && items.length === 0 && poolItems.length === 0 && failedCount === 0 && !pool.isLoading && (
        <div className="hs-empty">
          <strong>Nothing needs you right now.</strong>
          When something comes up it shows here first.
        </div>
      )}

      {!isLoading && items.length > 0 && visibleItems.length === 0 && (!showDeploys || failedCount === 0) && (
        <div className="hs-empty"><strong>No items match this filter.</strong></div>
      )}

      {!isLoading && visibleItems.length > 0 && (
        <section className="hs-surface">
          {visibleItems.map((item) => (
            <AttentionRow
              key={item.id}
              item={item}
              onOpen={() => onOpenItem(item)}
              onApprove={onOpenItemWithAction ? () => onOpenItemWithAction(item, 'approve') : undefined}
              onRequestChanges={onOpenItemWithAction ? () => onOpenItemWithAction(item, 'request-changes') : undefined}
              onSnooze={() => onSnoozeItem(item)}
            />
          ))}
        </section>
      )}

      {/* Secondary: open PRs you could review but aren't on yet. Shows a
          skeleton while the live search runs so the section doesn't look empty. */}
      {showPool && !isLoading && (pool.isLoading || poolItems.length > 0) && (
        <>
          <h3 className="hs-section-label">
            Open in your repos
            <span className="muted"> — not assigned to you, available to review</span>
            {pool.truncated && <span className="muted"> · top orgs only</span>}
          </h3>
          {pool.isLoading ? (
            <ScopeSkeleton />
          ) : (
            <section className="hs-surface">
              {poolItems.map((item) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  onOpen={() => onOpenItem(item)}
                  onApprove={onOpenItemWithAction ? () => onOpenItemWithAction(item, 'approve') : undefined}
                  onRequestChanges={onOpenItemWithAction ? () => onOpenItemWithAction(item, 'request-changes') : undefined}
                  onSnooze={() => onSnoozeItem(item)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}
