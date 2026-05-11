import { useEffect, useMemo, useRef, useState } from 'react'
import type { Repo, RepoOpenPR } from '../api/github'

export type QSAction =
  | { kind: 'view'; view: 'home' | 'repos' | 'config' }
  | { kind: 'repo'; repo: Repo }
  | { kind: 'pr'; repo: Repo; pr: RepoOpenPR }

type Item = {
  id: string
  primary: string
  secondary: string
  hint: string
  score: number
  action: QSAction
}

type Props = {
  open: boolean
  onClose: () => void
  onPick: (action: QSAction) => void
  repos: Repo[]
}

const VIEWS: { view: 'home' | 'repos' | 'config'; label: string; hint: string }[] = [
  { view: 'home', label: 'Home', hint: 'g h' },
  { view: 'repos', label: 'Repos', hint: 'g r' },
  { view: 'config', label: 'Config', hint: 'g c' }
]

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
          {items.map((item, i) => (
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

function kindLabel(kind: QSAction['kind']): string {
  if (kind === 'view') return 'view'
  if (kind === 'repo') return 'repo'
  return 'pr'
}

function buildItems(query: string, repos: Repo[]): Item[] {
  const q = query.toLowerCase().trim()
  const out: Item[] = []

  for (const v of VIEWS) {
    const score = q ? matchScore(v.label.toLowerCase(), q) : 100
    if (score > 0) {
      out.push({
        id: `view:${v.view}`,
        primary: v.label,
        secondary: '',
        hint: v.hint,
        score: score + 50, // views rank a bit lower than direct matches
        action: { kind: 'view', view: v.view }
      })
    }
  }

  for (const repo of repos) {
    const repoScore = q
      ? Math.max(
          matchScore(repo.name.toLowerCase(), q),
          matchScore(repo.nameWithOwner.toLowerCase(), q) - 5,
          matchScore((repo.description ?? '').toLowerCase(), q) - 30
        )
      : 80
    if (repoScore > 0) {
      out.push({
        id: `repo:${repo.id}`,
        primary: repo.name,
        secondary: repo.owner.login,
        hint: repo.openPRs.totalCount > 0 ? `${repo.openPRs.totalCount} PR` : '',
        score: repoScore,
        action: { kind: 'repo', repo }
      })
    }
    for (const pr of repo.openPRs.nodes ?? []) {
      const prScore = q
        ? Math.max(
            matchScore(pr.title.toLowerCase(), q),
            matchScore(`#${pr.number}`, q) + 10,
            matchScore(repo.nameWithOwner.toLowerCase(), q) - 20
          )
        : 40
      if (prScore > 0) {
        out.push({
          id: `pr:${pr.id}`,
          primary: `#${pr.number} ${pr.title}`,
          secondary: repo.nameWithOwner,
          hint: pr.isDraft ? 'draft' : '',
          score: prScore - 5, // PRs slightly below repos when scores tie
          action: { kind: 'pr', repo, pr }
        })
      }
    }
  }

  out.sort((a, b) => b.score - a.score)
  return out.slice(0, 60)
}

// Cheap scorer: prefix > word-start > substring. Returns 0 for no match.
function matchScore(haystack: string, needle: string): number {
  if (!needle) return 0
  if (haystack === needle) return 1000
  if (haystack.startsWith(needle)) return 800
  // word boundary
  if (new RegExp(`\\b${escapeRegExp(needle)}`).test(haystack)) return 500
  const idx = haystack.indexOf(needle)
  if (idx >= 0) return Math.max(50, 200 - idx)
  // subsequence fallback (each needle char appears in order)
  let i = 0
  for (const c of haystack) {
    if (c === needle[i]) i++
    if (i === needle.length) break
  }
  if (i === needle.length) return 30
  return 0
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
