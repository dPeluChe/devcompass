import { useMemo, useState } from 'react'
import type { RepoDetail as RepoDetailT } from '../../api/github'
import { EmptyState } from './common'
import { branchCommits, branchCommitsTotal, shortAgo } from './utils'

const COMMITS_PAGE_SIZE = 20

export function CommitsTab({ data }: { data: RepoDetailT }) {
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
      <div className="rd-stat-chips">
        <span className="rd-stat-chip">
          <strong>{totalCommits.toLocaleString()}</strong>
          <span>commits · all-time</span>
        </span>
        <span className="rd-stat-chip">
          <strong>{stats.rate}<span className="rd-stat-chip-unit">/wk</span></strong>
          <span>over {stats.windowSpan}</span>
        </span>
        <span className="rd-stat-chip">
          <strong>{stats.activeDays}</strong>
          <span>active days · {stats.windowSpan}</span>
        </span>
        <span className="rd-stat-chip">
          <strong>{stats.lastCommitAge}</strong>
          <span>since last commit</span>
        </span>
      </div>
      {stats.contributors.length > 0 && (
        <div className="rd-stat-contributors">
          <span className="rd-stat-contrib-head">
            <strong>Top contributors</strong>
            <span className="muted">sampled from the {commits.length} most recent commits</span>
          </span>
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
