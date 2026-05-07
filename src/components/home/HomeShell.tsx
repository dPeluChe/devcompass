import { useState, useEffect, useCallback } from 'react'
import type { Repo, Viewer } from '../../api/github'
import type { PinnedRepo } from '../../store/db'
import { snoozePr } from '../../store/db'
import { Sidebar } from './Sidebar'
import { UserFooter } from './UserFooter'
import { ScopeView } from './ScopeView'
import { DetailModal } from './DetailModal'
import { useNeedsMe, useSnoozes } from './useNeedsMe'
import { useSinceLastVisit } from './useSinceLastVisit'
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openItem, setOpenItem] = useState<AttentionItem | null>(null)
  const { snoozes, refresh: refreshSnoozes } = useSnoozes()

  // ---- URL deep-link for the modal: ?pr=owner/repo/123 ----
  function setUrlForItem(it: AttentionItem | null) {
    try {
      const url = new URL(window.location.href)
      if (it) {
        url.searchParams.set('pr', `${it.org}/${it.repo}/${it.number}`)
      } else {
        url.searchParams.delete('pr')
      }
      window.history.replaceState({}, '', url.toString())
    } catch { /* SSR / blocked window — ignore */ }
  }
  function selectItem(it: AttentionItem | null) {
    setOpenItem(it)
    setUrlForItem(it)
  }

  // We need the count for the sidebar even if the user isn't on Needs me yet —
  // it's the most useful "passive monitoring" affordance the sidebar provides.
  const { data: needsMeData } = useNeedsMe(token, viewer?.login)
  const visibleNeedsCount = (needsMeData ?? []).filter((i) => !snoozes.has(i.id)).length

  // Same for Since-last-visit — the sidebar count gets a visible "has-attn" dot
  // so users notice changes even before clicking the scope.
  const { events: sinceEvents } = useSinceLastVisit(repos)
  const sinceCount = sinceEvents.length

  const active7dCount = repos.filter((r) => Date.now() - new Date(r.pushedAt).getTime() < 7 * 86_400_000).length

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  // On first mount, if the URL carries ?pr=owner/repo/number open the modal
  // pointed at that PR. We construct a minimal AttentionItem so the modal can
  // lazy-fetch the rest — the param-only path keeps shareable links cheap to
  // resolve (no need to wait for searchPRs).
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const pr = url.searchParams.get('pr')
      if (!pr) return
      const [org, repoName, numStr] = pr.split('/')
      const number = parseInt(numStr, 10)
      if (!org || !repoName || !Number.isFinite(number)) return
      // Avoid double-set if we already have something open.
      if (openItem) return
      setOpenItem({
        id: `url:${pr}`,
        org,
        orgAvatarUrl: undefined,
        repo: repoName,
        nameWithOwner: `${org}/${repoName}`,
        number,
        title: '',
        url: `https://github.com/${org}/${repoName}/pull/${number}`,
        isDraft: false,
        updatedAt: new Date().toISOString(),
        ciState: null,
        reviewDecision: null,
        author: null,
        reasons: [],
        dot: 'info'
      })
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSnooze = useCallback(async (item: AttentionItem) => {
    await snoozePr(item.id, Date.now() + SNOOZE_HOURS * 60 * 60 * 1000, {
      nameWithOwner: item.nameWithOwner,
      number: item.number
    })
    refreshSnoozes()
  }, [refreshSnoozes])

  // On mobile the sidebar is hidden by default and slides in over the content
  // when the user taps the ≡ button in the topbar (rendered by Dashboard) or
  // the floating toggle below. Selecting a scope auto-closes it so the next
  // tap targets the content.
  function onSelectScope(key: ScopeKey) {
    setScope(key)
    setMobileOpen(false)
  }

  return (
    <div className={`hs-shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <button
        className="hs-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >≡</button>
      <div className="hs-mobile-backdrop" onClick={() => setMobileOpen(false)} />
      <Sidebar
        active={scope}
        collapsed={collapsed}
        needsMeCount={visibleNeedsCount}
        sinceCount={sinceCount}
        watchingCount={0}
        pinnedCount={pinned.length}
        active7dCount={active7dCount}
        allReposCount={repos.length}
        onSelect={onSelectScope}
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
        onOpenItem={selectItem}
        onSnoozeItem={handleSnooze}
        onOpenRepo={onOpenRepo}
        onGotoRepos={onGotoRepos}
      />

      <DetailModal
        token={token}
        item={openItem}
        onClose={() => selectItem(null)}
        onSnooze={handleSnooze}
      />
    </div>
  )
}
