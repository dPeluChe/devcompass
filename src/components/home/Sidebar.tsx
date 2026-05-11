import type { ReactNode } from 'react'
import type { ScopeKey } from './types'

type ItemDef = { key: ScopeKey; label: string; icon: string; count?: number; hasAttn?: boolean }
type Group = { title: string; items: ItemDef[] }

export type OrgEntry = { login: string; count: number }

type Props = {
  active: ScopeKey
  collapsed: boolean
  needsMeCount: number
  sinceCount: number
  watchingCount: number
  pinnedCount: number
  active7dCount: number
  allReposCount: number
  /** Per-org repo counts. Sorted by caller — usually viewer first, then by count desc. */
  orgs?: OrgEntry[]
  onSelect: (key: ScopeKey) => void
  onToggleCollapsed: () => void
  footer?: ReactNode
}

export function Sidebar({
  active, collapsed,
  needsMeCount, sinceCount, watchingCount,
  pinnedCount, active7dCount, allReposCount,
  orgs,
  onSelect,
  onToggleCollapsed,
  footer
}: Props) {
  const groups: Group[] = [
    {
      title: 'Inbox',
      items: [
        { key: 'needs', label: 'Needs me', icon: '●', count: needsMeCount, hasAttn: needsMeCount > 0 },
        { key: 'since', label: 'Since last visit', icon: '↻', count: sinceCount, hasAttn: sinceCount > 0 },
        { key: 'watching', label: 'Watching', icon: '○', count: watchingCount }
      ]
    },
    {
      title: 'Workbench',
      items: [
        { key: 'pinned', label: 'Pinned', icon: '★', count: pinnedCount },
        { key: 'active', label: 'Active 7d', icon: '▴', count: active7dCount },
        { key: 'repos', label: 'All repos', icon: '⊞', count: allReposCount }
      ]
    }
  ]
  if (orgs && orgs.length > 0) {
    groups.push({
      title: 'Orgs',
      items: orgs.map((o) => ({ key: `org:${o.login}`, label: o.login, icon: '◆', count: o.count }))
    })
  }
  groups.push({
    title: 'Insights',
    items: [
      { key: 'digest', label: 'Digest', icon: '∿' },
      { key: 'rate', label: 'Token & rate', icon: '◎' }
    ]
  })

  return (
    <aside className={`hs-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="hs-sidebar-head">
        <button
          className="hs-sidebar-collapse"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          ≡
        </button>
      </div>
      <div className="hs-sidebar-scroll">
        {groups.map((group) => (
          <div className="hs-sidebar-group" key={group.title}>
            <h4>{group.title}</h4>
            {group.items.map((item) => (
              <button
                key={item.key}
                className={`hs-sidebar-item ${active === item.key ? 'active' : ''} ${item.hasAttn ? 'has-attn' : ''}`}
                onClick={() => onSelect(item.key)}
                title={item.label}
              >
                <span className="hs-icon">{item.icon}</span>
                <span className="hs-label">{item.label}</span>
                {item.count !== undefined && <span className="hs-count">{item.count}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
      {footer}
    </aside>
  )
}
