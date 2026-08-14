import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { noteGraphqlRateLimit } from '../store/rateGate'
import { fetchRateLimit, fetchTokenInfo, fetchUserOrgsRest, fetchViewer, type Org, type Repo } from '../api/github'
import { DEMO_TOKEN } from '../api/demo/token'
import { db, getAllCachedRepos, getCachedPref, savePref } from '../store/db'
import { sortRepos, syncRepos, type RestOrgs, type SyncContext, type Viewer } from './loadRepos'

// 1h IndexedDB TTL on the per-session metadata so reloads don't burn
// viewer/tokenInfo/userOrgs calls when the cache is still fresh.
const SCALAR_CACHE_TTL = 60 * 60 * 1000

// Reads a TTL-bound scalar from IndexedDB first, falling back to the network and
// back-filling the cache. Shared by the three viewer-scoped queries below.
function useCachedQuery<T>(key: string, token: string, fetcher: () => Promise<T>, enabled = true) {
  return useQuery({
    queryKey: [key, token],
    queryFn: async () => {
      const cached = await getCachedPref<T>(`${key}:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetcher()
      await savePref(`${key}:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
    enabled,
  })
}

export function useViewerData(token: string) {
  const [progressMsg, setProgressMsg] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([])
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const inFlight = useRef(false)
  const syncTriggered = useRef(false)

  const viewerQuery = useCachedQuery('viewer', token, () => fetchViewer(token))
  const tokenInfoQuery = useCachedQuery('tokenInfo', token, () => fetchTokenInfo(token), !!token)
  const userOrgsQuery = useCachedQuery('userOrgs', token, () => fetchUserOrgsRest(token), !!token)

  const rateLimitQuery = useQuery({
    queryKey: ['rateLimit', token],
    queryFn: () => fetchRateLimit(token),
    // 5min, not 60s: the rate gate already updates from the x-ratelimit-* headers
    // on every gql/rest call (noteRateHeaders), so this dedicated query only feeds
    // the topbar number — no need to re-POST it on every quick revisit.
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  })

  // Feed the rate gate so passive refetching can pause when quota runs low.
  useEffect(() => {
    const rl = rateLimitQuery.data
    if (rl) noteGraphqlRateLimit(rl.remaining, rl.limit, rl.resetAt)
  }, [rateLimitQuery.data])

  const isInitialLoading = viewerQuery.isLoading || tokenInfoQuery.isLoading || rateLimitQuery.isLoading

  // Takes the resolved viewer/org data as params (rather than reading it from a
  // closure) so the manual refresh path can pass freshly-refetched data straight
  // in without a re-render dance. The inFlight ref keeps two syncs from racing.
  // Delegates the bounded-concurrency pool + org merge to the pure syncRepos
  // helper in loadRepos.ts; this wrapper just bridges the callbacks to state.
  const loadRepos = useCallback(async (v: Viewer, restOrgs: RestOrgs, forceFresh = false) => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const ctx: SyncContext = {
        token,
        viewer: v,
        restOrgs,
        forceFresh,
        onProgress: setProgressMsg,
        onRepos: setRepos,
        onOrgs: setOrgs,
        onErrors: setErrors,
        onSynced: () => setLastSyncAt(Date.now())
      }
      await syncRepos(ctx)
    } finally {
      inFlight.current = false
    }
  }, [token])

  // Local-first paint: show cached repos from IndexedDB the moment the hook
  // mounts — independent of the viewer/org queries, which may hit the network
  // when their 1h TTL lapsed or the token changed (prefs are token-keyed; repos
  // are not). Without this the list waited behind those fetches on every visit.
  useEffect(() => {
    syncTriggered.current = false
    if (token === DEMO_TOKEN) return
    let alive = true
    getAllCachedRepos()
      .then((cached) => {
        if (alive && cached.length > 0) {
          setRepos((prev) => (prev.length === 0 ? sortRepos(cached) : prev))
          setLoadedFromCache(true)
        }
      })
      .catch(() => { /* IDB unavailable — fall through to the network sync */ })
    return () => { alive = false }
  }, [token])

  // Background sync runs once viewer+orgs resolve. Gated on a ref (not
  // repos.length) so the instant cache paint above doesn't suppress it.
  useEffect(() => {
    if (viewerQuery.data && userOrgsQuery.data && !syncTriggered.current) {
      syncTriggered.current = true
      loadRepos(viewerQuery.data, userOrgsQuery.data)
    }
  }, [viewerQuery.data, userOrgsQuery.data, loadRepos])

  const refresh = useCallback(async () => {
    // Drop the IDB scalar caches so the refetch hits the network instead of
    // returning the stored-but-not-yet-TTL'd value, then re-sync repos with the
    // freshly resolved viewer/org data passed straight into loadRepos.
    await db.prefs.bulkDelete([`viewer:${token}`, `tokenInfo:${token}`, `userOrgs:${token}`])
    const [v, , uo] = await Promise.all([
      viewerQuery.refetch(),
      tokenInfoQuery.refetch(),
      userOrgsQuery.refetch(),
      rateLimitQuery.refetch(),
    ])
    if (v.data && uo.data) await loadRepos(v.data, uo.data, true)
  }, [token, viewerQuery, tokenInfoQuery, userOrgsQuery, rateLimitQuery, loadRepos])

  return {
    viewer: viewerQuery.data,
    orgs,
    tokenInfo: tokenInfoQuery.data,
    repos,
    errors,
    rateLimit: rateLimitQuery.data,
    progressMsg,
    isLoading: repos.length === 0 && (isInitialLoading || !!progressMsg),
    isFetching: viewerQuery.isFetching || tokenInfoQuery.isFetching || rateLimitQuery.isFetching || !!progressMsg,
    loadedFromCache,
    lastSyncAt,
    refresh,
    error: viewerQuery.error || null
  }
}
