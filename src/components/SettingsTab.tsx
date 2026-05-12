import { useEffect, useState } from 'react'
import { db, getDbStats, clearAllRepos, clearOldRepos, type PinnedRepo, getPinnedRepos, unpinRepo, getOrgsByOrder, getStorageBreakdown, type StorageBreakdown } from '../store/db'
import { ConfirmDialog } from './ConfirmDialog'

interface DbStats {
  repoCount: number
  orgCount: number
  pinnedCount: number
  tokenCount: number
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function timeAgo(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return `${Math.floor(day / 30)}mo ago`
}


type SettingsPanel = 'all' | 'storage' | 'cache' | 'pinned' | 'orgOrder'

type Props = {
  panel?: SettingsPanel
  /** Wires Dashboard's loadReposSequentially(true) so the "Hard refresh" button
   *  can drop the cache and pull a fresh copy without a full page reload. */
  onForceResync?: () => void
}

export function SettingsTab({ panel = 'all', onForceResync }: Props) {
  const [stats, setStats] = useState<DbStats | null>(null)
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null)
  const [pinned, setPinned] = useState<PinnedRepo[]>([])
  const [orgs, setOrgs] = useState<{ login: string; order: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [s, b, p, o] = await Promise.all([
      getDbStats(),
      getStorageBreakdown(),
      getPinnedRepos(),
      getOrgsByOrder()
    ])
    setStats(s)
    setBreakdown(b)
    setPinned(p)
    setOrgs(o)
    setLoading(false)
  }

  const [busy, setBusy] = useState<'clear' | 'hard' | null>(null)
  const [confirmKind, setConfirmKind] = useState<'clear' | 'hard' | null>(null)

  async function doClearCache() {
    setConfirmKind(null)
    setBusy('clear')
    try {
      await clearAllRepos()
      await loadData()
    } finally { setBusy(null) }
  }

  async function doHardRefresh() {
    setConfirmKind(null)
    setBusy('hard')
    try {
      await clearAllRepos()
      await loadData()
      onForceResync?.()
    } finally { setBusy(null) }
  }

  async function handleClearOld() {
    await clearOldRepos(0)
    await loadData()
  }

  async function handleUnpin(repoId: string) {
    await unpinRepo(repoId)
    await loadData()
  }

  if (loading) {
    return <div className="settings-tab"><p>Loading…</p></div>
  }

  return (
    <div className="settings-tab">
      {(panel === 'all' || panel === 'storage') && <section>
        <h2>Storage</h2>
        <p className="muted storage-blurb">
          Everything below lives <strong>only in your browser</strong>. The app
          never sends your data to anywhere except <code>api.github.com</code>,
          and IndexedDB + localStorage are scoped to this origin — other sites
          can't read it.
        </p>

        <div className="stats-grid storage-stats">
          <div className="stat">
            <span className="stat-value">{breakdown?.repos ?? stats?.repoCount ?? 0}</span>
            <span className="stat-label">Repos</span>
            <span className="stat-sub muted">cached repos table</span>
          </div>
          <div className="stat">
            <span className="stat-value">{breakdown?.pinned ?? stats?.pinnedCount ?? 0}</span>
            <span className="stat-label">Pinned</span>
            <span className="stat-sub muted">workbench-pinned</span>
          </div>
          <div className="stat">
            <span className="stat-value">{breakdown?.snoozed ?? 0}</span>
            <span className="stat-label">Snoozed</span>
            <span className="stat-sub muted">PRs hidden until later</span>
          </div>
          <div className="stat">
            <span className="stat-value">{breakdown?.prefs ?? 0}</span>
            <span className="stat-label">API cache rows</span>
            <span className="stat-sub muted">see Cache tab</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatBytes(breakdown?.usageBytes ?? null)}</span>
            <span className="stat-label">On disk</span>
            <span className="stat-sub muted">
              {breakdown?.quotaBytes
                ? `of ~${formatBytes(breakdown.quotaBytes)}`
                : 'used'}
            </span>
          </div>
        </div>

        <div className="storage-detail">
          <h3>Where it lives</h3>
          <ul className="storage-where">
            <li>
              <code>localStorage["ghviewer.pat"]</code>
              <span className="muted">
                Your GitHub Personal Access Token — used as the <code>Authorization: Bearer …</code>
                header on every request to <code>api.github.com</code>. Never sent anywhere else.
                Wiped by Logout, Clear all cache won't touch it.
              </span>
            </li>
            <li>
              <code>localStorage["ghviewer-storage"]</code> · <code>"ghviewer-org-config"</code>
              <span className="muted">
                UI prefs: sidebar collapsed flag, default merge method, the per-org
                enabled/sync toggles. Tiny.
              </span>
            </li>
            <li>
              <code>IndexedDB "ghviewer"</code>
              <span className="muted">
                Repos, orgs, pinned items, snoozes, token meta, and the per-API
                response cache (viewer / tokenInfo / userOrgs / PR detail / branches /
                since-last-visit snapshot). All scoped to this origin.
              </span>
            </li>
          </ul>

          <h3>Security model</h3>
          <ul className="storage-where">
            <li>
              <strong>No backend.</strong>
              <span className="muted">
                The app is a static SPA. Outgoing traffic is exclusively to
                <code>api.github.com</code>; nothing is sent to any other origin.
              </span>
            </li>
            <li>
              <strong>Token never leaves your browser.</strong>
              <span className="muted">
                It's read from localStorage and attached to GitHub requests as the
                <code>Authorization</code> header. There's no analytics, telemetry,
                or third-party SDK that could read it.
              </span>
            </li>
            <li>
              <strong>Per-origin sandboxing.</strong>
              <span className="muted">
                Browsers isolate localStorage + IndexedDB per origin — other sites
                in other tabs cannot read this data. Clearing browser site data
                wipes it completely.
              </span>
            </li>
            <li>
              <strong>Scope your PAT minimally.</strong>
              <span className="muted">
                Recommended scopes are <code>repo</code> + <code>read:org</code>.
                Avoid <code>admin:org</code> or <code>delete_repo</code> unless you
                need them — a smaller scope limits exposure if the token leaks.
              </span>
            </li>
          </ul>

        </div>

        <div className="cache-actions">
          <button
            className="hard-refresh-btn"
            onClick={() => setConfirmKind('hard')}
            disabled={busy !== null || !onForceResync}
            title="Clear the local cache and re-fetch every repo from GitHub. Useful when collaborator repos go missing or you suspect stale data."
          >
            {busy === 'hard' ? 'Refreshing…' : '↻ Hard refresh from GitHub'}
          </button>
          <button onClick={() => setConfirmKind('clear')} disabled={busy !== null}>
            {busy === 'clear' ? 'Clearing…' : 'Clear all cache'}
          </button>
          <button onClick={handleClearOld} disabled={busy !== null}>Clear stale cache</button>
        </div>
        <p className="muted cache-actions-hint">
          <strong>Hard refresh</strong> clears storage <em>and</em> pulls fresh data from GitHub.{' '}
          <strong>Clear all cache</strong> only empties storage — repos come back on the next sync.
        </p>
      </section>}

      {(panel === 'all' || panel === 'cache') && breakdown && (
        <CachePanel breakdown={breakdown} onChange={loadData} />
      )}

      {(panel === 'all' || panel === 'pinned') && <section>
        <h2>Pinned Repos</h2>
        {pinned.length === 0 ? (
          <p className="muted">No pinned repos yet. Pin repos from the repo list.</p>
        ) : (
          <ul className="pinned-list">
            {pinned.map(p => (
              <li key={p.repoId}>
                <span>{p.nameWithOwner}</span>
                <button onClick={() => handleUnpin(p.repoId)}>Unpin</button>
              </li>
            ))}
          </ul>
        )}
      </section>}

      <ConfirmDialog
        open={confirmKind === 'clear'}
        title="Clear all cache?"
        body={
          <p>
            Empties the local repo cache. Repos will be re-fetched on the next sync,
            but the app won't reload now. Use this if you just need to free storage —
            for a true re-pull from GitHub use <strong>Hard refresh</strong>.
          </p>
        }
        confirmLabel="Clear cache"
        confirmKind="danger"
        onConfirm={doClearCache}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind === 'hard'}
        title="Hard refresh from GitHub?"
        body={
          <p>
            Clears the local cache <strong>and</strong> immediately re-fetches every
            repo. Use this when collaborator-only repos are missing or you suspect
            stale data.
          </p>
        }
        confirmLabel="Refresh now"
        onConfirm={doHardRefresh}
        onCancel={() => setConfirmKind(null)}
      />

      {(panel === 'all' || panel === 'orgOrder') && <section>
        <h2>Org Order</h2>
        {orgs.length === 0 ? (
          <p className="muted">No orgs synced yet.</p>
        ) : (
          <ul className="org-order-list">
            {orgs.map((o, i) => (
              <li key={o.login}>
                <span className="order-num">{i + 1}</span>
                <span>{o.login}</span>
              </li>
            ))}
          </ul>
        )}
      </section>}
    </div>
  )
}

/**
 * Cache tab — groups the prefs-table entries (per-API response caches)
 * by what they belong to and lets the user evict individual rows.
 */
type CacheGroup = {
  title: string
  ttl: string
  prefix: string
  /** Override the per-row label. Used to mask the token-as-discriminator
   *  for session-level caches so it never renders to the DOM. */
  rowLabel?: (sub: string) => string
  /** Visual emphasis: per-resource caches (PR detail, Branches) get a
   *  brighter card border so they stand out from session singletons. */
  emphasis?: 'primary' | 'session'
  /** Short helper line under the title to remind why we cache this. */
  blurb?: string
}

function CachePanel({ breakdown, onChange }: { breakdown: StorageBreakdown; onChange: () => void }) {
  const groups: CacheGroup[] = [
    // Per-resource caches: change as the user navigates; one entry per repo / PR.
    {
      title: 'PR detail',
      ttl: '15m',
      prefix: 'prDetail:',
      emphasis: 'primary',
      blurb: 'Each open of a PR detail modal — keyed by owner/repo/#PR.'
    },
    {
      title: 'Branches',
      ttl: '15m',
      prefix: 'branches:',
      emphasis: 'primary',
      blurb: 'Branch list for each repo opened from the Repos grid.'
    },
    {
      title: 'Since-last-visit snapshot',
      ttl: '∞',
      prefix: 'visit:',
      blurb: 'Baseline that powers the Home → Since last visit feed.'
    },
    // Session-level singletons: one entry per token. The token is the
    // discriminator — never show it.
    {
      title: '/user/orgs',
      ttl: '1h',
      prefix: 'userOrgs:',
      emphasis: 'session',
      rowLabel: () => 'current session',
      blurb: 'REST list of orgs the viewer belongs to.'
    },
    {
      title: 'Viewer (login + memberships)',
      ttl: '1h',
      prefix: 'viewer:',
      emphasis: 'session',
      rowLabel: () => 'current session',
      blurb: 'GraphQL viewer query — login, avatar, viewer.organizations.'
    },
    {
      title: 'Token info (scopes, SSO)',
      ttl: '1h',
      prefix: 'tokenInfo:',
      emphasis: 'session',
      rowLabel: () => 'current session',
      blurb: 'X-OAuth-Scopes + X-GitHub-SSO from /user response headers.'
    }
  ]

  async function deleteEntry(key: string) {
    await db.prefs.delete(key)
    onChange()
  }

  async function deleteGroup(prefix: string) {
    const matching = breakdown.prefKeys.filter((p) => p.key.startsWith(prefix)).map((p) => p.key)
    if (matching.length === 0) return
    await db.prefs.bulkDelete(matching)
    onChange()
  }

  return (
    <section>
      <h2>API response cache</h2>
      <p className="muted storage-blurb">
        Each row below is an API call this app made and saved to IndexedDB so
        the next request can be served locally. TTL is the freshness window —
        after that the cache entry is ignored and a fresh call goes out.
        Delete a row to force the next request to re-fetch.
      </p>

      {groups.map((g) => {
        const rows = breakdown.prefKeys.filter((p) => p.key.startsWith(g.prefix))
        const emphasisClass = g.emphasis ? `cache-group--${g.emphasis}` : ''
        return (
          <div key={g.prefix} className={`cache-group ${emphasisClass}`}>
            <div className="cache-group-head">
              <span className="cache-group-title">
                <strong>{g.title}</strong>
                <span className="cache-group-ttl">TTL {g.ttl}</span>
                <span className="muted">· {rows.length} cached</span>
              </span>
              {rows.length > 0 && (
                <button className="cache-group-clear" onClick={() => deleteGroup(g.prefix)}>
                  Clear group
                </button>
              )}
            </div>
            {g.blurb && <div className="cache-group-blurb muted">{g.blurb}</div>}
            {rows.length === 0 ? (
              <div className="cache-group-empty muted">No entries.</div>
            ) : (
              <ul className="cache-row-list">
                {rows.map((r) => {
                  const sub = r.key.slice(g.prefix.length)
                  const label = g.rowLabel ? g.rowLabel(sub) : sub
                  return (
                    <li key={r.key}>
                      <code className="cache-row-key">{label || '(default)'}</code>
                      <span className="muted cache-row-time">cached {timeAgo(r.updatedAt)}</span>
                      <button
                        className="cache-row-delete"
                        title="Evict this entry; the next request will re-fetch"
                        onClick={() => deleteEntry(r.key)}
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}
