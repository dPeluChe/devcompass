import { useEffect, useState, type ReactNode } from 'react'
import { fetchRepoDetail, type RepoDetail as RepoDetailT } from '../api/github'
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
            {tab === 'overview' && <OverviewTab data={data} />}
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

function OverviewTab({ data }: { data: RepoDetailT }) {
  return (
    <div className="rd-grid">
      <Surface title="Summary">
        <KV k="Default branch" v={data.defaultBranchRef?.name ?? '—'} />
        <KV k="Size on disk" v={data.diskUsage != null ? `${(data.diskUsage / 1024).toFixed(1)} MB` : '—'} />
        <KV k="License" v={data.licenseInfo?.name ?? '—'} />
        {data.homepageUrl && <KV k="Homepage" v={<a href={data.homepageUrl} target="_blank" rel="noreferrer">{data.homepageUrl}</a>} />}
        <KV k="Created" v={fmtDate(data.createdAt)} />
        <KV k="Last push" v={fmtDate(data.pushedAt)} />
        <KV k="Last updated" v={fmtDate(data.updatedAt)} />
      </Surface>

      <Surface title="Engagement">
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
    </div>
  )
}

function pct(size: number, total: number): string {
  return `${((size / total) * 100).toFixed(1)}%`
}

/* ============================== Lists ============================== */

function CommitsTab({ data }: { data: RepoDetailT }) {
  const commits = branchCommits(data)
  if (commits.length === 0) return <EmptyState label="No visible commits on the default branch." />
  return (
    <section className="hs-surface rd-list">
      {commits.map((c) => (
        <a key={c.oid} className="rd-row" href={c.url} target="_blank" rel="noreferrer">
          <code className="rd-sha">{c.oid.slice(0, 7)}</code>
          <div className="rd-row-main">
            <div className="rd-row-title">{c.messageHeadline}</div>
            <div className="rd-row-meta muted">
              {c.author?.user?.login ?? c.author?.name ?? 'unknown'} · {shortAgo(c.committedDate)}
            </div>
          </div>
        </a>
      ))}
    </section>
  )
}

function PRsTab({ data }: { data: RepoDetailT }) {
  if (data.pullRequests.nodes.length === 0) return <EmptyState label="No open pull requests." />
  return (
    <section className="hs-surface rd-list">
      {data.pullRequests.nodes.map((pr) => (
        <a key={pr.number} className="rd-row" href={pr.url} target="_blank" rel="noreferrer">
          <span className="rd-pr-num">#{pr.number}</span>
          <div className="rd-row-main">
            <div className="rd-row-title">
              {pr.isDraft && <span className="rd-tag">draft</span>}
              {pr.title}
            </div>
            <div className="rd-row-meta muted">
              {pr.author?.login ?? 'unknown'} · updated {shortAgo(pr.updatedAt)}
            </div>
          </div>
        </a>
      ))}
    </section>
  )
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
