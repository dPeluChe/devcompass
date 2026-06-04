import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Searchable single-select combobox. Click to open, type to filter, click to
 * pick, × to clear. Replaces the unusable native <datalist> for long lists.
 */
export function RepoPicker({ value, options, onChange, placeholder = 'Select…' }: {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const { shown, total } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
    return { shown: list.slice(0, 50), total: list.length }
  }, [options, query])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="repo-picker" ref={ref}>
      <div
        className="repo-picker-trigger"
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) }
        }}
      >
        <span className={`repo-picker-value ${value ? '' : 'muted'}`}>{value || placeholder}</span>
        {value && (
          <span
            className="repo-picker-clear"
            role="button"
            tabIndex={-1}
            title="Clear"
            onClick={(e) => { e.stopPropagation(); onChange('') }}
          >×</span>
        )}
        <span className="repo-picker-caret">▾</span>
      </div>

      {open && (
        <div
          className="repo-picker-pop"
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        >
          <input
            className="repo-picker-search"
            autoFocus
            placeholder="Search repos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="repo-picker-list">
            {shown.length === 0 ? (
              <li className="repo-picker-empty muted">No matching repo.</li>
            ) : (
              shown.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    className={`repo-picker-option ${o === value ? 'selected' : ''}`}
                    onClick={() => pick(o)}
                  >
                    {o}
                  </button>
                </li>
              ))
            )}
            {total > shown.length && (
              <li className="repo-picker-more muted">+{total - shown.length} more — keep typing</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
