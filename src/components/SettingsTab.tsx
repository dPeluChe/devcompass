import { useEffect, useState } from 'react'
import { getDbStats, clearAllRepos, clearOldRepos, type PinnedRepo, getPinnedRepos, unpinRepo, getOrgsByOrder } from '../store/db'

interface DbStats {
  repoCount: number
  orgCount: number
  pinnedCount: number
  tokenCount: number
}

export function SettingsTab() {
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

  async function handleClearCache() {
    if (!confirm('Clear all cached repos? This will force fresh fetches next time.')) return
    await clearAllRepos()
    await loadData()
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
    return <div className="settings-tab"><p>Loading...</p></div>
  }

  return (
    <div className="settings-tab">
      <section>
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
          <button onClick={handleClearCache}>Clear All Cache</button>
          <button onClick={handleClearOld}>Clear Stale Cache</button>
        </div>
      </section>

      <section>
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
      </section>

      <section>
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
      </section>
    </div>
  )
}