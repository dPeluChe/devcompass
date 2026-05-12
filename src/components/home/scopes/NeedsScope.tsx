import { useMemo } from 'react'
import { AttentionRow } from '../AttentionRow'
import { useNeedsMe } from '../useNeedsMe'
import { Header, type ScopeProps } from './common'

export function NeedsScope({ token, viewer, snoozes, onOpenItem, onSnoozeItem }: ScopeProps) {
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
