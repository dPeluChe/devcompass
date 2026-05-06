import { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRateLimit, fetchTokenInfo, fetchUserOrgsRest, fetchViewer, fetchOrgReposSimple, fetchViewerReposSimple, type Repo, type TokenInfo, type Org } from '../api/github'
import { RepoDetail } from './RepoDetail'
import { PRInbox } from './PRInbox'
import { OrgManager } from './OrgManager'
import { SettingsTab } from './SettingsTab'
import { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'
import { orgConfigStore } from '../store/orgConfig'
import { cacheRepos, getCachedRepos, getPinnedRepos, getPref, pinRepo, savePref, unpinRepo, type PinnedRepo } from '../store/db'
import { FaPython, FaJs, FaJava, FaVuejs, FaReact, FaAngular, FaNode, FaDatabase, FaLock, FaCodeBranch, FaExclamationCircle, FaStar } from 'react-icons/fa'
import { SiTypescript, SiGo, SiRust, SiMysql, SiMongodb } from 'react-icons/si'
import { VscJson, VscSymbolMisc } from 'react-icons/vsc'

export { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'

type Props = { token: string; onLogout: () => void }
type View = 'home' | 'repos' | 'prs' | 'config'
type GroupBy = 'none' | 'owner' | 'language' | 'activity'
type RepoScope = 'all' | 'pinned'
type IconType = typeof FaPython
type RepoSignalLevel = 'critical' | 'attention' | 'active' | 'quiet'
type WaitingOn = 'PR_OPEN' | 'TRIAGE' | 'ACTIVITY' | 'NONE'
type HealthLabel = 'pr open' | 'active' | 'stale' | 'healthy' | 'quiet' | 'archived'
type RepoSignal = {
  level: RepoSignalLevel
  label: string
  reasons: string[]
  primaryReasons: string[]
  secondaryReasons: string[]
  health: HealthLabel
  waitingOn: WaitingOn
  activityLabel: string
  score: number
}
type RepoVisitSnapshot = Record<string, { pushedAt: string; openPRs: number; openIssues: number }>

function useViewerData(token: string) {
  const [progressMsg, setProgressMsg] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([])
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  
  const viewerQuery = useQuery({
    queryKey: ['viewer', token],
    queryFn: () => fetchViewer(token),
    staleTime: 30 * 60 * 1000,
  })

  const tokenInfoQuery = useQuery({
    queryKey: ['tokenInfo', token],
    queryFn: () => fetchTokenInfo(token),
    staleTime: 30 * 60 * 1000,
    enabled: !!token,
  })

  const userOrgsQuery = useQuery({
    queryKey: ['userOrgs', token],
    queryFn: () => fetchUserOrgsRest(token),
    staleTime: 30 * 60 * 1000,
    enabled: !!token,
  })

  const rateLimitQuery = useQuery({
    queryKey: ['rateLimit', token],
    queryFn: () => fetchRateLimit(token),
    staleTime: 60 * 1000,
    enabled: !!token,
  })

  const isInitialLoading = viewerQuery.isLoading || tokenInfoQuery.isLoading || rateLimitQuery.isLoading

  const loadReposSequentially = useCallback(async () => {
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

    await Promise.all(sourcesToSync.map(async (login) => {
      const cached = await getCachedRepos(login)
      cachedByOrg.set(login, cached)
      for (const r of cached) byId.set(r.id, r)
    }))

    if (byId.size > 0) {
      setRepos(sortRepos([...byId.values()]))
      setLoadedFromCache(true)
    }

    const orgsToFetch = sourcesToSync.filter((login) => {
      const cached = cachedByOrg.get(login) ?? []
      return cached.length === 0 || orgNeedsSync(login)
    })

    if (orgsToFetch.length === 0) {
      setProgressMsg('')
      setErrors([])
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
  }, [token, viewerQuery.data, userOrgsQuery.data])

  useEffect(() => {
    if (viewerQuery.data && userOrgsQuery.data && repos.length === 0) {
      loadReposSequentially()
    }
  }, [viewerQuery.data, userOrgsQuery.data, loadReposSequentially])

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
    error: viewerQuery.error || null
  }
}

function sortRepos(repos: Repo[]): Repo[] {
  return repos.sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
}

export function Dashboard({ token, onLogout }: Props) {
  const data = useViewerData(token)
  
  const [view, setView] = useState<View>('home')
  const [repoScope, setRepoScope] = useState<RepoScope>('all')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [hideArchived, setHideArchived] = useState(true)
  const [hideForks, setHideForks] = useState(false)
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [activityWindow, setActivityWindow] = useState<number>(90)
  const [selected, setSelected] = useState<{ owner: string; name: string } | null>(null)
  const [pinned, setPinned] = useState<PinnedRepo[]>([])
  const [pinnedLoaded, setPinnedLoaded] = useState(false)
  const [visitSnapshot, setVisitSnapshot] = useState<RepoVisitSnapshot | null>(null)

  useEffect(() => {
    getPinnedRepos()
      .then((items) => {
        setPinned(items)
        if (items.length > 0) setRepoScope('pinned')
      })
      .catch((e) => console.warn('Failed to load pinned repos:', e))
      .finally(() => setPinnedLoaded(true))
  }, [])

  useEffect(() => {
    getPref<RepoVisitSnapshot | null>('home.repoVisitSnapshot', null)
      .then(setVisitSnapshot)
      .catch((e) => console.warn('Failed to load visit snapshot:', e))
  }, [])

  useEffect(() => {
    if (pinnedLoaded && pinned.length === 0 && repoScope === 'pinned') setRepoScope('all')
  }, [pinned.length, pinnedLoaded, repoScope])

  const baseFiltered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const cutoff = activityWindow > 0 ? Date.now() - activityWindow * 86_400_000 : 0
    return data.repos.filter((r) => {
      if (hideArchived && r.isArchived) return false
      if (hideForks && r.isFork) return false
      if (cutoff && new Date(r.pushedAt).getTime() < cutoff) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.nameWithOwner.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.primaryLanguage?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [data.repos, search, hideArchived, hideForks, activityWindow])

  const filtered = useMemo(() => {
    if (selectedOwners.length === 0) return baseFiltered
    const selected = new Set(selectedOwners)
    return baseFiltered.filter((r) => selected.has(r.owner.login))
  }, [baseFiltered, selectedOwners])

  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.repoId)), [pinned])
  const pinnedOrder = useMemo(() => new Map(pinned.map((p, i) => [p.repoId, i])), [pinned])
  const scopedFiltered = useMemo(() => {
    if (repoScope === 'pinned') return filtered.filter((r) => pinnedIds.has(r.id))
    return filtered
  }, [filtered, pinnedIds, repoScope])
  const pinnedRepos = useMemo(() => {
    return scopedFiltered
      .filter((r) => pinnedIds.has(r.id))
      .sort((a, b) => (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0))
  }, [scopedFiltered, pinnedIds, pinnedOrder])
  const unpinnedFiltered = useMemo(() => {
    if (repoScope === 'pinned') return []
    return scopedFiltered.filter((r) => !pinnedIds.has(r.id))
  }, [scopedFiltered, pinnedIds, repoScope])

  const groups = useMemo(() => groupRepos(unpinnedFiltered, groupBy), [unpinnedFiltered, groupBy])
  const home = useMemo(() => buildHomeModel(data.repos, pinnedIds, pinnedOrder, visitSnapshot), [data.repos, pinnedIds, pinnedOrder, visitSnapshot])

  const owners = useMemo(() => {
    const totalCounts = new Map<string, number>()
    const filteredCounts = new Map<string, number>()
    for (const r of data.repos) totalCounts.set(r.owner.login, (totalCounts.get(r.owner.login) ?? 0) + 1)
    for (const r of baseFiltered) filteredCounts.set(r.owner.login, (filteredCounts.get(r.owner.login) ?? 0) + 1)
    const orgLogins = data.orgs.length > 0 ? data.orgs.map((org) => org.login) : [...new Set(data.repos.map((r) => r.owner.login))]
    return orgLogins
      .map((login) => ({
        login,
        totalCount: totalCounts.get(login) ?? 0,
        filteredCount: filteredCounts.get(login) ?? 0
      }))
      .sort((a, b) => b.totalCount - a.totalCount || a.login.localeCompare(b.login))
  }, [baseFiltered, data.orgs, data.repos])

  async function handleTogglePinned(repo: Repo) {
    if (pinnedIds.has(repo.id)) {
      await unpinRepo(repo.id)
    } else {
      await pinRepo(repo.id, repo.nameWithOwner)
    }
    setPinned(await getPinnedRepos())
  }

  function toggleOwner(login: string) {
    const owner = owners.find((item) => item.login === login)
    if (owner && owner.filteredCount === 0 && owner.totalCount > 0) {
      setActivityWindow(0)
      setSearch('')
    }
    setSelectedOwners((current) => {
      if (current.includes(login)) return current.filter((item) => item !== login)
      return [...current, login]
    })
  }

  function showAllRepos() {
    setRepoScope('all')
    setSelectedOwners([])
    setSearch('')
    setActivityWindow(0)
    setHideArchived(false)
    setHideForks(false)
  }

  async function markHomeSeen() {
    const snapshot = buildVisitSnapshot(data.repos)
    await savePref('home.repoVisitSnapshot', snapshot)
    setVisitSnapshot(snapshot)
  }

  if (data.error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <pre>{data.error instanceof Error ? data.error.message : String(data.error)}</pre>
        <button onClick={onLogout}>Change token</button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="main-col">
        <header className="topbar">
          <div className="user">
            {data.viewer && <img src={data.viewer.avatarUrl} alt="" width={24} height={24} />}
            <strong>@{data.viewer?.login ?? '...'}</strong>
          </div>

          <nav className="view-tabs">
            <button className={`view-tab ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
              Home
            </button>
            <button className={`view-tab ${view === 'repos' ? 'active' : ''}`} onClick={() => setView('repos')}>
              Repos
            </button>
            <button className={`view-tab ${view === 'prs' ? 'active' : ''}`} onClick={() => setView('prs')}>
              PRs
            </button>
            <button className={`view-tab ${view === 'config' ? 'active' : ''}`} onClick={() => setView('config')}>
              Config
            </button>
          </nav>

          <div className="meta muted">
            {(data.isLoading || data.progressMsg) && (
              <span>
                <Pulse>{data.progressMsg || 'Loading...'}</Pulse>
              </span>
            )}
            {!data.isLoading && !data.progressMsg && (
              <span>
                {view === 'home'
                  ? `${home.priority.critical.length} critical · ${home.summary.reviewDebtRepos} review debt · ${data.repos.length} repos`
                  : view === 'repos'
                    ? `${scopedFiltered.length}/${data.repos.length} repos`
                    : `${data.repos.length} repos`} · {data.viewer?.organizations.nodes.length ?? 0} orgs
                {data.loadedFromCache && data.isFetching ? ' · local cache' : ''}
              </span>
            )}
            {data.rateLimit && <span>· {data.rateLimit.remaining}/{data.rateLimit.limit}</span>}
            <button className="link-btn" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {view === 'home' && (
          <>
            {(data.isLoading || data.progressMsg) ? (
              <LoadingSkeleton progressMsg={data.progressMsg} />
            ) : (
              <HomeView
                model={home}
                onMarkSeen={markHomeSeen}
                onOpenRepo={(repo) => {
                  setSelected({ owner: repo.owner.login, name: repo.name })
                  setView('repos')
                }}
                onOpenRepos={() => setView('repos')}
                onOpenPRs={() => setView('prs')}
              />
            )}
          </>
        )}

        {view === 'prs' && data.viewer && <PRInbox token={token} viewer={data.viewer} />}

        {view === 'config' && (
          <ConfigView
            tokenInfo={data.tokenInfo}
            orgs={data.orgs}
            errors={data.errors}
          />
        )}

        {view === 'repos' && selected && (
          <RepoBrowser
            token={token}
            repos={scopedFiltered}
            current={selected}
            onSelect={(r) => setSelected({ owner: r.owner.login, name: r.name })}
            onClose={() => setSelected(null)}
          />
        )}

        {view === 'repos' && !selected && (
          <>
            {(data.isLoading || data.progressMsg) ? (
              <LoadingSkeleton progressMsg={data.progressMsg} />
            ) : (
              <>
                <div className="controls">
                  <div className="org-chips">
                    <button
                      className={`org-chip scope-chip ${repoScope === 'all' && selectedOwners.length === 0 ? 'active' : ''}`}
                      onClick={showAllRepos}
                      title="Show all loaded repos"
                    >
                      <span className="org-label">All</span>
                      <span className="chip-count">{data.repos.length}</span>
                    </button>
                    <button
                      className={`org-chip scope-chip ${repoScope === 'pinned' ? 'active' : ''} ${pinned.length === 0 ? 'empty' : ''}`}
                      onClick={() => pinned.length > 0 && setRepoScope(repoScope === 'pinned' ? 'all' : 'pinned')}
                      disabled={pinned.length === 0}
                      title={pinned.length > 0 ? 'Show pinned repos' : 'No pinned repos yet'}
                    >
                      <span className="org-label">Pinned</span>
                      <span className="chip-count">{pinned.length}</span>
                    </button>
                    {owners.map(({ login, totalCount, filteredCount }) => {
                      const org = data.orgs.find(o => o.login === login)
                      const selected = selectedOwners.includes(login)
                      const label = login === data.viewer?.login ? 'Personal' : login
                      return (
                        <button
                          key={login}
                          className={`org-chip org-filter-chip ${selected ? 'active' : ''} ${filteredCount === 0 ? 'empty' : ''}`}
                          onClick={() => toggleOwner(login)}
                          aria-pressed={selected}
                          title={`${label} (${login}): ${filteredCount} matching current filters / ${totalCount} total`}
                        >
                          {org?.avatarUrl && <img src={org.avatarUrl} alt="" className="chip-avatar" />}
                          <span className="org-label">{label}</span>
                          <span className="chip-count">{totalCount}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="filter-row">
                    <input
                      className="compact-search"
                      type="search"
                      placeholder="Search repos..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <select value={activityWindow} onChange={(e) => setActivityWindow(Number(e.target.value))}>
                      <option value={7}>Active 7d</option>
                      <option value={30}>Active 30d</option>
                      <option value={90}>Active 3m</option>
                      <option value={180}>Active 6m</option>
                      <option value={365}>Active 1y</option>
                      <option value={0}>All</option>
                    </select>
                    <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
                      <option value="none">Recent first</option>
                      <option value="activity">By activity</option>
                      <option value="owner">By owner</option>
                      <option value="language">By language</option>
                    </select>
                    <label>
                      <input type="checkbox" checked={hideArchived} onChange={(e) => setHideArchived(e.target.checked)} />
                      No archived
                    </label>
                    <label>
                      <input type="checkbox" checked={hideForks} onChange={(e) => setHideForks(e.target.checked)} />
                      No forks
                    </label>
                  </div>
                </div>

                <main>
                  {pinnedRepos.length > 0 && (
                    <section className="group pinned-group">
                      <h2>
                        Pinned <span className="muted">({pinnedRepos.length})</span>
                      </h2>
                      <div className="grid">
                        {pinnedRepos.map((r) => (
                          <RepoCard
                            key={r.id}
                            repo={r}
                            pinned
                            onTogglePinned={() => handleTogglePinned(r)}
                            onSelect={() => setSelected({ owner: r.owner.login, name: r.name })}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {groups.map(([group, items]) => (
                    <section key={group || '_'} className="group">
                      {group && (
                        <h2>
                          {group} <span className="muted">({items.length})</span>
                        </h2>
                      )}
                      <div className="grid">
                        {items.map((r) => (
                          <RepoCard
                            key={r.id}
                            repo={r}
                            pinned={pinnedIds.has(r.id)}
                            onTogglePinned={() => handleTogglePinned(r)}
                            onSelect={() => setSelected({ owner: r.owner.login, name: r.name })}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </main>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function HomeView({
  model,
  onMarkSeen,
  onOpenRepo,
  onOpenRepos,
  onOpenPRs
}: {
  model: HomeModel
  onMarkSeen: () => void
  onOpenRepo: (repo: Repo) => void
  onOpenRepos: () => void
  onOpenPRs: () => void
}) {
  return (
    <main className="home-view">
      <section className="home-summary">
        <button className="home-stat attention" onClick={onOpenPRs}>
          <span className="stat-value">{model.summary.criticalRepos}</span>
          <span className="stat-label">Critical</span>
        </button>
        <button className="home-stat warning" onClick={onOpenRepos}>
          <span className="stat-value">{model.summary.reviewDebtRepos}</span>
          <span className="stat-label">Review debt</span>
        </button>
        <button className="home-stat stale" onClick={onOpenRepos}>
          <span className="stat-value">{model.summary.stalePrRepos}</span>
          <span className="stat-label">Stale PRs</span>
        </button>
        <button className="home-stat quiet" onClick={onOpenRepos}>
          <span className="stat-value">{model.summary.quietRepos}</span>
          <span className="stat-label">Quiet hidden</span>
        </button>
      </section>

      <section className="home-section since-section">
        <div className="home-section-header">
          <div>
            <h2>Since Last Visit</h2>
            <p className="muted">Local snapshot comparison. Nothing leaves this browser.</p>
          </div>
          <button className="mark-seen-btn" onClick={onMarkSeen}>Mark seen</button>
        </div>
        {model.sinceLastVisit.length === 1 && model.sinceLastVisit[0].key === 'baseline' ? (
          <button className="since-baseline" onClick={onMarkSeen}>
            <span className="status-dot status-quiet" />
            <span>No baseline yet.</span>
            <strong>Start tracking</strong>
          </button>
        ) : (
          <div className="since-list">
            {model.sinceLastVisit.length > 0 ? (
            model.sinceLastVisit.map((event) => (
              <button
                key={event.key}
                className={`since-item since-${event.level}`}
                onClick={event.repo ? () => onOpenRepo(event.repo!) : event.target === 'prs' ? onOpenPRs : onOpenRepos}
              >
                <span className={`status-dot status-${event.level}`} />
                <span>{event.text}</span>
              </button>
            ))
            ) : (
              <div className="since-empty">No new repo signals since the last saved snapshot.</div>
            )}
          </div>
        )}
      </section>

      <section className="home-section pinned-center-section">
        <div className="home-section-header">
          <div>
            <h2>Pinned Control Center</h2>
            <p className="muted">{model.summary.pinnedRepos} pinned systems.</p>
          </div>
        </div>
        <div className="pinned-control">
          {model.pinnedRepos.length > 0 && (
            <div className="pinned-control-head">
              <span>Health</span>
              <span>Repo</span>
              <span>PR</span>
              <span>Issues</span>
              <span>Last</span>
              <span>State</span>
            </div>
          )}
          {model.pinnedRepos.map((repo) => (
            <PinnedControlRow key={repo.id} repo={repo} onOpen={() => onOpenRepo(repo)} />
          ))}
          {model.pinnedRepos.length === 0 && <p className="muted empty">Pin active repos to make this home screen useful.</p>}
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-header">
          <div>
            <h2>Needs Attention</h2>
            <p className="muted">Prioritized by operational signals. Quiet repos stay out of the default Home.</p>
          </div>
        </div>
        {model.priority.critical.length === 0 && model.priority.reviewNeeded.length === 0 && model.priority.stalePrs.length === 0 && model.priority.recentWork.length === 0 ? (
          <p className="muted empty">No attention signals from the current repo data.</p>
        ) : (
          <div className="priority-groups">
            {model.priority.critical.length > 0 && (
              <PriorityGroup
                title="Critical"
                items={model.priority.critical}
                onOpenRepo={onOpenRepo}
              />
            )}
            {model.priority.reviewNeeded.length > 0 && (
              <PriorityGroup
                title="Review Needed"
                items={model.priority.reviewNeeded}
                onOpenRepo={onOpenRepo}
              />
            )}
            {model.priority.stalePrs.length > 0 && (
              <PriorityGroup
                title="Stale PRs"
                items={model.priority.stalePrs}
                onOpenRepo={onOpenRepo}
              />
            )}
            {model.priority.recentWork.length > 0 && (
              <PriorityGroup
                title="Recent Work"
                items={model.priority.recentWork}
                onOpenRepo={onOpenRepo}
              />
            )}
            {model.priority.quietCount > 0 && (
              <div className="quiet-summary">
                {model.priority.quietCount} quiet repos hidden from Home.
              </div>
            )}
          </div>
        )}
      </section>

      <div className="home-columns">
        <section className="home-section">
          <h2>Active Work</h2>
          <div className="compact-repo-list">
            {model.activeWork.map((repo) => (
              <CompactRepoRow key={repo.id} repo={repo} onOpen={() => onOpenRepo(repo)} />
            ))}
            {model.activeWork.length === 0 && <p className="muted empty">No repos pushed in the last 7 days.</p>}
          </div>
        </section>

        <section className="home-section">
          <h2>Operational Digest</h2>
          <div className="digest-list">
            {model.digest.map((item) => (
              <button key={item.text} className={`digest-item digest-${item.level}`} onClick={item.target === 'prs' ? onOpenPRs : onOpenRepos}>
                <span className={`status-dot status-${item.level}`} />
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function PriorityGroup({
  title,
  items,
  onOpenRepo
}: {
  title: string
  items: RepoAttention[]
  onOpenRepo: (repo: Repo) => void
}) {
  const key = title.toLowerCase().replace(/\s+/g, '-')
  return (
    <section className={`priority-group priority-${key}`}>
      <h3>{title}</h3>
      <div className="attention-list">
        {items.map((item) => (
          <RepoAttentionRow key={item.repo.id} item={item} onOpen={() => onOpenRepo(item.repo)} />
        ))}
      </div>
    </section>
  )
}

function RepoAttentionRow({ item, onOpen }: { item: RepoAttention; onOpen: () => void }) {
  const { repo, signal } = item
  return (
    <button className={`attention-row signal-${signal.level}`} onClick={onOpen}>
      <span className={`status-dot status-${signal.level}`} />
      <span className="attention-main">
        <strong>{repo.nameWithOwner}</strong>
        {signal.level === 'critical' && (
          <span className="critical-summary">
            {criticalSummary(repo, signal)}
          </span>
        )}
        <span className="why-line">
          <span className="why-label">Why</span>
          {signal.primaryReasons.map((reason) => (
            <span key={reason} className="reason-chip primary">{reason}</span>
          ))}
          {signal.secondaryReasons.slice(0, 2).map((reason) => (
            <span key={reason} className="reason-chip secondary">{reason}</span>
          ))}
        </span>
      </span>
      <span className="attention-meta">
        <span className={`waiting-pill waiting-${signal.waitingOn.toLowerCase()}`}>{stateLabel(signal.waitingOn)}</span>
        <span title={repo.pushedAt}>{signal.activityLabel}</span>
      </span>
    </button>
  )
}

function CompactRepoRow({ repo, onOpen }: { repo: Repo; onOpen: () => void }) {
  const signal = repoSignal(repo, false)
  return (
    <button className="compact-repo-row" onClick={onOpen}>
      <span className={`status-dot status-${signal.level}`} />
      <span className="compact-repo-main">
        <strong>{repo.name}</strong>
        <span className="muted">{repo.owner.login}</span>
      </span>
      <span className="compact-repo-meta">
        {repo.primaryLanguage?.name && <span>{repo.primaryLanguage.name}</span>}
        {repo.openPRs.totalCount > 0 && <span>{repo.openPRs.totalCount} PR</span>}
        <span title={repo.pushedAt}>{signal.activityLabel}</span>
      </span>
    </button>
  )
}

function PinnedControlRow({ repo, onOpen }: { repo: Repo; onOpen: () => void }) {
  const signal = repoSignal(repo, true)
  return (
    <button className="pinned-control-row" onClick={onOpen}>
      <span className={`op-status status-${signal.level}`}>{signal.health}</span>
      <span className="pinned-name">
        <strong>{repo.name}</strong>
        <span className="muted">{repo.owner.login}</span>
      </span>
      <span>{repo.openPRs.totalCount || '-'}</span>
      <span>{repo.openIssues.totalCount || '-'}</span>
      <span title={repo.pushedAt}>{shortActivity(signal.activityLabel)}</span>
      <span>{stateLabel(signal.waitingOn)}</span>
    </button>
  )
}

function LoadingSkeleton({ progressMsg }: { progressMsg?: string }) {
  return (
    <FadeIn>
      {progressMsg && (
        <div className="loading-progress">
          <Pulse>{progressMsg}</Pulse>
        </div>
      )}
      <div className="controls">
        <Skeleton height={38} width="100%" />
      </div>
      <main>
        <div className="group">
          <h2><Skeleton height={20} width={120} /></h2>
          <div className="grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </FadeIn>
  )
}

function RepoBrowser({
  token,
  repos,
  current,
  onSelect,
  onClose
}: {
  token: string
  repos: Repo[]
  current: { owner: string; name: string }
  onSelect: (r: Repo) => void
  onClose: () => void
}) {
  const idx = repos.findIndex((r) => r.owner.login === current.owner && r.name === current.name)
  const prev = idx > 0 ? repos[idx - 1] : null
  const next = idx >= 0 && idx < repos.length - 1 ? repos[idx + 1] : null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prev) onSelect(prev)
      else if (e.key === 'ArrowRight' && next) onSelect(next)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, onSelect])

  return (
    <div className="repo-browser">
      <div className="browser-nav">
        <button onClick={onClose} className="link-btn">← Back to list</button>
        <span className="muted nav-pos">
          {idx >= 0 ? `${idx + 1} / ${repos.length}` : ''}
        </span>
        <div className="browser-nav-arrows">
          <button onClick={() => prev && onSelect(prev)} disabled={!prev} title="← prev (left arrow)">
            ← {prev ? prev.name : ''}
          </button>
          <button onClick={() => next && onSelect(next)} disabled={!next} title="next (right arrow) →">
            {next ? next.name : ''} →
          </button>
        </div>
      </div>
      <RepoDetail
        key={`${current.owner}/${current.name}`}
        token={token}
        owner={current.owner}
        name={current.name}
        onClose={onClose}
      />
    </div>
  )
}

function ConfigView({
  tokenInfo,
  orgs,
  errors
}: {
  tokenInfo: TokenInfo | undefined
  orgs: Org[]
  errors: { source: string; message: string }[]
}) {
  const [section, setSection] = useState<'orgs' | 'token' | 'storage' | 'pinned'>('orgs')

  return (
    <div className="config-view">
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
                  {errors.map((e, i) => (
                    <li key={i}>
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

        {section === 'storage' && <SettingsTab panel="storage" />}
        {section === 'pinned' && <SettingsTab panel="pinned" />}
      </div>
    </div>
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

function getLangIcon(name: string): IconType | null {
  const key = name?.toLowerCase() ?? ''
  const icons: Record<string, IconType> = {
    python: FaPython,
    javascript: FaJs,
    typescript: SiTypescript,
    java: FaJava,
    go: SiGo,
    rust: SiRust,
    docker: FaDatabase,
    vue: FaVuejs,
    react: FaReact,
    angular: FaAngular,
    nodejs: FaNode,
    sql: FaDatabase,
    postgresql: SiMysql,
    mysql: SiMysql,
    mongodb: SiMongodb,
    swift: FaNode,
    shell: FaNode,
    yaml: VscSymbolMisc,
    json: VscJson,
  }
  return icons[key] ?? null
}

function RepoCard({
  repo,
  pinned = false,
  onTogglePinned,
  onSelect
}: {
  repo: Repo
  pinned?: boolean
  onTogglePinned?: () => void
  onSelect: () => void
}) {
  const langKey = repo.primaryLanguage?.name?.toLowerCase() ?? ''
  const LangIcon = langKey ? getLangIcon(langKey) : null
  const isJS = langKey === 'javascript'
  const isTS = langKey === 'typescript'
  const signal = repoSignal(repo, pinned)

  return (
    <article
      className={`card signal-${signal.level} ${repo.isArchived ? 'archived' : ''} ${pinned ? 'pinned' : ''}`}
      onClick={onSelect}
    >
      <header>
        <span className="title">{repo.name}</span>
        <span className="badges">
          <span className={`op-status status-${signal.level}`} title={signal.reasons.join(' · ')}>
            {signal.health}
          </span>
          {onTogglePinned && (
            <button
              className={`pin-btn ${pinned ? 'active' : ''}`}
              title={pinned ? 'Unpin repo' : 'Pin repo'}
              onClick={(e) => {
                e.stopPropagation()
                onTogglePinned()
              }}
            >
              <FaStar size={11} />
            </button>
          )}
          {repo.isPrivate && <span className="badge" title="Private"><FaLock size={10} /></span>}
          {repo.isFork && <span className="badge" title="Forked"><FaCodeBranch size={10} /></span>}
          {repo.isArchived && <span className="badge" title="Archived"><FaExclamationCircle size={10} /></span>}
          {isJS && <span className="badge" title="JavaScript">JS</span>}
          {isTS && <span className="badge" title="TypeScript">TS</span>}
          {LangIcon && !isJS && !isTS && <span className="badge" title={repo.primaryLanguage?.name}><LangIcon size={10} color={repo.primaryLanguage?.color ?? '#888'} /></span>}
        </span>
      </header>
      <p className="owner muted">{repo.owner.login}</p>
      {repo.description && <p className="desc">{repo.description}</p>}
      <footer>
        {repo.defaultBranchRef && (
          <span className="meta" title={`Branch: ${repo.defaultBranchRef.name}`}>
            <FaCodeBranch size={10} /> {repo.defaultBranchRef.name}
          </span>
        )}
        {repo.openPRs.totalCount > 0 && (
          <span className="meta" title="Open PRs">⚡{repo.openPRs.totalCount} PR{repo.openPRs.totalCount > 1 ? 's' : ''}</span>
        )}
        <span className="muted" title={repo.pushedAt}>{signal.activityLabel}</span>
        {repo.stargazerCount > 0 && <span title="Stars">★{repo.stargazerCount}</span>}
        {repo.openIssues.totalCount > 0 && <span title="Open issues" className="issues">◎{repo.openIssues.totalCount}</span>}
      </footer>
    </article>
  )
}

type HomeModel = {
  summary: {
    criticalRepos: number
    reviewDebtRepos: number
    stalePrRepos: number
    pinnedRepos: number
    quietRepos: number
  }
  priority: {
    critical: RepoAttention[]
    reviewNeeded: RepoAttention[]
    stalePrs: RepoAttention[]
    recentWork: RepoAttention[]
    quietCount: number
  }
  sinceLastVisit: VisitEvent[]
  activeWork: Repo[]
  pinnedRepos: Repo[]
  digest: DigestItem[]
}

type RepoAttention = {
  repo: Repo
  signal: RepoSignal
}

type DigestItem = {
  level: RepoSignalLevel
  target: 'repos' | 'prs'
  text: string
}

type VisitEvent = {
  key: string
  level: RepoSignalLevel
  target: 'repos' | 'prs'
  text: string
  repo?: Repo
}

function buildHomeModel(
  repos: Repo[],
  pinnedIds: Set<string>,
  pinnedOrder: Map<string, number>,
  visitSnapshot: RepoVisitSnapshot | null
): HomeModel {
  const visible = repos.filter((repo) => !repo.isArchived)
  const activeCutoff = Date.now() - 7 * 86_400_000
  const attention = visible
    .map((repo) => ({ repo, signal: repoSignal(repo, pinnedIds.has(repo.id)) }))
    .filter((item) => item.signal.score >= 20)
    .sort((a, b) => b.signal.score - a.signal.score || new Date(b.repo.pushedAt).getTime() - new Date(a.repo.pushedAt).getTime())
  const critical = attention.filter((item) => item.signal.level === 'critical')
  const stalePrs = attention.filter((item) => item.repo.openPRs.totalCount > 0 && daysSince(item.repo.pushedAt) >= 14 && item.signal.level !== 'critical')
  const reviewNeeded = attention.filter((item) => item.repo.openPRs.totalCount > 0 && daysSince(item.repo.pushedAt) < 14 && item.signal.level !== 'critical')
  const recentWork = attention.filter((item) => item.repo.openPRs.totalCount === 0 && daysSince(item.repo.pushedAt) < 14 && item.signal.level !== 'critical')
  const stalePinned = visible.filter((repo) => pinnedIds.has(repo.id) && daysSince(repo.pushedAt) > 14)
  const prLoad = visible.filter((repo) => repo.openPRs.totalCount > 0)
  const stalePrLoad = prLoad.filter((repo) => daysSince(repo.pushedAt) >= 14)
  const issueLoad = visible.filter((repo) => repo.openIssues.totalCount > 0)
  const activeRepos = visible
    .filter((repo) => new Date(repo.pushedAt).getTime() >= activeCutoff)
    .sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
  const digest = buildDigest(prLoad.length, issueLoad.length, stalePinned.length, activeRepos.length, visible.length - attention.length)

  return {
    summary: {
      criticalRepos: critical.length,
      reviewDebtRepos: prLoad.length,
      stalePrRepos: stalePrLoad.length,
      pinnedRepos: pinnedIds.size,
      quietRepos: Math.max(0, visible.length - attention.length),
    },
    priority: {
      critical: critical.slice(0, 5),
      reviewNeeded: reviewNeeded.slice(0, 8),
      stalePrs: stalePrs.slice(0, 8),
      recentWork: recentWork.slice(0, 8),
      quietCount: Math.max(0, visible.length - attention.length),
    },
    sinceLastVisit: buildVisitEvents(visible, visitSnapshot).slice(0, 8),
    activeWork: activeRepos.slice(0, 8),
    pinnedRepos: visible
      .filter((repo) => pinnedIds.has(repo.id))
      .sort((a, b) => (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0))
      .slice(0, 8),
    digest,
  }
}

function buildVisitSnapshot(repos: Repo[]): RepoVisitSnapshot {
  const snapshot: RepoVisitSnapshot = {}
  for (const repo of repos) {
    snapshot[repo.id] = {
      pushedAt: repo.pushedAt,
      openPRs: repo.openPRs.totalCount,
      openIssues: repo.openIssues.totalCount,
    }
  }
  return snapshot
}

function buildVisitEvents(repos: Repo[], snapshot: RepoVisitSnapshot | null): VisitEvent[] {
  if (!snapshot) {
    return [{
      key: 'baseline',
      level: 'quiet',
      target: 'repos',
      text: 'No baseline yet. Mark seen to start tracking changes.',
    }]
  }

  const events: VisitEvent[] = []
  for (const repo of repos) {
    const prev = snapshot[repo.id]
    if (!prev) {
      events.push({
        key: `${repo.id}:new`,
        level: 'active',
        target: 'repos',
        text: `New repo visible: ${repo.nameWithOwner}`,
        repo,
      })
      continue
    }

    const prDelta = repo.openPRs.totalCount - prev.openPRs
    if (prDelta > 0) {
      events.push({
        key: `${repo.id}:prs`,
        level: 'critical',
        target: 'prs',
        text: `${prDelta} new PR${prDelta > 1 ? 's' : ''} in ${repo.nameWithOwner}`,
        repo,
      })
    }

    const issueDelta = repo.openIssues.totalCount - prev.openIssues
    if (issueDelta > 0) {
      events.push({
        key: `${repo.id}:issues`,
        level: 'attention',
        target: 'repos',
        text: `${issueDelta} new issue${issueDelta > 1 ? 's' : ''} in ${repo.nameWithOwner}`,
        repo,
      })
    }

    if (new Date(repo.pushedAt).getTime() > new Date(prev.pushedAt).getTime()) {
      events.push({
        key: `${repo.id}:push`,
        level: 'active',
        target: 'repos',
        text: `New commit activity in ${repo.nameWithOwner}`,
        repo,
      })
    }
  }

  return events.sort((a, b) => eventWeight(b) - eventWeight(a))
}

function eventWeight(event: VisitEvent): number {
  if (event.level === 'critical') return 3
  if (event.level === 'attention') return 2
  if (event.level === 'active') return 1
  return 0
}

function buildDigest(openPRRepos: number, issueRepos: number, stalePinned: number, activeRepos: number, quietRepos: number): DigestItem[] {
  const items: DigestItem[] = []
  if (openPRRepos > 0) items.push({ level: 'critical', target: 'prs', text: `${openPRRepos} repos need review` })
  if (stalePinned > 0) items.push({ level: 'attention', target: 'repos', text: `${stalePinned} pinned stale` })
  if (issueRepos > 0) items.push({ level: 'attention', target: 'repos', text: `${issueRepos} repos need triage` })
  if (activeRepos > 0) items.push({ level: 'active', target: 'repos', text: `${activeRepos} repos active 7d` })
  if (quietRepos > 0) items.push({ level: 'quiet', target: 'repos', text: `${quietRepos} quiet repos hidden` })
  return items.length > 0 ? items : [{ level: 'quiet', target: 'repos', text: 'No operational changes detected' }]
}

function repoSignal(repo: Repo, pinned: boolean): RepoSignal {
  const primaryReasons: string[] = []
  const secondaryReasons: string[] = []
  let score = 0
  const daysSincePush = daysSince(repo.pushedAt)
  let waitingOn: WaitingOn = 'NONE'
  let health: HealthLabel = 'quiet'

  if (pinned) {
    score += 20
    secondaryReasons.push('pinned')
  }
  if (repo.openPRs.totalCount > 0) {
    score += 40 + Math.min(repo.openPRs.totalCount, 5) * 4
    primaryReasons.push(`${repo.openPRs.totalCount} PR open`)
    waitingOn = 'PR_OPEN'
    health = 'pr open'
  }
  if (repo.openIssues.totalCount > 0) {
    score += Math.min(repo.openIssues.totalCount, 10)
    const reason = `${repo.openIssues.totalCount} issue${repo.openIssues.totalCount > 1 ? 's' : ''}`
    if (repo.openPRs.totalCount === 0) {
      primaryReasons.push(reason)
      waitingOn = 'TRIAGE'
    } else {
      secondaryReasons.push(reason)
    }
  }

  if (daysSincePush <= 7) {
    score += 10
    secondaryReasons.push('recent commit')
    if (health === 'quiet') health = 'active'
  } else if (pinned && daysSincePush > 14) {
    score += 18
    primaryReasons.push(`stale pinned ${Math.floor(daysSincePush)}d`)
    if (waitingOn === 'NONE') waitingOn = 'ACTIVITY'
    if (health === 'quiet') health = 'stale'
  }

  if (repo.isFork) secondaryReasons.push('fork')
  if (repo.isArchived) return buildSignal('quiet', 'archived', ['archived'], [], 'archived', 'NONE', repo.pushedAt, 0)

  if (score >= 60) return buildSignal('critical', 'critical', primaryReasons, secondaryReasons, health, waitingOn, repo.pushedAt, score)
  if (score >= 25) return buildSignal('attention', 'attention', primaryReasons, secondaryReasons, health, waitingOn, repo.pushedAt, score)
  if (daysSincePush <= 7) return buildSignal('active', 'active', primaryReasons, secondaryReasons.length ? secondaryReasons : ['recent commit'], health, waitingOn, repo.pushedAt, 10)
  const quietHealth: HealthLabel = daysSincePush > 90 ? 'stale' : 'healthy'
  return buildSignal('quiet', 'quiet', primaryReasons, secondaryReasons.length ? secondaryReasons : ['no immediate signal'], quietHealth, waitingOn, repo.pushedAt, score)
}

function buildSignal(
  level: RepoSignalLevel,
  label: string,
  primaryReasons: string[],
  secondaryReasons: string[],
  health: HealthLabel,
  waitingOn: WaitingOn,
  pushedAt: string,
  score: number
): RepoSignal {
  const safePrimary = primaryReasons.length ? primaryReasons : secondaryReasons.slice(0, 1)
  const safeSecondary = primaryReasons.length ? secondaryReasons : secondaryReasons.slice(1)
  return {
    level,
    label,
    primaryReasons: safePrimary,
    secondaryReasons: safeSecondary,
    reasons: [...safePrimary, ...safeSecondary],
    health,
    waitingOn,
    activityLabel: activityLabel(pushedAt),
    score,
  }
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

function idleAge(iso: string): string {
  const days = Math.floor(daysSince(iso))
  if (days <= 0) return timeAgo(iso)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(days / 365)}y`
}

function activityLabel(iso: string): string {
  const days = daysSince(iso)
  if (days < 7) return `last commit ${timeAgo(iso)}`
  if (days < 14) return `last commit ${Math.floor(days)}d`
  return `stale ${idleAge(iso)}`
}

function shortActivity(label: string): string {
  return label.replace('last commit ', '').replace('stale ', '')
}

function criticalSummary(repo: Repo, signal: RepoSignal): string {
  const parts = []
  if (repo.openPRs.totalCount > 0) parts.push(`${repo.openPRs.totalCount} PR${repo.openPRs.totalCount > 1 ? 's' : ''} open`)
  if (repo.openIssues.totalCount > 0) parts.push(`${repo.openIssues.totalCount} issue${repo.openIssues.totalCount > 1 ? 's' : ''}`)
  parts.push(signal.activityLabel)
  if (signal.waitingOn !== 'NONE') parts.push(stateLabel(signal.waitingOn))
  return parts.join(' · ')
}

function stateLabel(state: WaitingOn): string {
  if (state === 'PR_OPEN') return 'PR OPEN'
  if (state === 'TRIAGE') return 'TRIAGE'
  if (state === 'ACTIVITY') return 'ACTIVITY'
  return '-'
}

function groupRepos(repos: Repo[], by: GroupBy): Array<[string, Repo[]]> {
  if (by === 'none') return [['', repos]]
  const map = new Map<string, Repo[]>()
  for (const r of repos) {
    const key = keyFor(r, by)
    const arr = map.get(key) ?? []
    arr.push(r)
    map.set(key, arr)
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
}

function keyFor(r: Repo, by: GroupBy): string {
  if (by === 'owner') return r.owner.login
  if (by === 'language') return r.primaryLanguage?.name ?? '— no language —'
  const days = (Date.now() - new Date(r.pushedAt).getTime()) / 86_400_000
  if (days < 7) return 'Last week'
  if (days < 30) return 'Last month'
  if (days < 90) return 'Last 3 months'
  if (days < 365) return 'Last year'
  return 'Over a year'
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(day / 365)}y`
}
