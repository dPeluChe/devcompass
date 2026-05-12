import { useEffect, useState } from 'react'
import { getDbStats, clearAllRepos, clearOldRepos, type PinnedRepo, getPinnedRepos, unpinRepo, getOrgsByOrder } from '../store/db'

interface DbStats {
  repoCount: number
  orgCount: number
  pinnedCount: number
  tokenCount: number
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
  const [pinned, setPinned] = useState<PinnedRepo[]>([])
  const [orgs, setOrgs] = useState<{ login: string; order: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [s, p, o] = await Promise.all([
      getDbStats(),
      getPinnedRepos(),
      getOrgsByOrder()
    ])
    setStats(s)
    setPinned(p)
    setOrgs(o)
    setLoading(false)
  }

  const [busy, setBusy] = useState<'clear' | 'hard' | null>(null)

  async function handleClearCache() {
    if (!confirm('Clear all cached repos? They will be re-fetched on the next sync, but the app won\'t reload now.')) return
    setBusy('clear')
    try {
      await clearAllRepos()
      await loadData()
    } finally { setBusy(null) }
  }

  async function handleHardRefresh() {
    if (!confirm('Hard refresh: clear all cached repos AND re-fetch from GitHub now.\n\nUse this if you suspect the cache is out of sync (e.g. collaborator-only repos are missing).')) return
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
        <h2>Cache Storage</h2>
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-value">{stats?.repoCount ?? 0}</span>
            <span className="stat-label">Cached Repos</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.orgCount ?? 0}</span>
            <span className="stat-label">Orgs</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.pinnedCount ?? 0}</span>
            <span className="stat-label">Pinned</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats?.tokenCount ?? 0}</span>
            <span className="stat-label">Tokens</span>
          </div>
        </div>
        <div className="cache-actions">
          <button
            className="hard-refresh-btn"
            onClick={handleHardRefresh}
            disabled={busy !== null || !onForceResync}
            title="Clear the local cache and re-fetch every repo from GitHub. Useful when collaborator repos go missing or you suspect stale data."
          >
            {busy === 'hard' ? 'Refreshing…' : '↻ Hard refresh from GitHub'}
          </button>
          <button onClick={handleClearCache} disabled={busy !== null}>
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
