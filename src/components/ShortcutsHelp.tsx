type Props = { open: boolean; onClose: () => void }

const ROWS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Quick switcher' },
  { keys: ['/'], label: 'Open quick switcher' },
  { keys: ['g', 'h'], label: 'Go to Home' },
  { keys: ['g', 'r'], label: 'Go to Repos' },
  { keys: ['g', 'c'], label: 'Go to Config' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['esc'], label: 'Close dialog' }
]

export function ShortcutsHelp({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div
      className="qs-backdrop"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      role="button"
      tabIndex={-1}
      aria-label="Close shortcuts help"
    >
      <div
        className="help-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header className="help-head">
          <h2>Keyboard shortcuts</h2>
          <button className="link-btn" onClick={onClose}>Close</button>
        </header>
        <ul className="help-list">
          {ROWS.map((row) => (
            <li key={row.label}>
              <span className="help-keys">
                {row.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
              <span className="help-label">{row.label}</span>
            </li>
          ))}
        </ul>
        <p className="muted help-foot">
          Shortcuts work anywhere. <kbd>g</kbd> sequences and <kbd>/</kbd> are ignored while typing in inputs.
        </p>
      </div>
    </div>
  )
}
