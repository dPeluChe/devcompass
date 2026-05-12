import { useEffect, useState } from 'react'
import { getDbStats, clearAllRepos, clearOldRepos, type PinnedRepo, getPinnedRepos, unpinRepo, getOrgsByOrder, getStorageBreakdown, type StorageBreakdown } from '../store/db'
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

/** Human label + short description for each `prefs:` key family. */
function describePrefKey(key: string): { label: string; kind: string } {
  if (key.startsWith('viewer:')) return { label: 'Viewer (login, orgs)', kind: 'API cache · 1h' }
  if (key.startsWith('tokenInfo:')) return { label: 'Token info (scopes, SSO)', kind: 'API cache · 1h' }
  if (key.startsWith('userOrgs:')) return { label: '/user/orgs', kind: 'API cache · 1h' }
  if (key.startsWith('prDetail:')) return { label: `PR detail · ${key.slice('prDetail:'.length)}`, kind: 'API cache · 15m' }
  if (key.startsWith('branches:')) return { label: `Branches · ${key.slice('branches:'.length)}`, kind: 'API cache · 15m' }
  if (key.startsWith('visit:')) return { label: 'Since-last-visit snapshot', kind: 'baseline' }
  return { label: key, kind: 'pref' }
}

type SettingsPanel = 'all' | 'storage' | 'pinned' | 'orgOrder'

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
            <span className="stat-value">{breakdown?.orgs ?? stats?.orgCount ?? 0}</span>
            <span className="stat-label">Orgs</span>
            <span className="stat-sub muted">enabled/sync flags</span>
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
            <span className="stat-label">Pref rows</span>
            <span className="stat-sub muted">api caches + ui prefs</span>
          </div>
          <div className="stat">
            <span className="stat-value">{breakdown?.tokensMeta ?? stats?.tokenCount ?? 0}</span>
            <span className="stat-label">Token meta</span>
            <span className="stat-sub muted">scopes, expiry</span>
          </div>
          <div className="stat" style={{ gridColumn: 'span 2' }}>
            <span className="stat-value">{formatBytes(breakdown?.usageBytes ?? null)}</span>
            <span className="stat-label">On disk</span>
            <span className="stat-sub muted">
              {breakdown?.quotaBytes
                ? `of ~${formatBytes(breakdown.quotaBytes)} quota`
                : 'browser doesn\'t expose total'}
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

          {breakdown && breakdown.prefKeys.length > 0 && (
            <>
              <h3>Cached API responses ({breakdown.prefKeys.length})</h3>
              <ul className="storage-pref-list">
                {breakdown.prefKeys.slice(0, 20).map((p) => {
                  const desc = describePrefKey(p.key)
                  return (
                    <li key={p.key}>
                      <span className="storage-pref-label">{desc.label}</span>
                      <span className="muted">{desc.kind}</span>
                      <span className="muted">cached {timeAgo(p.updatedAt)}</span>
                    </li>
                  )
                })}
                {breakdown.prefKeys.length > 20 && (
                  <li className="muted">+ {breakdown.prefKeys.length - 20} more entries</li>
                )}
              </ul>
            </>
          )}
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
