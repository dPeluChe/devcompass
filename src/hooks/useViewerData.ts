import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { noteGraphqlRateLimit } from '../store/rateGate'
import {
  fetchOrgReposSimple,
  fetchRateLimit,
  fetchTokenInfo,
  fetchUserOrgsRest,
  fetchViewer,
  fetchViewerReposSimple,
  type Org,
  type Repo
} from '../api/github'
import { DEMO_TOKEN } from '../api/demo-data'
import { orgConfigStore } from '../store/orgConfig'
import { cacheRepos, db, getAllCachedRepos, getCachedPref, savePref } from '../store/db'

// 1h IndexedDB TTL on the per-session metadata so reloads don't burn
// viewer/tokenInfo/userOrgs calls when the cache is still fresh.
const SCALAR_CACHE_TTL = 60 * 60 * 1000
// How many org repo-fetches run at once. Bounded so we get parallel speedup
// without bursting past GitHub's rate limit on accounts with many orgs.
const SYNC_CONCURRENCY = 3

type Viewer = Awaited<ReturnType<typeof fetchViewer>>
type RestOrgs = Awaited<ReturnType<typeof fetchUserOrgsRest>>

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
  const loadRepos = useCallback(async (v: Viewer, restOrgs: RestOrgs, forceFresh = false) => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const merged = new Map<string, Org>()
      for (const o of v.organizations.nodes) merged.set(o.login, o)
      for (const o of restOrgs ?? []) {
        if (!merged.has(o.login)) {
          merged.set(o.login, { login: o.login, avatarUrl: o.avatar_url, url: o.url })
        }
      }
      const allOrgsList = [{ login: v.login, avatarUrl: v.avatarUrl, url: v.url }, ...merged.values()]
      setOrgs(allOrgsList)

      const { setAllOrgs, getEnabledOrgs, getSyncingOrgs, orgNeedsSync, markOrgSynced } = orgConfigStore.getState()
      setAllOrgs(allOrgsList.map(o => ({
        login: o.login,
        avatarUrl: o.avatarUrl,
        enabled: true,
        syncEnabled: true,
        lastSyncedAt: null
      })))

      const enabledOrgs = getEnabledOrgs()
      const syncingOrgs = getSyncingOrgs()

      setProgressMsg(`Checking local cache for ${enabledOrgs.length} orgs...`)

      const byId = new Map<string, Repo>()
      const errs: { source: string; message: string }[] = []
      const cachedByOrg = new Map<string, Repo[]>()
      const sourcesToSync = [v.login, ...syncingOrgs.filter((login) => login !== v.login)]

      // Read ALL cached repos (not just for sourcesToSync logins) so collaborator
      // repos that came in via the viewer's COLLABORATOR affiliation — owned by
      // orgs we never iterate explicitly — survive reloads. The per-org buckets
      // still drive the "needs sync" check below.
      // Demo mode bypasses the cache entirely — its data is static and the DB may
      // hold the real user's repos from a previous session.
      const allCached = token === DEMO_TOKEN ? [] : await getAllCachedRepos()
      for (const r of allCached) byId.set(r.id, r)
      for (const login of sourcesToSync) cachedByOrg.set(login, [])
      for (const r of allCached) {
        const bucket = cachedByOrg.get(r.owner.login)
        if (bucket) bucket.push(r)
      }

      if (byId.size > 0) {
        setRepos(sortRepos([...byId.values()]))
        setLoadedFromCache(true)
      }

      const orgsToFetch = forceFresh
        ? sourcesToSync.slice()
        : sourcesToSync.filter((login) => {
            const cached = cachedByOrg.get(login) ?? []
            return cached.length === 0 || orgNeedsSync(login)
          })

      if (orgsToFetch.length === 0) {
        setProgressMsg('')
        setErrors([])
        // Treat a no-op refresh as "we've confirmed cache is fresh".
        setLastSyncAt((prev) => prev ?? Date.now())
        return
      }

      const prefix = byId.size > 0 ? 'Refreshing' : 'Fetching'
      const total = orgsToFetch.length
      let completed = 0

      // Bounded-concurrency pool: SYNC_CONCURRENCY workers pull logins off a
      // shared queue so at most that many org fetches are in flight at once.
      // Repos accumulate into the shared byId map; we re-render after each
      // completion so progress and the list keep streaming in.
      const queue = [...orgsToFetch]
      const runOne = async (login: string) => {
        try {
          const orgRepos = login === v.login ? await fetchViewerReposSimple(token) : await fetchOrgReposSimple(token, login)
          if (token !== DEMO_TOKEN) await cacheRepos(login, orgRepos)
          markOrgSynced(login)
          for (const r of orgRepos) byId.set(r.id, r)
        } catch (e) {
          console.warn(`Failed to load repos from ${login}:`, e)
          errs.push({ source: login, message: e instanceof Error ? e.message : String(e) })
        } finally {
          completed++
          setProgressMsg(`${prefix} repos (${completed}/${total})`)
          setRepos(sortRepos([...byId.values()]))
        }
      }
      const workers = Array.from({ length: Math.min(SYNC_CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          const login = queue.shift()
          if (login) await runOne(login)
        }
      })
      await Promise.all(workers)

      setRepos(sortRepos([...byId.values()]))
      setErrors(errs)
      setProgressMsg('')
      setLastSyncAt(Date.now())
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

// Decorate-sort-undecorate so each pushedAt is parsed once instead of on every
// comparison (O(n) parses rather than O(n log n)).
function sortRepos(repos: Repo[]): Repo[] {
  return repos
    .map((r) => ({ repo: r, t: new Date(r.pushedAt).getTime() }))
    .sort((a, b) => b.t - a.t)
    .map((x) => x.repo)
}
