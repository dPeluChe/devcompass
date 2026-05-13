import { useMemo, useState } from 'react'
import type { Repo, RepoOpenPR } from '../../../api/github'
import type { ScopeKey } from '../types'
import { type ScopeProps } from './common'
import { ContributionHeatmap } from './ContributionHeatmap'

type Window = '24h' | '7d' | '30d'
const WINDOW_KEY = 'home.digestWindow'
const WINDOW_LABELS: Record<Window, string> = {
  '24h': 'Last 24h',
  '7d': 'This week',
  '30d': 'This month'
}
const WINDOW_DAYS: Record<Window, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30
}
const STALE_PR_DAYS = 14
const DORMANT_REPO_DAYS = 90

function loadWindow(): Window {
  try {
    const v = localStorage.getItem(WINDOW_KEY)
    if (v === '24h' || v === '7d' || v === '30d') return v
  } catch { /* ignore */ }
  return '7d'
}

/**
 * Operational digest — week-in-review style summary computed entirely from
 * `data.repos`. No extra API calls in v1: header counts, most-active repos,
 * open-PR contributor breakdown, and "needs attention" all derive from data
 * already loaded for Home / Repos.
 */
export function DigestScope({ token, viewer, repos, pinned, onOpenRepo, onScopeChange }: ScopeProps) {
  const [window, setWindow] = useState<Window>(loadWindow)

  function pickWindow(w: Window) {
    setWindow(w)
    try { localStorage.setItem(WINDOW_KEY, w) } catch { /* ignore */ }
  }

  const stats = useMemo(() => computeDigest(repos, pinned.length, window), [repos, pinned.length, window])

  return (
    <main className="hs-main">
      <div className="hs-main-head">
        <h1>Digest</h1>
        <span className="hs-h-meta">Operational snapshot · {WINDOW_LABELS[window]}</span>
        <div className="digest-window-picker" role="tablist" aria-label="Time window">
          {(['24h', '7d', '30d'] as const).map((w) => (
            <button
              key={w}
              type="button"
              className={`digest-window-btn ${window === w ? 'active' : ''}`}
              onClick={() => pickWindow(w)}
              aria-pressed={window === w}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      {/* Top-line counts */}
      <section className="hs-surface digest-stats">
        <DigestStat value={stats.totalRepos} label="Total repos" sub="across all orgs you can see" />
        <DigestStat value={stats.activeInWindow} label="Active in window" sub={`pushed in ${WINDOW_LABELS[window].toLowerCase()}`} />
        <DigestStat value={stats.openPRs} label="Open PRs" sub="across every visible repo" />
        <DigestStat value={stats.reposWithFailingCi} label="Repos with failing CI" sub="on at least one open PR" tone={stats.reposWithFailingCi > 0 ? 'warn' : undefined} />
        <DigestStat value={stats.stalePRs} label={`Stale PRs (>${STALE_PR_DAYS}d)`} sub="updated long ago" tone={stats.stalePRs > 0 ? 'warn' : undefined} />
        <DigestStat value={pinned.length} label="Pinned" sub="workbench shortcuts" />
      </section>

      {/* Viewer contribution heatmap — independent of window; cached 12h */}
      <ContributionHeatmap token={token} viewerLogin={viewer?.login} />

      {/* Most active repos */}
      <section className="digest-section">
        <h3 className="digest-section-title">
          Most active repos
          <span className="muted">— sorted by last push within window</span>
        </h3>
        {stats.mostActive.length === 0 ? (
          <div className="hs-empty"><strong>No repos pushed in this window.</strong></div>
        ) : (
          <ul className="digest-list">
            {stats.mostActive.map((r) => (
              <li key={r.id}>
                <button className="digest-row" onClick={() => onOpenRepo(r)} title={`Open ${r.nameWithOwner}`}>
                  <span className="digest-row-name">
                    <strong>{r.owner.login}</strong>
                    <span className="muted">/</span>
                    <span>{r.name}</span>
                  </span>
                  <span className="digest-row-meta muted">
                    pushed {shortAgo(r.pushedAt)}
                    {r.openPRs.totalCount > 0 && ` · ${r.openPRs.totalCount} PR${r.openPRs.totalCount === 1 ? '' : 's'}`}
                    {hasFailingCi(r) ? ' · CI ✕' : r.openPRs.totalCount > 0 ? ' · CI —' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open-PR contributors (cheap proxy: distinct authors across visible openPRs) */}
      <section className="digest-section">
        <h3 className="digest-section-title">
          Open-PR contributors
          <span className="muted">— who has the most open PRs across your visible repos</span>
        </h3>
        {stats.contributors.length === 0 ? (
          <div className="hs-empty"><strong>No open PRs found.</strong></div>
        ) : (
          <ul className="digest-contributor-list">
            {stats.contributors.map((c) => (
              <li key={c.login}>
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt="" />
                ) : (
                  <span className="digest-contrib-fallback" />
                )}
                <span className="digest-contrib-login">@{c.login}</span>
                <span className="muted">{c.prs} PR{c.prs === 1 ? '' : 's'} · {c.repoCount} repo{c.repoCount === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Needs attention */}
      <section className="digest-section">
        <h3 className="digest-section-title">Needs attention</h3>
        <ul className="digest-attn-list">
          <DigestAttn
            level={stats.reposWithFailingCi > 0 ? 'warn' : 'ok'}
            label={
              stats.reposWithFailingCi > 0
                ? `${stats.reposWithFailingCi} repo${stats.reposWithFailingCi === 1 ? '' : 's'} with failing CI on open PRs`
                : 'No failing CI on any open PR'
            }
            action={stats.reposWithFailingCi > 0 ? { label: 'Show in Repos →', onClick: () => onScopeChange?.('repos' as ScopeKey) } : undefined}
          />
          <DigestAttn
            level={stats.stalePRs > 0 ? 'warn' : 'ok'}
            label={
              stats.stalePRs > 0
                ? `${stats.stalePRs} open PR${stats.stalePRs === 1 ? '' : 's'} stale (untouched >${STALE_PR_DAYS}d)`
                : 'No stale PRs'
            }
          />
          <DigestAttn
            level={stats.dormantRepos > 0 ? 'info' : 'ok'}
            label={
              stats.dormantRepos > 0
                ? `${stats.dormantRepos} repo${stats.dormantRepos === 1 ? '' : 's'} dormant (>${DORMANT_REPO_DAYS}d since last push)`
                : 'All repos active'
            }
          />
        </ul>
      </section>
    </main>
  )
}

function DigestStat({ value, label, sub, tone }: { value: number | string; label: string; sub: string; tone?: 'warn' }) {
  return (
    <div className={`digest-stat ${tone ?? ''}`}>
      <span className="digest-stat-num">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="digest-stat-label">{label}</span>
      <span className="digest-stat-sub muted">{sub}</span>
    </div>
  )
}

type AttnLevel = 'ok' | 'info' | 'warn'
function DigestAttn({ level, label, action }: { level: AttnLevel; label: string; action?: { label: string; onClick: () => void } }) {
  const icon = level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '·'
  return (
    <li className={`digest-attn digest-attn-${level}`}>
      <span className="digest-attn-icon">{icon}</span>
      <span className="digest-attn-label">{label}</span>
      {action && (
        <button className="digest-attn-btn" onClick={action.onClick}>{action.label}</button>
      )}
    </li>
  )
}

/* ============================== Math ============================== */

type DigestStats = {
  totalRepos: number
  activeInWindow: number
  openPRs: number
  reposWithFailingCi: number
  stalePRs: number
  dormantRepos: number
  mostActive: Repo[]
  contributors: { login: string; avatarUrl?: string; prs: number; repoCount: number }[]
}

function computeDigest(repos: Repo[], _pinnedCount: number, window: Window): DigestStats {
  const now = Date.now()
  const windowMs = WINDOW_DAYS[window] * 86_400_000
  const staleMs = STALE_PR_DAYS * 86_400_000
  const dormantMs = DORMANT_REPO_DAYS * 86_400_000

  let activeInWindow = 0
  let openPRs = 0
  let reposWithFailingCi = 0
  let stalePRs = 0
  let dormantRepos = 0

  // Distinct authors across openPRs, with repo-set per author.
  const byAuthor = new Map<string, { login: string; avatarUrl?: string; prs: number; repos: Set<string> }>()

  for (const r of repos) {
    const lastPush = new Date(r.pushedAt).getTime()
    if (now - lastPush < windowMs) activeInWindow += 1
    if (now - lastPush > dormantMs) dormantRepos += 1
    openPRs += r.openPRs.totalCount
    if (hasFailingCi(r)) reposWithFailingCi += 1
    for (const pr of r.openPRs.nodes ?? []) {
      if (pr.author?.login) {
        const cur = byAuthor.get(pr.author.login)
        if (cur) { cur.prs += 1; cur.repos.add(r.nameWithOwner) }
        else byAuthor.set(pr.author.login, { login: pr.author.login, avatarUrl: pr.author.avatarUrl, prs: 1, repos: new Set([r.nameWithOwner]) })
      }
      if (now - new Date(pr.updatedAt).getTime() > staleMs) stalePRs += 1
    }
  }

  const mostActive = repos
    .filter((r) => now - new Date(r.pushedAt).getTime() < windowMs)
    .toSorted((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
    .slice(0, 8)

  const contributors = Array.from(byAuthor.values())
    .map((e) => ({ login: e.login, avatarUrl: e.avatarUrl, prs: e.prs, repoCount: e.repos.size }))
    .toSorted((a, b) => b.prs - a.prs || b.repoCount - a.repoCount || a.login.localeCompare(b.login))
    .slice(0, 8)

  return {
    totalRepos: repos.length,
    activeInWindow,
    openPRs,
    reposWithFailingCi,
    stalePRs,
    dormantRepos,
    mostActive,
    contributors
  }
}

function hasFailingCi(r: Repo): boolean {
  return (r.openPRs.nodes ?? []).some((pr: RepoOpenPR) => pr.ciState === 'FAILURE' || pr.ciState === 'ERROR')
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return `${Math.floor(day / 30)}mo ago`
}
