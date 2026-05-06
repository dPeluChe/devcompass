import { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRateLimit, fetchTokenInfo, fetchUserOrgsRest, fetchViewer, fetchOrgReposSimple, type Repo, type TokenInfo, type Org } from '../api/github'
import { RepoDetail } from './RepoDetail'
import { PRInbox } from './PRInbox'
import { OrgManager } from './OrgManager'
import { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'
import { orgConfigStore } from '../store/orgConfig'
import { cacheRepos, getCachedRepos, getPinnedRepos, pinRepo, unpinRepo, type PinnedRepo } from '../store/db'
import { FaPython, FaJs, FaJava, FaVuejs, FaReact, FaAngular, FaNode, FaDatabase, FaLock, FaCodeBranch, FaExclamationCircle, FaStar } from 'react-icons/fa'
import { SiTypescript, SiGo, SiRust, SiMysql, SiMongodb } from 'react-icons/si'
import { VscJson, VscSymbolMisc } from 'react-icons/vsc'

export { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'

type Props = { token: string; onLogout: () => void }
type GroupBy = 'none' | 'owner' | 'language' | 'activity'
type IconType = typeof FaPython

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
    const allOrgsList = [...merged.values()]
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

    await Promise.all(syncingOrgs.map(async (login) => {
      const cached = await getCachedRepos(login)
      cachedByOrg.set(login, cached)
      for (const r of cached) byId.set(r.id, r)
    }))

    if (byId.size > 0) {
      setRepos(sortRepos([...byId.values()]))
      setLoadedFromCache(true)
    }

    const orgsToFetch = syncingOrgs.filter((login) => {
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
        const orgRepos = await fetchOrgReposSimple(token, login)
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
  
  const [view, setView] = useState<'repos' | 'prs'>('repos')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [hideArchived, setHideArchived] = useState(true)
  const [hideForks, setHideForks] = useState(false)
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [activityWindow, setActivityWindow] = useState<number>(90)
  const [selected, setSelected] = useState<{ owner: string; name: string } | null>(null)
  const [pinned, setPinned] = useState<PinnedRepo[]>([])

  useEffect(() => {
    getPinnedRepos().then(setPinned).catch((e) => console.warn('Failed to load pinned repos:', e))
  }, [])

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
  const pinnedRepos = useMemo(() => {
    return filtered
      .filter((r) => pinnedIds.has(r.id))
      .sort((a, b) => (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0))
  }, [filtered, pinnedIds, pinnedOrder])
  const unpinnedFiltered = useMemo(() => filtered.filter((r) => !pinnedIds.has(r.id)), [filtered, pinnedIds])

  const groups = useMemo(() => groupRepos(unpinnedFiltered, groupBy), [unpinnedFiltered, groupBy])

  const owners = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of baseFiltered) counts.set(r.owner.login, (counts.get(r.owner.login) ?? 0) + 1)
    const orgLogins = data.orgs.length > 0 ? data.orgs.map((org) => org.login) : [...new Set(data.repos.map((r) => r.owner.login))]
    return orgLogins
      .map((login) => [login, counts.get(login) ?? 0] as const)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
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
    setSelectedOwners((current) => {
      if (current.includes(login)) return current.filter((item) => item !== login)
      return [...current, login]
    })
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
            <button className={`view-tab ${view === 'repos' ? 'active' : ''}`} onClick={() => setView('repos')}>
              Repos
            </button>
            <button className={`view-tab ${view === 'prs' ? 'active' : ''}`} onClick={() => setView('prs')}>
              PRs
            </button>
          </nav>

          {data.viewer && (
            <OrgManager orgs={data.viewer.organizations.nodes} />
          )}

          <div className="meta muted">
            {(data.isLoading || data.progressMsg) && (
              <span>
                <Pulse>{data.progressMsg || 'Loading...'}</Pulse>
              </span>
            )}
            {!data.isLoading && !data.progressMsg && (
              <span>
                {view === 'repos' ? `${filtered.length}/${data.repos.length} repos` : `${data.repos.length} repos`} · {data.viewer?.organizations.nodes.length ?? 0} orgs
                {data.loadedFromCache && data.isFetching ? ' · local cache' : ''}
              </span>
            )}
            {data.rateLimit && <span>· {data.rateLimit.remaining}/{data.rateLimit.limit}</span>}
            <button className="link-btn" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {data.tokenInfo && <DiagnosticsBar tokenInfo={data.tokenInfo} orgs={data.viewer?.organizations.nodes ?? []} />}

        {data.errors.length > 0 && (
          <details className="partial-errors">
            <summary>{data.errors.length} partial errors (view)</summary>
            <ul>
              {data.errors.map((e, i) => (
                <li key={i}>
                  <strong>{e.source}:</strong> {e.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        {view === 'prs' && data.viewer && <PRInbox token={token} viewer={data.viewer} />}

        {view === 'repos' && selected && (
          <RepoBrowser
            token={token}
            repos={filtered}
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
                      className={`org-chip ${selectedOwners.length === 0 ? 'active' : ''}`}
                      onClick={() => setSelectedOwners([])}
                      title="Show every org"
                    >
                      All <span className="chip-count">{baseFiltered.length}</span>
                    </button>
                    {owners.map(([login, count]) => {
                      const org = data.orgs.find(o => o.login === login)
                      const selected = selectedOwners.includes(login)
                      return (
                        <button
                          key={login}
                          className={`org-chip ${selected ? 'active' : ''} ${count === 0 ? 'empty' : ''}`}
                          onClick={() => toggleOwner(login)}
                          aria-pressed={selected}
                        >
                          {org?.avatarUrl && <img src={org.avatarUrl} alt="" className="chip-avatar" />}
                          {login} <span className="chip-count">{count}</span>
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

function DiagnosticsBar({ tokenInfo, orgs }: { tokenInfo: TokenInfo; orgs: Org[] }) {
  const [open, setOpen] = useState(false)
  if (!tokenInfo) return null

  const hasReadOrg = tokenInfo.scopes.includes('read:org') || tokenInfo.scopes.includes('admin:org')
  const missingReadOrg = tokenInfo.type === 'classic' && !hasReadOrg
  const noOrgs = orgs.length === 0
  const ssoIssue = !!tokenInfo.ssoRequired
  const hasIssue = missingReadOrg || ssoIssue || (noOrgs && tokenInfo.type === 'fine-grained')
  const ok = !hasIssue

  return (
    <div className={`diag-strip ${ok ? 'ok' : 'warn'}`}>
      <button className="diag-toggle" onClick={() => setOpen((o) => !o)}>
        <span className={`diag-dot ${ok ? 'ok' : 'warn'}`}>{ok ? '●' : '⚠'}</span>
        <span>{tokenInfo.type} · {orgs.length} orgs</span>
        {hasIssue && <span className="muted">· review</span>}
        <span className="muted">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="diag-body">
          {tokenInfo.scopes.length > 0 && (
            <div className="diag-row">
              <span className="muted">scopes:</span>
              {tokenInfo.scopes.map((s) => (
                <span key={s} className="diag-pill">{s}</span>
              ))}
            </div>
          )}
          {orgs.length > 0 && (
            <div className="diag-orgs">
              {orgs.map((o) => (
                <a key={o.login} href={o.url} target="_blank" rel="noreferrer" title={o.login}>
                  <img src={o.avatarUrl} alt={o.login} width={20} height={20} />
                  <span>{o.login}</span>
                </a>
              ))}
            </div>
          )}
          {hasIssue && (
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
          )}
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

  return (
    <article
      className={`card ${repo.isArchived ? 'archived' : ''} ${pinned ? 'pinned' : ''}`}
      onClick={onSelect}
    >
      <header>
        <span className="title">{repo.name}</span>
        <span className="badges">
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
        <span className="muted" title={repo.pushedAt}>{timeAgo(repo.pushedAt)}</span>
        {repo.stargazerCount > 0 && <span title="Stars">★{repo.stargazerCount}</span>}
        {repo.openIssues.totalCount > 0 && <span title="Open issues" className="issues">◎{repo.openIssues.totalCount}</span>}
      </footer>
    </article>
  )
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
