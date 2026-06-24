import { useMemo, useState } from 'react'
import type { Repo } from '../../../api/github'
import type { ScopeKey } from '../types'
import { type ScopeProps } from './common'
import { ContributionHeatmap } from './ContributionHeatmap'
import { useMergedStats, useRepoActivity, formatDuration } from '../useDigestExtras'
import {
  type Window,
  WINDOW_DAYS, WINDOW_LABELS,
  STALE_PR_DAYS, DORMANT_REPO_DAYS,
  computeDigest, hasFailingCi, shortAgo,
} from './digestMath'
import { DigestStat, DigestAttn, Sparkline } from './DigestParts'

const WINDOW_KEY = 'home.digestWindow'

function loadWindow(): Window {
  try {
    const v = localStorage.getItem(WINDOW_KEY)
    if (v === '24h' || v === '7d' || v === '30d') return v
  } catch { /* ignore */ }
  return '7d'
}

export function DigestScope({ token, viewer, repos, pinned, onOpenRepo, onScopeChange }: ScopeProps) {
  const [window, setWindow] = useState<Window>(loadWindow)

  function pickWindow(w: Window) {
    setWindow(w)
    try { localStorage.setItem(WINDOW_KEY, w) } catch { /* ignore */ }
  }

  const stats = useMemo(() => computeDigest(repos, pinned.length, window), [repos, pinned.length, window])

  const mergedQuery = useMergedStats(token, viewer?.login, WINDOW_DAYS[window])
  const activityQuery = useRepoActivity(token, stats.mostActive, WINDOW_DAYS[window])

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

      <section className="hs-surface digest-stats digest-stats-primary">
        <DigestStat value={stats.activeInWindow} label="Active in window" sub={`pushed in ${WINDOW_LABELS[window].toLowerCase()}`} />
        <DigestStat value={stats.openPRs} label="Open PRs" sub="across every visible repo" />
        <DigestStat value={stats.reposWithFailingCi} label="Repos with failing CI" sub="on at least one open PR" tone={stats.reposWithFailingCi > 0 ? 'warn' : undefined} />
        <DigestStat value={stats.stalePRs} label={`Stale PRs (>${STALE_PR_DAYS}d)`} sub="updated long ago" tone={stats.stalePRs > 0 ? 'warn' : undefined} />
      </section>

      <section className="hs-surface digest-stats digest-stats-secondary">
        <DigestStat value={stats.totalRepos} label="Total repos" sub="across all orgs you can see" />
        <DigestStat
          value={mergedQuery.data ? mergedQuery.data.count : '…'}
          label="PRs merged"
          sub="involving you, in window"
        />
        <DigestStat
          value={mergedQuery.data?.avgTimeToMergeMs != null ? formatDuration(mergedQuery.data.avgTimeToMergeMs) : '—'}
          label="Avg time to merge"
          sub="open → merged"
        />
        <DigestStat value={pinned.length} label="Pinned" sub="workbench shortcuts" />
      </section>

      <ContributionHeatmap token={token} viewerLogin={viewer?.login} />

      <section className="digest-section">
        <h3 className="digest-section-title">
          Most active repos
          <span className="muted">— sorted by last push within window</span>
        </h3>
        {stats.mostActive.length === 0 ? (
          <div className="hs-empty"><strong>No repos pushed in this window.</strong></div>
        ) : (
          <ul className="digest-list">
            {stats.mostActive.map((r: Repo) => (
              <li key={r.id}>
                <button className="digest-row" onClick={() => onOpenRepo(r)} title={`Open ${r.nameWithOwner}`}>
                  <span className="digest-row-name">
                    <strong>{r.owner.login}</strong>
                    <span className="muted">/</span>
                    <span>{r.name}</span>
                  </span>
                  <Sparkline buckets={activityQuery.data?.[r.nameWithOwner]} />
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
