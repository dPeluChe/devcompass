type Props = { open: boolean; onClose: () => void }

const ROWS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'Quick switcher' },
  { keys: ['/'], label: 'Focus search' },
  { keys: ['g', 'h'], label: 'Go to Home' },
  { keys: ['g', 'r'], label: 'Go to Repos' },
  { keys: ['g', 'p'], label: 'Go to PRs' },
  { keys: ['g', 'c'], label: 'Go to Config' },
  { keys: ['?'], label: 'Show this help' },
  { keys: ['esc'], label: 'Close dialog' }
]

export function ShortcutsHelp({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div className="qs-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <header className="help-head">
          <h2>Keyboard shortcuts</h2>
          <button className="link-btn" onClick={onClose}>Close</button>
        </header>
        <ul className="help-list">
          {ROWS.map((row) => (
            <li key={row.label}>
              <span className="help-keys">
                {row.keys.map((k, i) => (
                  <kbd key={i}>{k}</kbd>
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
