import { useEffect, useMemo, useRef, useState } from 'react'
import type { Repo } from '../api/github'
import {
  buildItems,
  kindLabel,
  type Item,
  type QSAction
} from './quickSwitcherData'

export type { QSAction }

type Props = {
  open: boolean
  onClose: () => void
  onPick: (action: QSAction) => void
  repos: Repo[]
}

export function QuickSwitcher({ open, onClose, onPick, repos }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Defer focus until the input is mounted in the DOM.
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo(() => buildItems(query, repos), [query, repos])

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, items.length - 1)))
  }, [items.length])

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-qs-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  function pickAt(index: number) {
    const item = items[index]
    if (!item) return
    onPick(item.action)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pickAt(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="qs-backdrop"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      role="button"
      tabIndex={-1}
      aria-label="Close quick switcher"
    >
      <div
        className="qs-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
      >
        <input
          ref={inputRef}
          className="qs-input"
          placeholder="Jump to a repo, PR, or view..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
        />
        <div className="qs-list" ref={listRef}>
          {items.length === 0 && (
            <div className="qs-empty">No matches.</div>
          )}
          {items.map((item: Item, i) => (
            <button
              key={item.id}
              data-qs-index={i}
              className={`qs-item ${i === active ? 'active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => pickAt(i)}
            >
              <span className={`qs-kind qs-kind-${item.action.kind}`}>{kindLabel(item.action.kind)}</span>
              <span className="qs-primary">{item.primary}</span>
              <span className="qs-secondary">{item.secondary}</span>
              <span className="qs-hint">{item.hint}</span>
            </button>
          ))}
        </div>
        <div className="qs-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
