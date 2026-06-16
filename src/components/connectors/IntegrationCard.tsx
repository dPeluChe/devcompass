import { useState, type ReactNode } from 'react'

export type IntStatus = { tone: 'ok' | 'warn' | 'muted'; label: string }

/**
 * Accordion card for one integration in the Connectors hub: logo + name +
 * status pill, expand to reveal its setup/diagnostics. `comingSoon` renders a
 * disabled placeholder for connectors we haven't built yet.
 */
export function IntegrationCard({ icon, name, sub, status, defaultOpen, comingSoon, children }: {
  icon: ReactNode
  name: string
  sub?: string
  status?: IntStatus
  defaultOpen?: boolean
  comingSoon?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  if (comingSoon) {
    return (
      <div className="int-card soon">
        <div className="int-card-head" aria-disabled>
          <span className="int-card-icon">{icon}</span>
          <div className="int-card-id"><strong>{name}</strong>{sub && <span className="muted">{sub}</span>}</div>
          <span className="int-status muted">soon</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`int-card ${open ? 'open' : ''}`}>
      <button className="int-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="int-card-icon">{icon}</span>
        <div className="int-card-id">
          <strong>{name}</strong>
          {sub && <span className="muted">{sub}</span>}
        </div>
        {status && <span className={`int-status ${status.tone}`}>{status.label}</span>}
        <span className="int-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="int-card-body">{children}</div>}
    </div>
  )
}
