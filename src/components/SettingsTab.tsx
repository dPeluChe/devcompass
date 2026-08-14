import { useEffect, useState } from 'react'
import { clearAllRepos, clearOldRepos, type PinnedRepo, getPinnedRepos, unpinRepo, getStorageBreakdown, pruneExpiredCachePrefs, type StorageBreakdown } from '../store/db'
import { ConfirmDialog } from './ConfirmDialog'
import { CachePanel } from './settings/CachePanel'
import { StoragePanel } from './settings/StoragePanel'
import { PinnedPanel } from './settings/PinnedPanel'
import { AppearanceSection } from './settings/AppearanceSection'

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
      {panel === 'storage' && (
        <StoragePanel
          breakdown={breakdown}
          busy={busy}
          onClearCache={() => setConfirmKind('clear')}
          onHardRefresh={() => setConfirmKind('hard')}
          onClearStale={handleClearOld}
          canHardRefresh={!!onForceResync}
        />
      )}

      {panel === 'cache' && breakdown && (
        <CachePanel breakdown={breakdown} onChange={loadData} />
      )}

      {panel === 'pinned' && (
        <PinnedPanel pinned={pinned} onUnpin={handleUnpin} />
      )}

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
