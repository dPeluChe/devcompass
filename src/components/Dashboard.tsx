import { useEffect, useMemo, useState } from 'react'
import {
  fetchAllRepos,
  fetchRateLimit,
  fetchTokenInfo,
  fetchUserOrgsRest,
  fetchViewer,
  type Org,
  type RateLimit,
  type Repo,
  type TokenInfo,
  type Viewer
} from '../api/github'
import { RepoDetail } from './RepoDetail'
import { PRInbox } from './PRInbox'

type Props = { token: string; onLogout: () => void }

type GroupBy = 'owner' | 'language' | 'activity'

export function Dashboard({ token, onLogout }: Props) {
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [allOrgs, setAllOrgs] = useState<Org[]>([])
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [progressMsg, setProgressMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [partialErrors, setPartialErrors] = useState<{ source: string; message: string }[]>([])
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null)

  const [view, setView] = useState<'repos' | 'prs'>('repos')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('activity')
  const [hideArchived, setHideArchived] = useState(true)
  const [hideForks, setHideForks] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('')
  /** Days. 0 = "all time". */
  const [activityWindow, setActivityWindow] = useState<number>(90)

  const [selected, setSelected] = useState<{ owner: string; name: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [v, info, restOrgs] = await Promise.all([
          fetchViewer(token),
          fetchTokenInfo(token).catch((e) => {
            console.warn('tokenInfo failed', e)
            return null
          }),
          fetchUserOrgsRest(token).catch((e) => {
            console.warn('REST orgs failed', e)
            return [] as Awaited<ReturnType<typeof fetchUserOrgsRest>>
          })
        ])
        if (cancelled) return
        setViewer(v)
        setTokenInfo(info)
        // Merge GraphQL orgs + REST orgs (REST sometimes has more), dedupe by login.
        const merged = new Map<string, Org>()
        for (const o of v.organizations.nodes) merged.set(o.login, o)
        for (const o of restOrgs) {
          if (!merged.has(o.login)) {
            merged.set(o.login, { login: o.login, avatarUrl: o.avatar_url, url: `https://github.com/${o.login}` })
          }
        }
        const orgs = [...merged.values()]
        setAllOrgs(orgs)
        const viewerWithOrgs: Viewer = { ...v, organizations: { nodes: orgs } }
        setProgressMsg(`${orgs.length} orgs detectadas. Cargando repos...`)
        const { repos: all, errors } = await fetchAllRepos(token, viewerWithOrgs, (e) => {
          if (cancelled) return
          if (e.kind === 'viewer') setProgressMsg(`viewer: ${e.count} repos`)
          else if (e.kind === 'org') setProgressMsg(`@${e.login}: ${e.count} repos`)
          else setProgressMsg(`Total: ${e.total} repos únicos`)
        })
        if (cancelled) return
        setRepos(all)
        setPartialErrors(errors)
        const rl = await fetchRateLimit(token)
        if (cancelled) return
        setRateLimit(rl)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const cutoff = activityWindow > 0 ? Date.now() - activityWindow * 86_400_000 : 0
    return repos.filter((r) => {
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
  }, [repos, search, hideArchived, hideForks, ownerFilter, activityWindow])

  const groups = useMemo(() => groupRepos(filtered, groupBy), [filtered, groupBy])

  const owners = useMemo(() => {
    const set = new Map<string, number>()
    for (const r of repos) set.set(r.owner.login, (set.get(r.owner.login) ?? 0) + 1)
    return [...set.entries()].sort((a, b) => b[1] - a[1])
  }, [repos])

  if (error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <pre>{error}</pre>
        <button onClick={onLogout}>Cambiar token</button>
      </div>
    )
  }

  return (
    <div className={`dashboard ${selected ? 'with-detail' : ''}`}>
      <div className="main-col">
        <header>
          <div className="user">
            {viewer && <img src={viewer.avatarUrl} alt="" width={32} height={32} />}
            <div>
              <strong>{viewer?.name ?? viewer?.login ?? '...'}</strong>
              <div className="muted">@{viewer?.login}</div>
            </div>
          </div>
          <div className="meta">
            {loading && <span>{progressMsg || 'Cargando...'}</span>}
            {!loading && (
              <span>
                {view === 'repos' ? `${filtered.length} / ${repos.length} repos` : `${repos.length} repos`} · {allOrgs.length} orgs
              </span>
            )}
            {rateLimit && (
              <span className="muted">
                · API: {rateLimit.remaining}/{rateLimit.limit}
              </span>
            )}
            <button onClick={onLogout}>Salir</button>
          </div>
        </header>

        <nav className="view-tabs">
          <button className={`view-tab ${view === 'repos' ? 'active' : ''}`} onClick={() => setView('repos')}>
            Repos
          </button>
          <button className={`view-tab ${view === 'prs' ? 'active' : ''}`} onClick={() => setView('prs')}>
            PR Inbox
          </button>
        </nav>

        <DiagnosticsBar tokenInfo={tokenInfo} orgs={allOrgs} />

        {partialErrors.length > 0 && (
          <details className="partial-errors">
            <summary>{partialErrors.length} errores parciales (ver)</summary>
            <ul>
              {partialErrors.map((e, i) => (
                <li key={i}>
                  <strong>{e.source}:</strong> {e.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        {view === 'repos' && (
          <div className="controls">
            <input
              type="search"
              placeholder="Buscar repos, descripción, lenguaje..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={activityWindow} onChange={(e) => setActivityWindow(Number(e.target.value))}>
              <option value={7}>Activos en 7d</option>
              <option value={30}>Activos en 30d</option>
              <option value={90}>Activos en 3 meses</option>
              <option value={180}>Activos en 6 meses</option>
              <option value={365}>Activos en 1 año</option>
              <option value={0}>Todos (sin filtro)</option>
            </select>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              <option value="activity">Agrupar por actividad</option>
              <option value="owner">Agrupar por owner</option>
              <option value="language">Agrupar por lenguaje</option>
            </select>
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">Todos los owners</option>
              {owners.map(([login, count]) => (
                <option key={login} value={login}>
                  {login} ({count})
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={hideArchived} onChange={(e) => setHideArchived(e.target.checked)} />
              Ocultar archivados
            </label>
            <label>
              <input type="checkbox" checked={hideForks} onChange={(e) => setHideForks(e.target.checked)} />
              Ocultar forks
            </label>
          </div>
        )}

        {view === 'prs' && viewer && <PRInbox token={token} viewer={viewer} />}

        {view === 'repos' && <main>
          {groups.map(([group, items]) => (
            <section key={group} className="group">
              <h2>
                {group} <span className="muted">({items.length})</span>
              </h2>
              <div className="grid">
                {items.map((r) => (
                  <RepoCard
                    key={r.id}
                    repo={r}
                    selected={selected?.owner === r.owner.login && selected?.name === r.name}
                    onSelect={() => setSelected({ owner: r.owner.login, name: r.name })}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>}
      </div>

      {selected && (
        <RepoDetail
          token={token}
          owner={selected.owner}
          name={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function DiagnosticsBar({ tokenInfo, orgs }: { tokenInfo: TokenInfo | null; orgs: Org[] }) {
  if (!tokenInfo) return null
  const missingReadOrg = tokenInfo.type === 'classic' && !tokenInfo.scopes.includes('read:org')
  const noOrgs = orgs.length === 0
  const ssoIssue = !!tokenInfo.ssoRequired

  return (
    <div className="diagnostics">
      <div className="diag-row">
        <span className="muted">Token:</span>
        <span className="diag-pill">{tokenInfo.type}</span>
        {tokenInfo.scopes.length > 0 && (
          <>
            <span className="muted">scopes:</span>
            {tokenInfo.scopes.map((s) => (
              <span key={s} className="diag-pill">{s}</span>
            ))}
          </>
        )}
        <span className="muted">orgs visibles:</span>
        <span className="diag-pill">{orgs.length}</span>
      </div>

      {orgs.length > 0 && (
        <div className="diag-orgs">
          {orgs.map((o) => (
            <a key={o.login} href={o.url} target="_blank" rel="noreferrer" title={o.login}>
              <img src={o.avatarUrl} alt={o.login} width={24} height={24} />
              <span>{o.login}</span>
            </a>
          ))}
        </div>
      )}

      {(noOrgs || missingReadOrg || ssoIssue) && (
        <div className="diag-warn">
          <strong>¿Faltan orgs?</strong> Posibles causas:
          <ul>
            {missingReadOrg && (
              <li>
                Tu PAT classic no tiene scope <code>read:org</code>. Edítalo en{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
                  settings/tokens
                </a>{' '}
                y agrégalo.
              </li>
            )}
            {tokenInfo.type === 'fine-grained' && (
              <li>
                Los <strong>fine-grained PATs</strong> sólo ven las orgs que aprobaste explícitamente al crearlos.
                Crea uno classic con <code>repo</code> + <code>read:org</code> para ver todas, o crea un fine-grained por org.
              </li>
            )}
            {ssoIssue && (
              <li>
                Tu token requiere <strong>autorizar SAML SSO</strong> para algunas orgs.{' '}
                <a href={tokenInfo.ssoRequired!.url} target="_blank" rel="noreferrer">
                  Autorizar aquí
                </a>
                .
              </li>
            )}
            {noOrgs && !missingReadOrg && tokenInfo.type !== 'fine-grained' && !ssoIssue && (
              <li>
                Verifica que tu cuenta sea miembro de alguna org (no solo outside collaborator) en{' '}
                <a href="https://github.com/settings/organizations" target="_blank" rel="noreferrer">
                  settings/organizations
                </a>
                .
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function RepoCard({ repo, selected, onSelect }: { repo: Repo; selected: boolean; onSelect: () => void }) {
  return (
    <article
      className={`card ${repo.isArchived ? 'archived' : ''} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <header>
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="title"
          onClick={(e) => e.stopPropagation()}
        >
          {repo.name}
        </a>
        <span className="badges">
          {repo.isPrivate && <span className="badge">private</span>}
          {repo.isFork && <span className="badge">fork</span>}
          {repo.isArchived && <span className="badge">archived</span>}
        </span>
      </header>
      <p className="owner muted">{repo.owner.login}</p>
      {repo.description && <p className="desc">{repo.description}</p>}
      <footer onClick={(e) => e.stopPropagation()}>
        {repo.primaryLanguage && (
          <span className="lang">
            <span className="dot" style={{ background: repo.primaryLanguage.color ?? '#888' }} />
            {repo.primaryLanguage.name}
          </span>
        )}
        <span title="Stars">★ {repo.stargazerCount}</span>
        <a href={`${repo.url}/pulls`} target="_blank" rel="noreferrer" title="Open PRs">
          PR {repo.openPRs.totalCount}
        </a>
        <a href={`${repo.url}/issues`} target="_blank" rel="noreferrer" title="Open issues">
          IS {repo.openIssues.totalCount}
        </a>
        <span className="muted" title={repo.pushedAt}>
          {timeAgo(repo.pushedAt)}
        </span>
      </footer>
    </article>
  )
}

function groupRepos(repos: Repo[], by: GroupBy): [string, Repo[]][] {
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
  if (by === 'language') return r.primaryLanguage?.name ?? '— sin lenguaje —'
  const days = (Date.now() - new Date(r.pushedAt).getTime()) / 86_400_000
  if (days < 7) return 'Última semana'
  if (days < 30) return 'Último mes'
  if (days < 90) return 'Últimos 3 meses'
  if (days < 365) return 'Último año'
  return 'Más de un año'
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
