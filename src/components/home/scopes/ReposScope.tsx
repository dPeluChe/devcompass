import { useMemo, useState, type ReactNode } from 'react'
import type { Repo } from '../../../api/github'
import { RepoCard } from '../RepoCard'
import type { ScopeProps } from './common'

type OrgFacet = { login: string; avatarUrl?: string; count: number }

export function ReposScope({ repos, viewer, pinned, onOpenRepo, onTogglePinned }: ScopeProps) {
  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.repoId)), [pinned])
  // Per-org facets for the chip row. Viewer first (labeled "Personal"), then by
  // count desc so the user's heaviest orgs surface left.
  const facets = useMemo<OrgFacet[]>(() => {
    const map = new Map<string, OrgFacet>()
    for (const r of repos) {
      const cur = map.get(r.owner.login)
      if (cur) cur.count += 1
      else map.set(r.owner.login, { login: r.owner.login, avatarUrl: r.owner.avatarUrl, count: 1 })
    }
    const viewerLogin = viewer?.login
    return Array.from(map.values()).toSorted((a, b) => {
      if (a.login === viewerLogin) return -1
      if (b.login === viewerLogin) return 1
      return b.count - a.count || a.login.localeCompare(b.login)
    })
  }, [repos, viewer?.login])

  // Multi-select org filter. Empty = show all (chip "All" highlighted).
  const [activeOrgs, setActiveOrgs] = useState<Set<string>>(new Set())
  function toggleOrg(login: string) {
    setActiveOrgs((cur) => {
      const next = new Set(cur)
      if (next.has(login)) next.delete(login)
      else next.add(login)
      return next
    })
  }
  const visible = useMemo(() => {
    if (activeOrgs.size === 0) return repos
    return repos.filter((r) => activeOrgs.has(r.owner.login))
  }, [repos, activeOrgs])

  const chipRow = (
    <div className="hs-org-chips" role="group" aria-label="Filter by org">
      <button
        type="button"
        className={`hs-org-chip ${activeOrgs.size === 0 ? 'active' : ''}`}
        onClick={() => setActiveOrgs(new Set())}
        title="Show repos from every org"
      >
        <span className="hs-org-chip-label">All</span>
        <span className="hs-org-chip-count">{repos.length}</span>
      </button>
      {facets.map((f) => {
        const isActive = activeOrgs.has(f.login)
        const label = f.login === viewer?.login ? 'Personal' : f.login
        return (
          <button
            key={f.login}
            type="button"
            className={`hs-org-chip ${isActive ? 'active' : ''}`}
            onClick={() => toggleOrg(f.login)}
            aria-pressed={isActive}
            title={`${label} (${f.login}) — ${f.count} repo${f.count === 1 ? '' : 's'}`}
          >
            {f.avatarUrl ? (
              <img src={f.avatarUrl} alt="" className="hs-org-chip-avatar" />
            ) : (
              <span className="hs-org-chip-avatar hs-org-chip-avatar-fallback" />
            )}
            <span className="hs-org-chip-label">{label}</span>
            <span className="hs-org-chip-count">{f.count}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <RepoGridScope
      title="All repos"
      meta="Full repo list, sorted by recent activity"
      repos={visible}
      totalCount={repos.length}
      pinnedIds={pinnedIds}
      controls={chipRow}
      onOpenRepo={onOpenRepo}
      onTogglePinned={onTogglePinned}
    />
  )
}

export function OrgScope({ repos, pinned, onOpenRepo, onTogglePinned, login }: ScopeProps & { login: string }) {
  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.repoId)), [pinned])
  const orgRepos = useMemo(() => repos.filter((r) => r.owner.login === login), [repos, login])
  return (
    <RepoGridScope
      title={login}
      meta={`${orgRepos.length} repo${orgRepos.length === 1 ? '' : 's'} in @${login}`}
      repos={orgRepos}
      totalCount={orgRepos.length}
      pinnedIds={pinnedIds}
      onOpenRepo={onOpenRepo}
      onTogglePinned={onTogglePinned}
    />
  )
}

function RepoGridScope({
  title, meta, repos, totalCount, pinnedIds, controls, onOpenRepo, onTogglePinned
}: {
  title: string
  meta: string
  repos: Repo[]
  totalCount: number
  pinnedIds: Set<string>
  /** Optional content rendered above the archived/forks toggles — used by All repos for the org chip row. */
  controls?: ReactNode
  onOpenRepo: (r: Repo) => void
  onTogglePinned: (r: Repo) => void
}) {
  const [hideArchived, setHideArchived] = useState(true)
  const [hideForks, setHideForks] = useState(false)

  const filtered = useMemo(() => {
    return repos.filter((r) => {
      if (hideArchived && r.isArchived) return false
      if (hideForks && r.isFork) return false
      return true
    })
  }, [repos, hideArchived, hideForks])

  // Pinned-first within the filtered set so the most-watched repos surface at the top.
  const sorted = useMemo(() => {
    const pinnedRepos: Repo[] = []
    const rest: Repo[] = []
    for (const r of filtered) (pinnedIds.has(r.id) ? pinnedRepos : rest).push(r)
    return [...pinnedRepos, ...rest]
  }, [filtered, pinnedIds])

  // The header count reflects filtered/total within the current org selection,
  // not the full repo list — matches what the user actually sees on screen.
  const headerCount = `${filtered.length}${repos.length !== totalCount ? ` of ${totalCount}` : ''}`

  return (
    <main className="hs-main">
      <div className="hs-main-head">
        <h1>{title}</h1>
        <span className="hs-h-count">{headerCount}</span>
        <span className="hs-h-meta">{meta}</span>
      </div>
      {controls}
      <div className="hs-grid-controls">
        <label><input type="checkbox" checked={hideArchived} onChange={(e) => setHideArchived(e.target.checked)} /> No archived</label>
        <label><input type="checkbox" checked={hideForks} onChange={(e) => setHideForks(e.target.checked)} /> No forks</label>
      </div>
      {sorted.length === 0 ? (
        <div className="hs-empty">
          <strong>No repos match.</strong>
          Adjust the filters above.
        </div>
      ) : (
        <div className="grid hs-grid">
          {sorted.map((r) => (
            <RepoCard
              key={r.id}
              repo={r}
              pinned={pinnedIds.has(r.id)}
              onSelect={() => onOpenRepo(r)}
              onTogglePinned={() => onTogglePinned(r)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
