import type { ReactNode } from 'react'

export function Surface({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`hs-surface rd-surface ${wide ? 'rd-surface-wide' : ''}`}>
      <h3 className="rd-surface-title">{title}</h3>
      {children}
    </section>
  )
}

export function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="rd-kv">
      <span className="rd-kv-key muted">{k}</span>
      <span className="rd-kv-val">{v}</span>
    </div>
  )
}

export function EmptyState({ label }: { label: string }) {
  return <div className="hs-empty"><strong>{label}</strong></div>
}

export function RdLoading() {
  return (
    <div className="rd-loading" aria-busy="true" aria-live="polite">
      <div className="hs-skeleton-bar" style={{ width: '60%' }} />
      <div className="hs-skeleton-bar" style={{ width: '40%' }} />
      <div className="hs-skeleton-bar" style={{ width: '90%' }} />
    </div>
  )
}

export type Tab = 'overview' | 'commits' | 'prs' | 'issues' | 'releases'

type RdTabsProps = {
  tab: Tab
  onChange: (t: Tab) => void
  commitCount: number
  prCount: number
  issueCount: number
  releaseCount: number
}

export function RdTabs({ tab, onChange, commitCount, prCount, issueCount, releaseCount }: RdTabsProps) {
  return (
    <nav className="rd-tabs" aria-label="Repo sections">
      <TabButton active={tab === 'overview'} onClick={() => onChange('overview')} label="Overview" />
      <TabButton active={tab === 'commits'} onClick={() => onChange('commits')} label="Commits" count={commitCount} />
      <TabButton active={tab === 'prs'} onClick={() => onChange('prs')} label="Pull requests" count={prCount} />
      <TabButton active={tab === 'issues'} onClick={() => onChange('issues')} label="Issues" count={issueCount} />
      <TabButton active={tab === 'releases'} onClick={() => onChange('releases')} label="Releases" count={releaseCount} />
    </nav>
  )
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      className={`rd-tab ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      {count !== undefined && <span className="rd-tab-count">{count}</span>}
    </button>
  )
}
