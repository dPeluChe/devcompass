import { useEffect, useMemo, useState } from 'react'
import type { Repo } from '../api/github'
import { syncTitle, timeAgoShort } from '../utils/topbar'
import { DEMO_TOKEN } from '../api/demo/token'
import type { ScopeKey } from './home/types'
import { ConfigView } from './ConfigView'
import { QuickSwitcher, type QSAction } from './QuickSwitcher'
import { ShortcutsHelp } from './ShortcutsHelp'
import { HomeShell } from './home/HomeShell'
import { HomeSkeleton } from './home/HomeSkeleton'
import { Pulse } from './ui'
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import { useViewerData } from '../hooks/useViewerData'
import { isLowFor } from '../store/rateGate'
import { getPinnedRepos, pinRepo, unpinRepo, type PinnedRepo } from '../store/db'

export { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'

type Props = { token: string; onLogout: () => void }
type View = 'home' | 'repos' | 'config'

export function Dashboard({ token, onLogout }: Props) {
  const data = useViewerData(token)

  const [view, setView] = useState<View>('home')
  // Sidebar scope lives here (not inside HomeShell) so the topbar tabs can flip
  // it without re-mounting the shell — avoids the effect-as-handler smell from
  // syncing an `initialScope` prop into local state.
  const [scope, setScope] = useState<ScopeKey>('digest')
  const [selected, setSelected] = useState<{ owner: string; name: string } | null>(null)
  const [pinned, setPinned] = useState<PinnedRepo[]>([])
  const [qsOpen, setQsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    getPinnedRepos()
      .then(setPinned)
      .catch((e) => console.warn('Failed to load pinned repos:', e))
  }, [])

  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.repoId)), [pinned])

  async function handleTogglePinned(repo: Repo) {
    if (pinnedIds.has(repo.id)) {
      await unpinRepo(repo.id)
    } else {
      await pinRepo(repo.id, repo.nameWithOwner)
    }
    setPinned(await getPinnedRepos())
  }

  function gotoView(target: View) {
    setView(target)
    setSelected(null)
    if (target === 'home') setScope('needs')
    else if (target === 'repos') setScope('repos')
  }

  // Sidebar item clicks always exit config / detail and land on the chosen scope.
  // Mirrors topbar tab behavior so navigation feels coherent.
  function handleScopeChange(key: ScopeKey) {
    setScope(key)
    setSelected(null)
    setView(key === 'repos' ? 'repos' : 'home')
  }

  function handleQuickPick(action: QSAction) {
    if (action.kind === 'view') {
      gotoView(action.view)
      return
    }
    if (action.kind === 'scope') {
      handleScopeChange(action.scope)
      return
    }
    if (action.kind === 'repo') {
      setSelected({ owner: action.repo.owner.login, name: action.repo.name })
      setView('repos')
      return
    }
    // PR pick — open in Home via the ?pr=owner/name/number deep-link that
    // HomeShell reads on mount to pop the DetailModal. Avoids the dead PRs
    // view we removed.
    const pr = `${action.repo.owner.login}/${action.repo.name}/${action.pr.number}`
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('pr', pr)
      window.history.replaceState({}, '', url.toString())
    } catch { /* ignore */ }
    setSelected(null)
    setView('home')
  }

  useGlobalShortcuts({
    onQuickSwitcher: () => { setHelpOpen(false); setQsOpen(true) },
    onHelp: () => { setQsOpen(false); setHelpOpen((v) => !v) },
    onGoHome: () => gotoView('home'),
    onGoRepos: () => gotoView('repos'),
    onGoConfig: () => gotoView('config'),
    // The repo grid no longer has its own search input — chips replaced it.
    // "/" now opens the QuickSwitcher, which is the cross-app search anyway.
    onFocusSearch: () => { setHelpOpen(false); setQsOpen(true) },
    onEscape: () => {
      if (qsOpen) setQsOpen(false)
      else if (helpOpen) setHelpOpen(false)
    }
  })

  if (data.error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <pre>{data.error instanceof Error ? data.error.message : String(data.error)}</pre>
        <button onClick={onLogout}>Change token</button>
      </div>
    )
  }

  const isSyncing = !!data.progressMsg

  return (
    <div className="dashboard">
      <div className="main-col">
        <header className="topbar topbar-sticky">
          <a className="topbar-brand" href="https://github.com/dPeluChe/devcompass" target="_blank" rel="noreferrer" title="devcompass">
            <img src="/favicon.svg" width="26" height="26" alt="devcompass" />
          </a>
          <div className="user">
            {data.viewer && <img src={data.viewer.avatarUrl} alt="" width={24} height={24} />}
            <strong>@{data.viewer?.login ?? '...'}</strong>
            {token === DEMO_TOKEN && <span className="demo-badge">demo</span>}
          </div>

          <nav className="view-tabs" aria-label="Primary">
            <button className={`view-tab ${view === 'home' ? 'active' : ''}`} onClick={() => gotoView('home')} title="Home (g h)">
              Home
            </button>
            <button className={`view-tab ${view === 'repos' ? 'active' : ''}`} onClick={() => gotoView('repos')} title="Repos (g r)">
              Repos
            </button>
            <button className={`view-tab ${view === 'config' ? 'active' : ''}`} onClick={() => gotoView('config')} title="Config (g c)">
              Config
            </button>
          </nav>

          <div className="meta muted">
            <button
              className="qs-trigger"
              onClick={() => setQsOpen(true)}
              title="Quick switcher (⌘K)"
            >
              <span className="qs-trigger-text">Jump to…</span>
              <span className="qs-trigger-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
            </button>

            <span className="topbar-status">
              <span
                className="sync-indicator"
                title={syncTitle(data.lastSyncAt, isSyncing, data.progressMsg, data.rateLimit, isLowFor)}
              >
                {isSyncing ? (
                  <Pulse>{data.progressMsg || 'Syncing...'}</Pulse>
                ) : (
                  <>
                    <span className={`sync-dot ${data.lastSyncAt ? 'ok' : 'cold'}`} />
                    {data.lastSyncAt ? `Synced ${timeAgoShort(data.lastSyncAt)}` : 'Not synced'}
                  </>
                )}
              </span>

              <button
                className="refresh-btn"
                onClick={() => data.refresh()}
                disabled={isSyncing}
                title="Force refresh from GitHub"
              >
                ↻
              </button>

              {!data.isLoading && (
                <span className="meta-summary">
                  {data.repos.length} repos · {data.viewer?.organizations.nodes.length ?? 0} orgs
                  {data.loadedFromCache && data.isFetching ? ' · cache' : ''}
                </span>
              )}

              {data.rateLimit && isLowFor(data.rateLimit.remaining, data.rateLimit.limit) && (
                <span
                  className="rate-low"
                  title={`API quota nearly exhausted — background refresh paused until ${new Date(data.rateLimit.resetAt).toLocaleTimeString()}`}
                >
                  ⚠ {data.rateLimit.remaining}/{data.rateLimit.limit}
                </span>
              )}
            </span>

            <span className="topbar-actions">
              <button className="link-btn" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
              </button>
              <button className="link-btn" onClick={onLogout}>Logout</button>
            </span>
          </div>
        </header>

        {/* Skeleton only when there's nothing cached to show yet. Once cached
            repos are painted (data.isLoading is false), keep rendering them and
            let the background refresh run silently — the topbar shows "· cache". */}
        {data.isLoading && !selected && view !== 'config' ? (
          <HomeSkeleton progressMsg={data.progressMsg} />
        ) : (
          <HomeShell
            token={token}
            viewer={data.viewer}
            repos={data.repos}
            pinned={pinned}
            memberOrgs={data.orgs}
            scope={scope}
            onScopeChange={handleScopeChange}
            selectedRepo={selected}
            mainSlot={view === 'config' ? (
              <ConfigView
                tokenInfo={data.tokenInfo}
                orgs={data.orgs}
                repos={data.repos}
                errors={data.errors}
                onForceResync={data.refresh}
                onGoNeeds={() => gotoView('home')}
              />
            ) : undefined}
            onOpenRepo={(repo) => {
              setSelected({ owner: repo.owner.login, name: repo.name })
              setView('repos')
            }}
            onCloseSelectedRepo={() => setSelected(null)}
            onTogglePinned={handleTogglePinned}
            onLogout={onLogout}
          />
        )}
      </div>

      <QuickSwitcher
        open={qsOpen}
        onClose={() => setQsOpen(false)}
        onPick={handleQuickPick}
        repos={data.repos}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

