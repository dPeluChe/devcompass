import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRateLimit, fetchTokenInfo, fetchUserOrgsRest, fetchViewer, fetchOrgReposSimple, fetchViewerReposSimple, type Repo, type TokenInfo, type Org } from '../api/github'
import type { ScopeKey } from './home/types'
import { OrgManager } from './OrgManager'
import { SettingsTab } from './SettingsTab'
import { QuickSwitcher, type QSAction } from './QuickSwitcher'
import { ShortcutsHelp } from './ShortcutsHelp'
import { HomeShell } from './home/HomeShell'
import { HomeSkeleton } from './home/HomeSkeleton'
import { Pulse } from './ui'
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import { orgConfigStore } from '../store/orgConfig'
import { cacheRepos, db, getAllCachedRepos, getCachedPref, getPinnedRepos, pinRepo, savePref, unpinRepo, type PinnedRepo } from '../store/db'

export { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'

type Props = { token: string; onLogout: () => void }
type View = 'home' | 'repos' | 'config'

function useViewerData(token: string) {
  const [progressMsg, setProgressMsg] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([])
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [refreshSeq, setRefreshSeq] = useState(0)
  const inFlight = useRef(false)
  
  // 1h IndexedDB TTL on the per-session metadata so reloads don't burn
  // viewer/tokenInfo/userOrgs calls when the cache is still fresh.
  const SCALAR_CACHE_TTL = 60 * 60 * 1000

  const viewerQuery = useQuery({
    queryKey: ['viewer', token],
    queryFn: async () => {
      const cached = await getCachedPref<Awaited<ReturnType<typeof fetchViewer>>>(`viewer:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetchViewer(token)
      await savePref(`viewer:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
  })

  const tokenInfoQuery = useQuery({
    queryKey: ['tokenInfo', token],
    queryFn: async () => {
      const cached = await getCachedPref<Awaited<ReturnType<typeof fetchTokenInfo>>>(`tokenInfo:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetchTokenInfo(token)
      await savePref(`tokenInfo:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
    enabled: !!token,
  })

  const userOrgsQuery = useQuery({
    queryKey: ['userOrgs', token],
    queryFn: async () => {
      const cached = await getCachedPref<Awaited<ReturnType<typeof fetchUserOrgsRest>>>(`userOrgs:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetchUserOrgsRest(token)
      await savePref(`userOrgs:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
    enabled: !!token,
  })

  const rateLimitQuery = useQuery({
    queryKey: ['rateLimit', token],
    queryFn: () => fetchRateLimit(token),
    staleTime: 60 * 1000,
    enabled: !!token,
  })

  const isInitialLoading = viewerQuery.isLoading || tokenInfoQuery.isLoading || rateLimitQuery.isLoading

  const loadReposSequentially = useCallback(async (forceFresh = false) => {
    if (inFlight.current) return
    inFlight.current = true
    const v = viewerQuery.data!
    const restOrgs = userOrgsQuery.data ?? []
    const merged = new Map<string, Org>()
    for (const o of v.organizations.nodes) merged.set(o.login, o)
    for (const o of restOrgs) {
      if (!merged.has(o.login)) {
        merged.set(o.login, { login: o.login, avatarUrl: o.avatar_url, url: o.url })
      }
    }
    const allOrgsList = [{ login: v.login, avatarUrl: v.avatarUrl, url: v.url }, ...merged.values()]
    setOrgs(allOrgsList)
    
    const { setAllOrgs, getEnabledOrgs, getSyncingOrgs, orgNeedsSync, markOrgSynced } = orgConfigStore.getState()
    setAllOrgs(allOrgsList.map(o => ({
      login: o.login,
      avatarUrl: o.avatarUrl,
      enabled: true,
      syncEnabled: true,
      lastSyncedAt: null
    })))
    
    const enabledOrgs = getEnabledOrgs()
    const syncingOrgs = getSyncingOrgs()
    
    setProgressMsg(`Checking local cache for ${enabledOrgs.length} orgs...`)
    
    const byId = new Map<string, Repo>()
    const errs: { source: string; message: string }[] = []
    const cachedByOrg = new Map<string, Repo[]>()
    const sourcesToSync = [v.login, ...syncingOrgs.filter((login) => login !== v.login)]

    // Read ALL cached repos (not just for sourcesToSync logins) so collaborator
    // repos that came in via the viewer's COLLABORATOR affiliation — owned by
    // orgs we never iterate explicitly — survive reloads. The per-org buckets
    // still drive the "needs sync" check below.
    const allCached = await getAllCachedRepos()
    for (const r of allCached) byId.set(r.id, r)
    for (const login of sourcesToSync) cachedByOrg.set(login, [])
    for (const r of allCached) {
      const bucket = cachedByOrg.get(r.owner.login)
      if (bucket) bucket.push(r)
    }

    if (byId.size > 0) {
      setRepos(sortRepos([...byId.values()]))
      setLoadedFromCache(true)
    }

    const orgsToFetch = forceFresh
      ? sourcesToSync.slice()
      : sourcesToSync.filter((login) => {
          const cached = cachedByOrg.get(login) ?? []
          return cached.length === 0 || orgNeedsSync(login)
        })

    if (orgsToFetch.length === 0) {
      setProgressMsg('')
      setErrors([])
      // Treat a no-op refresh as "we've confirmed cache is fresh".
      if (lastSyncAt === null) setLastSyncAt(Date.now())
      inFlight.current = false
      return
    }
    
    for (let i = 0; i < orgsToFetch.length; i++) {
      const login = orgsToFetch[i]
      const current = i + 1
      const total = orgsToFetch.length
      const prefix = byId.size > 0 ? 'Refreshing' : 'Fetching'
      setProgressMsg(`${prefix} repos from @${login} (${current}/${total})`)
      
      try {
        const orgRepos = login === v.login ? await fetchViewerReposSimple(token) : await fetchOrgReposSimple(token, login)
        await cacheRepos(login, orgRepos)
        markOrgSynced(login)
        for (const r of orgRepos) byId.set(r.id, r)
        setRepos(sortRepos([...byId.values()]))
      } catch (e) {
        console.warn(`Failed to load repos from ${login}:`, e)
        errs.push({ source: login, message: e instanceof Error ? e.message : String(e) })
      }
    }

    setRepos(sortRepos([...byId.values()]))
    setErrors(errs)
    setProgressMsg('')
    setLastSyncAt(Date.now())
    inFlight.current = false
  }, [token, viewerQuery.data, userOrgsQuery.data, lastSyncAt])

  useEffect(() => {
    if (viewerQuery.data && userOrgsQuery.data && repos.length === 0) {
      loadReposSequentially()
    }
  }, [viewerQuery.data, userOrgsQuery.data, loadReposSequentially])

  // Manual refresh button — bumps a sequence so the effect re-runs even when
  // repos.length > 0 (the initial-load guard above would otherwise skip).
  useEffect(() => {
    if (refreshSeq === 0) return
    if (!viewerQuery.data || !userOrgsQuery.data) return
    loadReposSequentially(true)
    rateLimitQuery.refetch()
  }, [refreshSeq])

  const refresh = useCallback(async () => {
    // Drop the IDB scalar caches so the next queryFn run goes to the network
    // instead of returning the stored-but-not-yet-TTL'd value. Then refetch
    // the three queries imperatively. Repo sync is handled below via the
    // refreshSeq effect.
    await db.prefs.bulkDelete([`viewer:${token}`, `tokenInfo:${token}`, `userOrgs:${token}`])
    await Promise.all([viewerQuery.refetch(), tokenInfoQuery.refetch(), userOrgsQuery.refetch()])
    setRefreshSeq((n) => n + 1)
  }, [token, viewerQuery, tokenInfoQuery, userOrgsQuery])

  return {
    viewer: viewerQuery.data,
    orgs,
    tokenInfo: tokenInfoQuery.data,
    repos,
    errors,
    rateLimit: rateLimitQuery.data,
    progressMsg,
    isLoading: repos.length === 0 && (isInitialLoading || !!progressMsg),
    isFetching: viewerQuery.isFetching || tokenInfoQuery.isFetching || rateLimitQuery.isFetching || !!progressMsg,
    loadedFromCache,
    lastSyncAt,
    refresh,
    error: viewerQuery.error || null
  }
}

function sortRepos(repos: Repo[]): Repo[] {
  return repos.sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
}

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
          <div className="user">
            {data.viewer && <img src={data.viewer.avatarUrl} alt="" width={24} height={24} />}
            <strong>@{data.viewer?.login ?? '...'}</strong>
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

            <span className="sync-indicator" title={data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'Not synced yet'}>
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
            {data.rateLimit && (
              <span title={`Rate limit resets ${new Date(data.rateLimit.resetAt).toLocaleTimeString()}`}>
                {data.rateLimit.remaining}/{data.rateLimit.limit}
              </span>
            )}

            <button className="link-btn" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">?</button>
            <button className="link-btn" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {(data.isLoading || data.progressMsg) && !selected && view !== 'config' ? (
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

function timeAgoShort(ms: number): string {
  const diff = Date.now() - ms
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function ConfigView({
  tokenInfo,
  orgs,
  repos,
  errors,
  onForceResync
}: {
  tokenInfo: TokenInfo | undefined
  orgs: Org[]
  repos: Repo[]
  errors: { source: string; message: string }[]
  onForceResync: () => void
}) {
  const [section, setSection] = useState<'orgs' | 'token' | 'storage' | 'cache' | 'pinned'>('orgs')

  // Collaborator-only orgs: own at least one repo that arrived via the viewer's
  // COLLABORATOR affiliation but aren't in viewer.organizations / /user/orgs.
  const collaboratorOrgs = useMemo(() => {
    const memberSet = new Set(orgs.map((o) => o.login))
    const counts = new Map<string, { count: number; avatarUrl: string }>()
    for (const r of repos) {
      if (memberSet.has(r.owner.login)) continue
      const cur = counts.get(r.owner.login)
      if (cur) cur.count += 1
      else counts.set(r.owner.login, { count: 1, avatarUrl: r.owner.avatarUrl })
    }
    return Array.from(counts.entries())
      .map(([login, v]) => ({ login, count: v.count, avatarUrl: v.avatarUrl }))
      .toSorted((a, b) => b.count - a.count || a.login.localeCompare(b.login))
  }, [orgs, repos])

  return (
    <main className="hs-main config-view">
      <div className="config-tabs">
        <button className={`config-tab ${section === 'orgs' ? 'active' : ''}`} onClick={() => setSection('orgs')}>
          Orgs
        </button>
        <button className={`config-tab ${section === 'token' ? 'active' : ''}`} onClick={() => setSection('token')}>
          Token
        </button>
        <button className={`config-tab ${section === 'storage' ? 'active' : ''}`} onClick={() => setSection('storage')}>
          Storage
        </button>
        <button className={`config-tab ${section === 'cache' ? 'active' : ''}`} onClick={() => setSection('cache')}>
          Cache
        </button>
        <button className={`config-tab ${section === 'pinned' ? 'active' : ''}`} onClick={() => setSection('pinned')}>
          Pinned
        </button>
      </div>

      <div className="config-panel">
        {section === 'orgs' && (
          <section className="config-section">
            <div className="config-section-header">
              <h2>Organizations</h2>
              <span className="muted">Choose which orgs are available and synced.</span>
            </div>
            <OrgManager orgs={orgs} variant="inline" />

            {collaboratorOrgs.length > 0 && (
              <div className="config-collab-block">
                <div className="config-section-header" style={{ marginTop: 18 }}>
                  <h3>Collaborator orgs</h3>
                  <span className="muted">
                    You have repo access here but aren't a formal member.
                    Their repos sync as part of your own viewer affiliation —
                    no separate toggle.
                  </span>
                </div>
                <ul className="config-collab-list">
                  {collaboratorOrgs.map((c) => (
                    <li key={c.login}>
                      <img src={c.avatarUrl} alt="" />
                      <strong>{c.login}</strong>
                      <span className="muted">{c.count} repo{c.count === 1 ? '' : 's'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {section === 'token' && tokenInfo && (
          <section className="config-section">
            <div className="config-section-header">
              <h2>Token access</h2>
              <span className="muted">Scopes, SSO and org visibility.</span>
            </div>
            <TokenAccessPanel tokenInfo={tokenInfo} orgs={orgs} />
            {errors.length > 0 && (
              <details className="partial-errors" open>
                <summary>{errors.length} sync errors</summary>
                <ul>
                  {errors.map((e) => (
                    <li key={e.source}>
                      <strong>{e.source}:</strong> {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {section === 'token' && !tokenInfo && (
          <section className="config-section">
            <p className="muted">Token information is still loading.</p>
          </section>
        )}

        {section === 'storage' && <SettingsTab panel="storage" onForceResync={onForceResync} />}
        {section === 'cache' && <SettingsTab panel="cache" onForceResync={onForceResync} />}
        {section === 'pinned' && <SettingsTab panel="pinned" />}
      </div>
    </main>
  )
}

function TokenAccessPanel({ tokenInfo, orgs }: { tokenInfo: TokenInfo; orgs: Org[] }) {
  if (!tokenInfo) return null

  const hasReadOrg = tokenInfo.scopes.includes('read:org') || tokenInfo.scopes.includes('admin:org')
  const missingReadOrg = tokenInfo.type === 'classic' && !hasReadOrg
  const noOrgs = orgs.length === 0
  const ssoIssue = !!tokenInfo.ssoRequired
  const hasIssue = missingReadOrg || ssoIssue || (noOrgs && tokenInfo.type === 'fine-grained')
  const ok = !hasIssue

  return (
    <div className="token-panel">
      <div className="token-summary">
        <div className={`token-status ${ok ? 'ok' : 'warn'}`}>
          <span className="token-status-dot">{ok ? '●' : '⚠'}</span>
          <span>{ok ? 'Ready' : 'Needs review'}</span>
        </div>
        <div>
          <span className="stat-value">{tokenInfo.type}</span>
          <span className="stat-label">Token type</span>
        </div>
        <div>
          <span className="stat-value">{orgs.length}</span>
          <span className="stat-label">Visible orgs</span>
        </div>
        <div>
          <span className="stat-value">{tokenInfo.scopes.length || '0'}</span>
          <span className="stat-label">Scopes</span>
        </div>
      </div>

      <div className="token-block">
        <h3>Scopes</h3>
        {tokenInfo.scopes.length > 0 ? (
          <div className="diag-row">
            {tokenInfo.scopes.map((s) => (
              <span key={s} className="diag-pill">{s}</span>
            ))}
          </div>
        ) : (
          <p className="muted">No scopes reported by GitHub for this token.</p>
        )}
      </div>

      <div className="token-block">
        <h3>Organizations</h3>
        {orgs.length > 0 ? (
          <div className="diag-orgs">
            {orgs.map((o) => (
              <a key={o.login} href={o.url} target="_blank" rel="noreferrer" title={o.login}>
                <img src={o.avatarUrl} alt={o.login} width={20} height={20} />
                <span>{o.login}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">No organizations are visible with this token.</p>
        )}
      </div>

      {hasIssue && (
        <div className="token-block">
          <h3>Action needed</h3>
          <ul className="diag-issues">
            {missingReadOrg && (
              <li>
                PAT classic without <code>read:org</code> or <code>admin:org</code>. Edit at{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">settings/tokens</a>.
              </li>
            )}
            {tokenInfo.type === 'fine-grained' && noOrgs && (
              <li>
                Fine-grained PATs only see approved orgs. Consider a classic with <code>repo</code> + <code>read:org</code>.
              </li>
            )}
            {ssoIssue && (
              <li>
                Missing SAML SSO authorization for some orgs.{' '}
                <a href={tokenInfo.ssoRequired!.url} target="_blank" rel="noreferrer">Authorize</a>.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

