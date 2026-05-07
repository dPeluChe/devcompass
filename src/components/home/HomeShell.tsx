import { useState, useEffect, useCallback } from 'react'
import type { Repo, Viewer } from '../../api/github'
import type { PinnedRepo } from '../../store/db'
import { snoozePr } from '../../store/db'
import { Sidebar } from './Sidebar'
import { UserFooter } from './UserFooter'
import { ScopeView } from './ScopeView'
import { DetailModal } from './DetailModal'
import { useNeedsMe, useSnoozes } from './useNeedsMe'
import type { AttentionItem, ScopeKey } from './types'
import './home.css'

const COLLAPSED_KEY = 'home.sidebarCollapsed'
const SNOOZE_HOURS = 18 // until tomorrow morning-ish

type Props = {
  token: string
  viewer: Viewer | undefined
  repos: Repo[]
  pinned: PinnedRepo[]
  onOpenRepo: (repo: Repo) => void
  onGotoRepos: () => void
  onLogout: () => void
}

export function HomeShell({ token, viewer, repos, pinned, onOpenRepo, onGotoRepos, onLogout }: Props) {
  const [scope, setScope] = useState<ScopeKey>('needs')
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [openItem, setOpenItem] = useState<AttentionItem | null>(null)
  const { snoozes, refresh: refreshSnoozes } = useSnoozes()

  // We need the count for the sidebar even if the user isn't on Needs me yet —
  // it's the most useful "passive monitoring" affordance the sidebar provides.
  const { data: needsMeData } = useNeedsMe(token, viewer?.login)
  const visibleNeedsCount = (needsMeData ?? []).filter((i) => !snoozes.has(i.id)).length

  const active7dCount = repos.filter((r) => Date.now() - new Date(r.pushedAt).getTime() < 7 * 86_400_000).length

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const handleSnooze = useCallback(async (item: AttentionItem) => {
    await snoozePr(item.id, Date.now() + SNOOZE_HOURS * 60 * 60 * 1000, {
      nameWithOwner: item.nameWithOwner,
      number: item.number
    })
    refreshSnoozes()
  }, [refreshSnoozes])

  return (
    <div className={`hs-shell ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar
        active={scope}
        collapsed={collapsed}
        needsMeCount={visibleNeedsCount}
        sinceCount={0}
        watchingCount={0}
        pinnedCount={pinned.length}
        active7dCount={active7dCount}
        allReposCount={repos.length}
        onSelect={setScope}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        footer={<UserFooter viewer={viewer} collapsed={collapsed} onLogout={onLogout} />}
      />

      <ScopeView
        scope={scope}
        token={token}
        viewer={viewer}
        repos={repos}
        pinned={pinned}
        snoozes={snoozes}
        onOpenItem={setOpenItem}
        onSnoozeItem={handleSnooze}
        onOpenRepo={onOpenRepo}
        onGotoRepos={onGotoRepos}
      />

      <DetailModal
        token={token}
        item={openItem}
        onClose={() => setOpenItem(null)}
        onSnooze={handleSnooze}
      />
    </div>
  )
}
