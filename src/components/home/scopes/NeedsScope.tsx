import { useMemo } from 'react'
import { AttentionRow } from '../AttentionRow'
import { FailedDeploys, useFailedDeploys } from '../FailedDeploys'
import { useNeedsMe, useReviewPool } from '../useNeedsMe'
import { Header, ScopeSkeleton, type ScopeProps } from './common'

export function NeedsScope({ token, viewer, repos, snoozes, onOpenItem, onSnoozeItem }: ScopeProps) {
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

      {/* Broken production deploys jump the queue — most urgent signal. */}
      <FailedDeploys token={token} />

      {!isLoading && !error && items.length === 0 && poolItems.length === 0 && failedCount === 0 && !pool.isLoading && (
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

      {/* Secondary: open PRs you could review but aren't on yet. Shows a
          skeleton while the live search runs so the section doesn't look empty. */}
      {!isLoading && (pool.isLoading || poolItems.length > 0) && (
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
