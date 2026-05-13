import type { ReactNode } from 'react'
import type { ScopeKey } from './types'

type ItemDef = { key: ScopeKey; label: string; icon: string; title?: string; count?: number; hasAttn?: boolean }
type Group = { title: string; items: ItemDef[] }

/**
 * Per-org affordance shown in the sidebar Orgs group.
 *   - self          → the viewer's own account ("Personal")
 *   - member        → org the viewer belongs to (viewer.organizations)
 *   - collaborator  → org where the viewer has repo access but isn't a member
 */
export type OrgKind = 'self' | 'member' | 'collaborator'

export type OrgEntry = { login: string; count: number; kind: OrgKind }

const ORG_KIND_ICON: Record<OrgKind, string> = {
  self: '◉',
  member: '◆',
  collaborator: '◇'
}
const ORG_KIND_TITLE: Record<OrgKind, string> = {
  self: 'Your personal repos',
  member: 'Member',
  collaborator: 'Collaborator (repo access without org membership)'
}

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
      title: 'Summary',
      items: [
        { key: 'digest', label: 'Digest', icon: '∿', title: 'Operational snapshot — week-in-review across all visible repos' }
      ]
    },
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
  // Split membership orgs (self + member) and collaborator-only orgs into two
  // sections so the relationship is visible without a tooltip.
  if (orgs && orgs.length > 0) {
    const owned = orgs.filter((o) => o.kind === 'self' || o.kind === 'member')
    const collaborators = orgs.filter((o) => o.kind === 'collaborator')
    const toItem = (o: OrgEntry): ItemDef => ({
      key: `org:${o.login}`,
      label: o.kind === 'self' ? 'Personal' : o.login,
      icon: ORG_KIND_ICON[o.kind],
      title: `${ORG_KIND_TITLE[o.kind]} · @${o.login} · ${o.count} repo${o.count === 1 ? '' : 's'}`,
      count: o.count
    })
    if (owned.length > 0) groups.push({ title: 'Orgs — Member', items: owned.map(toItem) })
    if (collaborators.length > 0) groups.push({ title: 'Orgs — Collaborator', items: collaborators.map(toItem) })
  }
  groups.push({
    title: 'Insights',
    items: [
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
                className={`hs-sidebar-item hs-tip ${active === item.key ? 'active' : ''} ${item.hasAttn ? 'has-attn' : ''}`}
                onClick={() => onSelect(item.key)}
                data-tip={item.title ?? item.label}
                aria-label={item.title ?? item.label}
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
