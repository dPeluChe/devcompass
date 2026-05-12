import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Org, Repo, Viewer } from '../../api/github'
import type { PinnedRepo } from '../../store/db'
import { snoozePr } from '../../store/db'
import { Sidebar, type OrgEntry } from './Sidebar'
import { UserFooter } from './UserFooter'
import { ScopeView } from './ScopeView'
import { DetailModal } from './DetailModal'
import { RepoBrowser } from '../RepoBrowser'
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
  orgs: Org[]
  /** Initial sidebar scope. Lets the topbar tabs drop the user straight into "All repos" etc. */
  initialScope?: ScopeKey
  /** When set, the main column renders the repo detail browser instead of ScopeView; the sidebar stays mounted. */
  selectedRepo?: { owner: string; name: string } | null
  onOpenRepo: (repo: Repo) => void
  onCloseSelectedRepo?: () => void
  onTogglePinned: (repo: Repo) => void
  onLogout: () => void
}

export function HomeShell({
  token, viewer, repos, pinned, orgs, initialScope,
  selectedRepo, onOpenRepo, onCloseSelectedRepo,
  onTogglePinned, onLogout
}: Props) {
  const [scope, setScope] = useState<ScopeKey>(initialScope ?? 'needs')

  // Keep the inner scope in sync with topbar tab clicks (Dashboard re-mounts with a
  // new initialScope when the user switches Home <-> Repos).
  useEffect(() => {
    if (initialScope) setScope(initialScope)
  }, [initialScope])
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

  // Counts per org for the Orgs sidebar group. Viewer first, then by count desc so the
  // user's heaviest orgs surface at the top.
  const orgEntries = useMemo<OrgEntry[]>(() => {
    const counts = new Map<string, number>()
    for (const r of repos) counts.set(r.owner.login, (counts.get(r.owner.login) ?? 0) + 1)
    const viewerLogin = viewer?.login
    const known = new Set(orgs.map((o) => o.login))
    if (viewerLogin) known.add(viewerLogin)
    const entries: OrgEntry[] = []
    for (const login of known) entries.push({ login, count: counts.get(login) ?? 0 })
    return entries.toSorted((a, b) => {
      if (a.login === viewerLogin) return -1
      if (b.login === viewerLogin) return 1
      return b.count - a.count || a.login.localeCompare(b.login)
    })
  }, [orgs, repos, viewer?.login])

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
  // tap targets the content. Picking a scope also drops out of the repo
  // detail panel so the new scope is what the user sees.
  function onSelectScope(key: ScopeKey) {
    setScope(key)
    setMobileOpen(false)
    if (selectedRepo) onCloseSelectedRepo?.()
  }

  return (
    <div className={`hs-shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <button
        className="hs-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >≡</button>
      <div
        className="hs-mobile-backdrop"
        onClick={() => setMobileOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setMobileOpen(false) }}
        role="button"
        tabIndex={-1}
        aria-label="Close sidebar"
      />
      <Sidebar
        active={scope}
        collapsed={collapsed}
        needsMeCount={visibleNeedsCount}
        sinceCount={sinceCount}
        watchingCount={0}
        pinnedCount={pinned.length}
        active7dCount={active7dCount}
        allReposCount={repos.length}
        orgs={orgEntries}
        onSelect={onSelectScope}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        footer={<UserFooter viewer={viewer} collapsed={collapsed} onLogout={onLogout} />}
      />

      {selectedRepo ? (
        <RepoBrowser
          token={token}
          repos={repos}
          current={selectedRepo}
          onSelect={onOpenRepo}
          onClose={() => onCloseSelectedRepo?.()}
        />
      ) : (
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
          onTogglePinned={onTogglePinned}
        />
      )}

      <DetailModal
        token={token}
        viewerLogin={viewer?.login}
        item={openItem}
        onClose={() => selectItem(null)}
        onSnooze={handleSnooze}
      />
    </div>
  )
}
