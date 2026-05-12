import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBranches, fetchRepoDetail, type Branch, type RepoDetail as RepoDetailT } from '../api/github'
import { OrgChip } from './home/OrgChip'
import { FaCodeBranch, FaExclamationCircle, FaLock, FaLockOpen, FaStar, FaTag, FaCheck, FaExclamation } from 'react-icons/fa'

type Props = {
  token: string
  owner: string
  name: string
  onClose: () => void
}

type Tab = 'overview' | 'commits' | 'prs' | 'issues' | 'releases'

export function RepoDetail({ token, owner, name, onClose }: Props) {
  const [data, setData] = useState<RepoDetailT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    setTab('overview')
    ;(async () => {
      try {
        const d = await fetchRepoDetail(token, owner, name)
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [token, owner, name])

  return (
    <aside className="rd">
      <RdHeader owner={owner} name={name} data={data} onClose={onClose} />

      {error && <pre className="error-inline rd-error">{error}</pre>}
      {!data && !error && <RdLoading />}

      {data && (
        <>
          <RdTabs
            tab={tab}
            onChange={setTab}
            commitCount={branchCommitsTotal(data) ?? 0}
            prCount={data.pullRequests.totalCount}
            issueCount={data.issues.totalCount}
            releaseCount={data.releases.totalCount}
          />
          <div className="rd-body">
            {tab === 'overview' && <OverviewTab token={token} owner={owner} name={name} data={data} />}
            {tab === 'commits' && <CommitsTab data={data} />}
            {tab === 'prs' && <PRsTab data={data} />}
            {tab === 'issues' && <IssuesTab data={data} />}
            {tab === 'releases' && <ReleasesTab data={data} />}
          </div>
        </>
      )}
    </aside>
  )
}

/* ============================== Header ============================== */

function RdHeader({ owner, name, data, onClose }: { owner: string; name: string; data: RepoDetailT | null; onClose: () => void }) {
  const ci = data ? statusCheck(data) : null
  return (
    <header className="rd-head">
      <div className="rd-head-main">
        <div className="rd-head-id">
          <OrgChip login={owner} avatarUrl={data?.owner.avatarUrl} size={28} />
          <div className="rd-head-titles">
            <h1 className="rd-title">
              <a className="muted" href={data?.owner.url ?? `https://github.com/${owner}`} target="_blank" rel="noreferrer">{owner}</a>
              <span className="rd-sep">/</span>
              <span>{name}</span>
            </h1>
            {data?.description && <p className="rd-desc">{data.description}</p>}
          </div>
        </div>
        <div className="rd-head-actions">
          {data && (
            <a className="rd-btn" href={data.url} target="_blank" rel="noreferrer" title="Open in GitHub">
              Open in GitHub ↗
            </a>
          )}
          <button className="rd-btn rd-btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {data && (
        <div className="rd-head-meta">
          <span className="rd-pill" title={data.isPrivate ? 'Private repo' : 'Public repo'}>
            {data.isPrivate ? <FaLock size={9} /> : <FaLockOpen size={9} />}
            {data.isPrivate ? 'Private' : 'Public'}
          </span>
          {data.isArchived && (
            <span className="rd-pill rd-pill-warn" title="Archived"><FaExclamationCircle size={9} /> Archived</span>
          )}
          {data.isFork && (
            <span className="rd-pill" title="Forked"><FaCodeBranch size={9} /> Fork</span>
          )}
          {data.primaryLanguage && (
            <span className="rd-pill" title={`Primary language: ${data.primaryLanguage.name}`}>
              <span className="rd-lang-dot" style={{ background: data.primaryLanguage.color ?? '#888' }} />
              {data.primaryLanguage.name}
            </span>
          )}
          {ci && (
            <span className={`rd-pill rd-pill-ci ${ciClass(ci)}`} title={`Default branch CI: ${ci}`}>
              {ci === 'SUCCESS' ? <FaCheck size={9} /> : <FaExclamation size={9} />}
              CI {ci.toLowerCase()}
            </span>
          )}
          <span className="rd-stat" title="Stars"><FaStar size={10} /> {data.stargazerCount}</span>
          <span className="rd-stat" title="Forks"><FaCodeBranch size={10} /> {data.forkCount}</span>
          <span className="rd-stat" title="Last push">pushed {shortAgo(data.pushedAt)}</span>
        </div>
      )}

      {data && data.repositoryTopics.nodes.length > 0 && (
        <div className="rd-topics">
          {data.repositoryTopics.nodes.map((t) => (
            <span key={t.topic.name} className="rd-topic">{t.topic.name}</span>
          ))}
        </div>
      )}
    </header>
  )
}

function ciClass(state: string): string {
  if (state === 'SUCCESS') return 'ok'
  if (state === 'FAILURE' || state === 'ERROR') return 'fail'
  return 'pending'
}

/* ============================== Tabs ============================== */

function RdTabs({
  tab, onChange, commitCount, prCount, issueCount, releaseCount
}: {
  tab: Tab
  onChange: (t: Tab) => void
  commitCount: number
  prCount: number
  issueCount: number
  releaseCount: number
}) {
  return (
    <nav className="rd-tabs" aria-label="Repo sections">
      <TabButton active={tab === 'overview'} onClick={() => onChange('overview')} label="Overview" />
      <TabButton active={tab === 'commits'} onClick={() => onChange('commits')} label="Commits" count={commitCount} />
      <TabButton active={tab === 'prs'} onClick={() => onChange('prs')} label="Pull requests" count={prCount} />
      <TabButton active={tab === 'issues'} onClick={() => onChange('issues')} label="Issues" count={issueCount} />
      <TabButton active={tab === 'releases'} onClick={() => onChange('releases')} label="Releases" count={releaseCount} />
    </nav>
  )
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      className={`rd-tab ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      {count !== undefined && <span className="rd-tab-count">{count}</span>}
    </button>
  )
}

/* ============================== Overview ============================== */

function OverviewTab({ token, owner, name, data }: { token: string; owner: string; name: string; data: RepoDetailT }) {
  const ageDays = Math.max(1, (Date.now() - new Date(data.createdAt).getTime()) / 86_400_000)
  const totalCommits = branchCommitsTotal(data) ?? 0
  const commitsPerWeek = totalCommits > 0 ? ((totalCommits / ageDays) * 7).toFixed(1) : '0'

  return (
    <div className="rd-grid">
      <Surface title="Summary">
        <KV k="Default branch" v={data.defaultBranchRef?.name ?? '—'} />
        <KV k="Size on disk" v={data.diskUsage != null ? `${(data.diskUsage / 1024).toFixed(1)} MB` : '—'} />
        <KV k="License" v={data.licenseInfo?.name ?? '—'} />
        {data.homepageUrl && <KV k="Homepage" v={<a href={data.homepageUrl} target="_blank" rel="noreferrer">{data.homepageUrl}</a>} />}
        <KV k="Created" v={`${fmtDate(data.createdAt)} (${shortAgo(data.createdAt)})`} />
        <KV k="Last push" v={`${fmtDate(data.pushedAt)} (${shortAgo(data.pushedAt)})`} />
      </Surface>

      <Surface title="Activity">
        <KV k="Total commits" v={totalCommits.toLocaleString()} />
        <KV k="Commits / week" v={`${commitsPerWeek} avg since creation`} />
        <KV k={<><FaStar size={10} /> Stars</>} v={data.stargazerCount} />
        <KV k={<><FaCodeBranch size={10} /> Forks</>} v={data.forkCount} />
        <KV k="Watchers" v={data.watchers.totalCount} />
        <KV k="Mentionable users" v={data.mentionableUsers.totalCount} />
      </Surface>

      {data.languages.edges.length > 0 && (
        <Surface title="Languages" wide>
          <div className="rd-lang-bar">
            {data.languages.edges.map((e) => (
              <span
                key={e.node.name}
                className="rd-lang-seg"
                title={`${e.node.name} · ${pct(e.size, data.languages.totalSize)}`}
                style={{ width: pct(e.size, data.languages.totalSize), background: e.node.color ?? '#888' }}
              />
            ))}
          </div>
          <ul className="rd-lang-list">
            {data.languages.edges.map((e) => (
              <li key={e.node.name}>
                <span className="rd-lang-dot" style={{ background: e.node.color ?? '#888' }} />
                <span>{e.node.name}</span>
                <span className="muted">{pct(e.size, data.languages.totalSize)}</span>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <BranchesSurface token={token} owner={owner} name={name} defaultBranch={data.defaultBranchRef?.name ?? null} />
    </div>
  )
}

/* ============================== Branches surface ============================== */

function BranchesSurface({ token, owner, name, defaultBranch }: { token: string; owner: string; name: string; defaultBranch: string | null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['branches', owner, name],
    queryFn: () => fetchBranches(token, owner, name),
    staleTime: 5 * 60 * 1000
  })
  const branches: Branch[] = data ?? []
  const top = branches.slice(0, 10)

  return (
    <Surface title={`Branches${branches.length > 0 ? ` (${branches.length})` : ''}`}>
      {isLoading && <div className="hs-skeleton-bar" style={{ width: '70%' }} />}
      {error && <span className="muted">Failed to load branches.</span>}
      {!isLoading && !error && top.length === 0 && <span className="muted">No branches.</span>}
      {top.map((b) => {
        const isDefault = b.name === defaultBranch
        const author = b.target.author?.user?.login
        return (
          <div key={b.name} className="rd-branch">
            <FaCodeBranch size={11} className="rd-branch-icon" />
            <span className="rd-branch-name">
              {b.name}
              {isDefault && <span className="rd-tag">default</span>}
            </span>
            <span className="rd-branch-meta muted">
              {author ? `@${author} · ` : ''}{shortAgo(b.target.committedDate)}
            </span>
          </div>
        )
      })}
      {branches.length > top.length && (
        <div className="muted" style={{ fontSize: '0.8em', marginTop: 8 }}>
          + {branches.length - top.length} more
        </div>
      )}
    </Surface>
  )
}

function pct(size: number, total: number): string {
  return `${((size / total) * 100).toFixed(1)}%`
}

/* ============================== Lists ============================== */

const COMMITS_PAGE_SIZE = 20

function CommitsTab({ data }: { data: RepoDetailT }) {
  const commits = branchCommits(data)
  const totalCommits = branchCommitsTotal(data) ?? 0
  const [page, setPage] = useState(0)

  if (commits.length === 0) return <EmptyState label="No visible commits on the default branch." />

  const pageCount = Math.max(1, Math.ceil(commits.length / COMMITS_PAGE_SIZE))
  const start = page * COMMITS_PAGE_SIZE
  const visible = commits.slice(start, start + COMMITS_PAGE_SIZE)
  const showingFrom = start + 1
  const showingTo = start + visible.length

  return (
    <div className="rd-commits">
      <CommitsStats commits={commits} totalCommits={totalCommits} />
      <section className="hs-surface rd-list">
        {visible.map((c) => (
          <a key={c.oid} className="rd-row" href={c.url} target="_blank" rel="noreferrer">
            <code className="rd-sha">{c.oid.slice(0, 7)}</code>
            <div className="rd-row-main">
              <div className="rd-row-title">{c.messageHeadline}</div>
              <div className="rd-row-meta muted">
                {c.author?.user?.avatarUrl && (
                  <img className="rd-row-avatar" src={c.author.user.avatarUrl} alt="" />
                )}
                <span>{c.author?.user?.login ?? c.author?.name ?? 'unknown'}</span>
                <span>·</span>
                <span>{shortAgo(c.committedDate)}</span>
              </div>
            </div>
          </a>
        ))}
      </section>
      {pageCount > 1 && (
        <nav className="rd-pager" aria-label="Commits pagination">
          <button
            type="button"
            className="rd-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Prev
          </button>
          <span className="rd-pager-status muted">
            {showingFrom}–{showingTo} of {commits.length} fetched
            {totalCommits > commits.length && <> · {totalCommits.toLocaleString()} total</>}
          </span>
          <button
            type="button"
            className="rd-btn"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  )
}

type Contributor = { login: string; avatarUrl: string | null; count: number }

function CommitsStats({ commits, totalCommits }: { commits: ReturnType<typeof branchCommits>; totalCommits: number }) {
  const stats = useMemo(() => {
    const times = commits.map((c) => new Date(c.committedDate).getTime())
    const newest = Math.max(...times)
    const oldest = Math.min(...times)
    const spanDays = Math.max(1, (newest - oldest) / 86_400_000)
    const rate = (commits.length / spanDays) * 7 // commits / week in the visible window

    const byAuthor = new Map<string, Contributor>()
    for (const c of commits) {
      const login = c.author?.user?.login ?? c.author?.name ?? 'unknown'
      const avatarUrl = c.author?.user?.avatarUrl ?? null
      const cur = byAuthor.get(login)
      if (cur) cur.count += 1
      else byAuthor.set(login, { login, avatarUrl, count: 1 })
    }
    const contributors = Array.from(byAuthor.values()).toSorted((a, b) => b.count - a.count).slice(0, 4)

    // Distinct days touched in the visible window.
    const days = new Set(commits.map((c) => c.committedDate.slice(0, 10)))

    return {
      lastCommitAge: shortAgo(new Date(newest).toISOString()),
      windowSpan: spanDays >= 1 ? `last ${Math.round(spanDays)}d` : 'last day',
      rate: rate.toFixed(1),
      activeDays: days.size,
      contributors
    }
  }, [commits])

  return (
    <section className="hs-surface rd-commits-stats">
      <div className="rd-stat-block">
        <span className="rd-stat-num">{totalCommits.toLocaleString()}</span>
        <span className="rd-stat-label">total commits</span>
      </div>
      <div className="rd-stat-block">
        <span className="rd-stat-num">{stats.rate}</span>
        <span className="rd-stat-label">/ week ({stats.windowSpan})</span>
      </div>
      <div className="rd-stat-block">
        <span className="rd-stat-num">{stats.activeDays}</span>
        <span className="rd-stat-label">active days ({stats.windowSpan})</span>
      </div>
      <div className="rd-stat-block">
        <span className="rd-stat-num">{stats.lastCommitAge}</span>
        <span className="rd-stat-label">since last commit</span>
      </div>
      {stats.contributors.length > 0 && (
        <div className="rd-stat-block rd-stat-contributors">
          <span className="rd-stat-label">Top contributors ({commits.length} commits sampled)</span>
          <div className="rd-contributor-list">
            {stats.contributors.map((c) => (
              <span key={c.login} className="rd-contributor" title={`${c.login} — ${c.count} commit${c.count === 1 ? '' : 's'}`}>
                {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span className="rd-contributor-fallback" />}
                <span className="rd-contributor-login">@{c.login}</span>
                <span className="rd-contributor-count">{c.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

type PRStateFilter = 'all' | 'OPEN' | 'MERGED' | 'CLOSED'

function PRsTab({ data }: { data: RepoDetailT }) {
  const prs = data.pullRequests.nodes
  const [filter, setFilter] = useState<PRStateFilter>('all')

  const counts = useMemo(() => {
    const c = { all: prs.length, OPEN: 0, MERGED: 0, CLOSED: 0 }
    for (const pr of prs) c[pr.state] += 1
    return c
  }, [prs])

  const visible = useMemo(() => {
    if (filter === 'all') return prs
    return prs.filter((pr) => pr.state === filter)
  }, [prs, filter])

  if (prs.length === 0) return <EmptyState label="No pull requests in this repo." />

  return (
    <div className="rd-prs">
      <div className="rd-state-filters" role="tablist" aria-label="Filter by state">
        <StateFilterBtn label="All" count={counts.all} active={filter === 'all'} onClick={() => setFilter('all')} />
        <StateFilterBtn label="Open" count={counts.OPEN} active={filter === 'OPEN'} onClick={() => setFilter('OPEN')} variant="open" />
        <StateFilterBtn label="Merged" count={counts.MERGED} active={filter === 'MERGED'} onClick={() => setFilter('MERGED')} variant="merged" />
        <StateFilterBtn label="Closed" count={counts.CLOSED} active={filter === 'CLOSED'} onClick={() => setFilter('CLOSED')} variant="closed" />
      </div>
      {visible.length === 0 ? (
        <EmptyState label={`No ${filter.toLowerCase()} pull requests.`} />
      ) : (
        <section className="hs-surface rd-list">
          {visible.map((pr) => (
            <a key={pr.number} className={`rd-row rd-pr-row state-${pr.state.toLowerCase()}`} href={pr.url} target="_blank" rel="noreferrer">
              <span className="rd-pr-num">#{pr.number}</span>
              <div className="rd-row-main">
                <div className="rd-row-title">
                  <PrStateBadge state={pr.state} isDraft={pr.isDraft} />
                  {pr.title}
                </div>
                <div className="rd-row-meta muted">
                  {pr.author?.login ?? 'unknown'} · {prTimeLabel(pr)}
                </div>
              </div>
            </a>
          ))}
        </section>
      )}
    </div>
  )
}

function StateFilterBtn({
  label, count, active, onClick, variant
}: { label: string; count: number; active: boolean; onClick: () => void; variant?: 'open' | 'merged' | 'closed' }) {
  return (
    <button
      type="button"
      className={`rd-state-filter ${active ? 'active' : ''} ${variant ? `v-${variant}` : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{label}</span>
      <span className="rd-state-filter-count">{count}</span>
    </button>
  )
}

function PrStateBadge({ state, isDraft }: { state: 'OPEN' | 'CLOSED' | 'MERGED'; isDraft: boolean }) {
  if (isDraft && state === 'OPEN') return <span className="rd-state-pill state-draft">draft</span>
  if (state === 'OPEN') return <span className="rd-state-pill state-open">open</span>
  if (state === 'MERGED') return <span className="rd-state-pill state-merged">merged</span>
  return <span className="rd-state-pill state-closed">closed</span>
}

function prTimeLabel(pr: RepoDetailT['pullRequests']['nodes'][number]): string {
  if (pr.state === 'MERGED' && pr.mergedAt) return `merged ${shortAgo(pr.mergedAt)}`
  if (pr.state === 'CLOSED' && pr.closedAt) return `closed ${shortAgo(pr.closedAt)}`
  return `updated ${shortAgo(pr.updatedAt)}`
}

function IssuesTab({ data }: { data: RepoDetailT }) {
  if (data.issues.nodes.length === 0) return <EmptyState label="No open issues." />
  return (
    <section className="hs-surface rd-list">
      {data.issues.nodes.map((it) => (
        <a key={it.number} className="rd-row" href={it.url} target="_blank" rel="noreferrer">
          <span className="rd-pr-num">#{it.number}</span>
          <div className="rd-row-main">
            <div className="rd-row-title">{it.title}</div>
            <div className="rd-row-meta muted">
              {it.labels.nodes.length > 0 && (
                <span className="rd-labels">
                  {it.labels.nodes.map((l) => (
                    <span
                      key={l.name}
                      className="rd-label"
                      style={{ background: `#${l.color}26`, borderColor: `#${l.color}` }}
                    >
                      {l.name}
                    </span>
                  ))}
                </span>
              )}
              <span>{it.author?.login ?? 'unknown'} · updated {shortAgo(it.updatedAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </section>
  )
}

function ReleasesTab({ data }: { data: RepoDetailT }) {
  if (data.releases.nodes.length === 0) return <EmptyState label="No releases." />
  return (
    <section className="hs-surface rd-list">
      {data.releases.nodes.map((r) => (
        <a key={r.tagName} className="rd-row" href={r.url} target="_blank" rel="noreferrer">
          <span className="rd-row-icon"><FaTag size={11} /></span>
          <div className="rd-row-main">
            <div className="rd-row-title">
              {r.name ?? r.tagName}
              {r.isPrerelease && <span className="rd-tag">pre-release</span>}
            </div>
            <div className="rd-row-meta muted">
              {r.tagName} · {r.publishedAt ? `published ${shortAgo(r.publishedAt)}` : 'unpublished'}
            </div>
          </div>
        </a>
      ))}
    </section>
  )
}

/* ============================== Pieces ============================== */

function Surface({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`hs-surface rd-surface ${wide ? 'rd-surface-wide' : ''}`}>
      <h3 className="rd-surface-title">{title}</h3>
      {children}
    </section>
  )
}

function KV({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="rd-kv">
      <span className="rd-kv-key muted">{k}</span>
      <span className="rd-kv-val">{v}</span>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="hs-empty"><strong>{label}</strong></div>
}

function RdLoading() {
  return (
    <div className="rd-loading" aria-busy="true" aria-live="polite">
      <div className="hs-skeleton-bar" style={{ width: '60%' }} />
      <div className="hs-skeleton-bar" style={{ width: '40%' }} />
      <div className="hs-skeleton-bar" style={{ width: '90%' }} />
    </div>
  )
}

/* ============================== Helpers ============================== */

function branchCommits(d: RepoDetailT) {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'history' in t) {
    return (t as { history: { nodes: { oid: string; messageHeadline: string; committedDate: string; url: string; author: { name: string | null; user: { login: string; avatarUrl: string } | null } | null }[] } }).history.nodes
  }
  return []
}

function branchCommitsTotal(d: RepoDetailT): number | null {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'history' in t) {
    return (t as { history: { totalCount: number } }).history.totalCount
  }
  return null
}

function statusCheck(d: RepoDetailT): string | null {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'statusCheckRollup' in t) {
    return (t as { statusCheckRollup: { state: string } | null }).statusCheckRollup?.state ?? null
  }
  return null
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(day / 365)}y ago`
}
