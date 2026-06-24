import type { ReactNode } from 'react'

type Props = {
  icon?: ReactNode
  title: string
  description?: string
  /** Optional call-to-action button rendered below the description. */
  cta?: { label: string; onClick: () => void }
  /** Override the default muted tone — e.g. 'danger' for error states. */
  tone?: 'muted' | 'danger'
}

export function EmptyState({ icon, title, description, cta, tone = 'muted' }: Props) {
  return (
    <div className={`hs-empty ${tone === 'danger' ? 'hs-empty-danger' : ''}`}>
      {icon && <div className="hs-empty-icon">{icon}</div>}
      <strong>{title}</strong>
      {description && <span className="hs-empty-desc">{description}</span>}
      {cta && (
        <button className="hs-empty-cta" onClick={cta.onClick}>
          {cta.label}
        </button>
      )}
    </div>
  )
}
