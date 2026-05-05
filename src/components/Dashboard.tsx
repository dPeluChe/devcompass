import { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRateLimit, fetchTokenInfo, fetchUserOrgsRest, fetchViewer, fetchOrgReposSimple, type Repo, type TokenInfo, type Org } from '../api/github'
import { RepoDetail } from './RepoDetail'
import { PRInbox } from './PRInbox'
import { OrgManager } from './OrgManager'
import { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'
import { orgConfigStore } from '../store/orgConfig'

export { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'

type Props = { token: string; onLogout: () => void }

type GroupBy = 'none' | 'owner' | 'language' | 'activity'

function useViewerData(token: string) {
  const [progressMsg, setProgressMsg] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([])
  
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
    
    const { setAllOrgs, getEnabledOrgs, getSyncingOrgs } = orgConfigStore.getState()
    setAllOrgs(allOrgsList.map(o => ({
      login: o.login,
      avatarUrl: o.avatarUrl,
      enabled: true,
      syncEnabled: true,
      lastSyncedAt: null
    })))
    
    const enabledOrgs = getEnabledOrgs()
    const syncingOrgs = getSyncingOrgs()
    
    setProgressMsg(`Loading repos from ${enabledOrgs.length} orgs...`)
    
    const byId = new Map<string, Repo>()
    const errs: { source: string; message: string }[] = []
    
    for (let i = 0; i < syncingOrgs.length; i++) {
      const login = syncingOrgs[i]
      const current = i + 1
      const total = syncingOrgs.length
      setProgressMsg(`Fetching repos from @${login} (${current}/${total})`)
      
      try {
        const orgRepos = await fetchOrgReposSimple(token, login)
        for (const r of orgRepos) byId.set(r.id, r)
      } catch (e) {
        console.warn(`Failed to load repos from ${login}:`, e)
        errs.push({ source: login, message: e instanceof Error ? e.message : String(e) })
      }
    }

    const allRepos = [...byId.values()].sort(
      (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
    )
    
    setRepos(allRepos)
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
    tokenInfo: tokenInfoQuery.data,
    repos,
    errors,
    rateLimit: rateLimitQuery.data,
    progressMsg,
    isLoading: isInitialLoading || !!progressMsg,
    isFetching: viewerQuery.isFetching || tokenInfoQuery.isFetching || rateLimitQuery.isFetching || !!progressMsg,
    error: viewerQuery.error || null
  }
}

export function Dashboard({ token, onLogout }: Props) {
  const data = useViewerData(token)
  
  const [view, setView] = useState<'repos' | 'prs'>('repos')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [hideArchived, setHideArchived] = useState(true)
  const [hideForks, setHideForks] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('')
  const [activityWindow, setActivityWindow] = useState<number>(90)
  const [selected, setSelected] = useState<{ owner: string; name: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const cutoff = activityWindow > 0 ? Date.now() - activityWindow * 86_400_000 : 0
    return data.repos.filter((r) => {
      if (hideArchived && r.isArchived) return false
      if (hideForks && r.isFork) return false
      if (ownerFilter && r.owner.login !== ownerFilter) return false
      if (cutoff && new Date(r.pushedAt).getTime() < cutoff) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.nameWithOwner.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.primaryLanguage?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [data.repos, search, hideArchived, hideForks, ownerFilter, activityWindow])

  const groups = useMemo(() => groupRepos(filtered, groupBy), [filtered, groupBy])

  const owners = useMemo(() => {
    const set = new Map<string, number>()
    for (const r of filtered) set.set(r.owner.login, (set.get(r.owner.login) ?? 0) + 1)
    return [...set.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

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
                    {owners.slice(0, 6).map(([login, count]) => {
                      const org = data.viewer?.organizations.nodes.find(o => o.login === login)
                      return (
                        <button
                          key={login}
                          className={`org-chip ${ownerFilter === login ? 'active' : ''}`}
                          onClick={() => setOwnerFilter(ownerFilter === login ? '' : login)}
                        >
                          {org?.avatarUrl && <img src={org.avatarUrl} alt="" className="chip-avatar" />}
                          {login} <span className="chip-count">{count}</span>
                        </button>
                      )
                    })}
                    {owners.length > 6 && (
                      <button
                        className={`org-chip ${ownerFilter === '' ? 'active' : ''}`}
                        onClick={() => setOwnerFilter('')}
                      >
                        +{owners.length - 6}
                      </button>
                    )}
                  </div>
                  <input
                    type="search"
                    placeholder="Search repos, description, language..."
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

                <main>
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

function RepoCard({ repo, onSelect }: { repo: Repo; onSelect: () => void }) {
  return (
    <article
      className={`card ${repo.isArchived ? 'archived' : ''}`}
      onClick={onSelect}
    >
      <header>
        <span className="title">{repo.name}</span>
        <span className="badges">
          {repo.isPrivate && <span className="badge">priv</span>}
          {repo.isFork && <span className="badge">fork</span>}
          {repo.isArchived && <span className="badge">arch</span>}
        </span>
      </header>
      <p className="owner muted">{repo.owner.login}</p>
      {repo.description && <p className="desc">{repo.description}</p>}
      <footer>
        {repo.primaryLanguage && (
          <span className="lang">
            <span className="dot" style={{ background: repo.primaryLanguage.color ?? '#888' }} />
            {repo.primaryLanguage.name}
          </span>
        )}
        {repo.stargazerCount > 0 && <span title="Stars">★ {repo.stargazerCount}</span>}
        {repo.openPRs.totalCount > 0 && <span title="Open PRs">PR {repo.openPRs.totalCount}</span>}
        {repo.openIssues.totalCount > 0 && <span title="Open issues">IS {repo.openIssues.totalCount}</span>}
        <span className="muted" title={repo.pushedAt}>{timeAgo(repo.pushedAt)}</span>
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