import { useEffect, useState } from 'react'
import { clearAllRepos, clearOldRepos, type PinnedRepo, getPinnedRepos, unpinRepo, getStorageBreakdown, pruneExpiredCachePrefs, type StorageBreakdown } from '../store/db'
import { ConfirmDialog } from './ConfirmDialog'
import { uiPrefsStore } from '../store/uiPrefs'
import { CachePanel } from './settings/CachePanel'

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

type SettingsPanel = 'storage' | 'cache' | 'pinned' | 'appearance'

type Props = {
  panel: SettingsPanel
  /** Wires Dashboard's loadReposSequentially(true) so the "Hard refresh" button
   *  can drop the cache and pull a fresh copy without a full page reload. */
  onForceResync?: () => void
}

export function SettingsTab({ panel, onForceResync }: Props) {
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null)
  const [pinned, setPinned] = useState<PinnedRepo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Drop expired TTL-bound rows first so the Cache tab only ever shows
    // entries that would actually be served from cache on the next request.
    await pruneExpiredCachePrefs()
    const [b, p] = await Promise.all([getStorageBreakdown(), getPinnedRepos()])
    setBreakdown(b)
    setPinned(p)
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
      {panel === 'storage' && <section>
        <h2>Storage</h2>
        <p className="muted storage-blurb">
          Everything below lives <strong>only in your browser</strong>. The app
          never sends your data to anywhere except <code>api.github.com</code>,
          and IndexedDB + localStorage are scoped to this origin — other sites
          can't read it.
        </p>

        <div className="stats-grid storage-stats">
          <div className="stat">
            <span className="stat-value">{breakdown?.repos ?? 0}</span>
            <span className="stat-label">Repos</span>
            <span className="stat-sub muted">cached repos table</span>
          </div>
          <div className="stat">
            <span className="stat-value">{breakdown?.pinned ?? 0}</span>
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
              <code>localStorage["devcompass.pat"]</code>
              <span className="muted">
                Your GitHub Personal Access Token — used as the <code>Authorization: Bearer …</code>
                header on every request to <code>api.github.com</code>. Never sent anywhere else.
                Wiped by Logout, Clear all cache won't touch it.
              </span>
            </li>
            <li>
              <code>localStorage["devcompass-ui-prefs"]</code> · <code>"devcompass-org-config"</code>
              <span className="muted">
                UI prefs: sidebar collapsed flag, default merge method, the per-org
                enabled/sync toggles. Tiny.
              </span>
            </li>
            <li>
              <code>IndexedDB "devcompass"</code>
              <span className="muted">
                Repos, orgs, pinned items, snoozes, and the per-API
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

      {panel === 'cache' && breakdown && (
        <CachePanel breakdown={breakdown} onChange={loadData} />
      )}

      {panel === 'pinned' && <section>
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

      {panel === 'appearance' && <AppearanceSection />}
    </div>
  )
}

function AppearanceSection() {
  const { fancyBg, toggleFancyBg } = uiPrefsStore()
  return (
    <section>
      <h2>Appearance</h2>
      <label className="toggle-row">
        <span className="toggle-label">
          Atmospheric background
          <span className="muted toggle-hint">Subtle gradient behind the app</span>
        </span>
        <button
          role="switch"
          aria-checked={fancyBg}
          className={`toggle-switch ${fancyBg ? 'on' : ''}`}
          onClick={toggleFancyBg}
        />
      </label>
    </section>
  )
}
