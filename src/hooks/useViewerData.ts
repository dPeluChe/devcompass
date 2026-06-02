import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

export function useViewerData(token: string) {
  const [progressMsg, setProgressMsg] = useState('')
  const [repos, setRepos] = useState<Repo[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([])
  const [loadedFromCache, setLoadedFromCache] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [refreshSeq, setRefreshSeq] = useState(0)
  const inFlight = useRef(false)
  
  // 1h IndexedDB TTL on the per-session metadata so reloads don't burn
  // viewer/tokenInfo/userOrgs calls when the cache is still fresh.
  const SCALAR_CACHE_TTL = 60 * 60 * 1000

  const viewerQuery = useQuery({
    queryKey: ['viewer', token],
    queryFn: async () => {
      const cached = await getCachedPref<Awaited<ReturnType<typeof fetchViewer>>>(`viewer:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetchViewer(token)
      await savePref(`viewer:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
  })

  const tokenInfoQuery = useQuery({
    queryKey: ['tokenInfo', token],
    queryFn: async () => {
      const cached = await getCachedPref<Awaited<ReturnType<typeof fetchTokenInfo>>>(`tokenInfo:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetchTokenInfo(token)
      await savePref(`tokenInfo:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
    enabled: !!token,
  })

  const userOrgsQuery = useQuery({
    queryKey: ['userOrgs', token],
    queryFn: async () => {
      const cached = await getCachedPref<Awaited<ReturnType<typeof fetchUserOrgsRest>>>(`userOrgs:${token}`, SCALAR_CACHE_TTL)
      if (cached) return cached
      const fresh = await fetchUserOrgsRest(token)
      await savePref(`userOrgs:${token}`, fresh)
      return fresh
    },
    staleTime: SCALAR_CACHE_TTL,
    enabled: !!token,
  })

  const rateLimitQuery = useQuery({
    queryKey: ['rateLimit', token],
    queryFn: () => fetchRateLimit(token),
    staleTime: 60 * 1000,
    enabled: !!token,
  })

  const isInitialLoading = viewerQuery.isLoading || tokenInfoQuery.isLoading || rateLimitQuery.isLoading

  const loadReposSequentially = useCallback(async (forceFresh = false) => {
    if (inFlight.current) return
    inFlight.current = true
    const v = viewerQuery.data!
    const restOrgs = userOrgsQuery.data ?? []
    const merged = new Map<string, Org>()
    for (const o of v.organizations.nodes) merged.set(o.login, o)
    for (const o of restOrgs) {
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
      if (lastSyncAt === null) setLastSyncAt(Date.now())
      inFlight.current = false
      return
    }
    
    for (let i = 0; i < orgsToFetch.length; i++) {
      const login = orgsToFetch[i]
      const current = i + 1
      const total = orgsToFetch.length
      const prefix = byId.size > 0 ? 'Refreshing' : 'Fetching'
      setProgressMsg(`${prefix} repos from @${login} (${current}/${total})`)
      
      try {
        const orgRepos = login === v.login ? await fetchViewerReposSimple(token) : await fetchOrgReposSimple(token, login)
        if (token !== DEMO_TOKEN) await cacheRepos(login, orgRepos)
        markOrgSynced(login)
        for (const r of orgRepos) byId.set(r.id, r)
        setRepos(sortRepos([...byId.values()]))
      } catch (e) {
        console.warn(`Failed to load repos from ${login}:`, e)
        errs.push({ source: login, message: e instanceof Error ? e.message : String(e) })
      }
    }

    setRepos(sortRepos([...byId.values()]))
    setErrors(errs)
    setProgressMsg('')
    setLastSyncAt(Date.now())
    inFlight.current = false
  }, [token, viewerQuery.data, userOrgsQuery.data, lastSyncAt])

  useEffect(() => {
    if (viewerQuery.data && userOrgsQuery.data && repos.length === 0) {
      loadReposSequentially()
    }
  }, [viewerQuery.data, userOrgsQuery.data, loadReposSequentially, repos.length])

  // Manual refresh button — bumps a sequence so the effect re-runs even when
  // repos.length > 0 (the initial-load guard above would otherwise skip).
  useEffect(() => {
    if (refreshSeq === 0) return
    if (!viewerQuery.data || !userOrgsQuery.data) return
    loadReposSequentially(true)
    rateLimitQuery.refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSeq])

  const refresh = useCallback(async () => {
    // Drop the IDB scalar caches so the next queryFn run goes to the network
    // instead of returning the stored-but-not-yet-TTL'd value. Then refetch
    // the three queries imperatively. Repo sync is handled below via the
    // refreshSeq effect.
    await db.prefs.bulkDelete([`viewer:${token}`, `tokenInfo:${token}`, `userOrgs:${token}`])
    await Promise.all([viewerQuery.refetch(), tokenInfoQuery.refetch(), userOrgsQuery.refetch()])
    setRefreshSeq((n) => n + 1)
  }, [token, viewerQuery, tokenInfoQuery, userOrgsQuery])

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

function sortRepos(repos: Repo[]): Repo[] {
  return repos.sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime())
}
