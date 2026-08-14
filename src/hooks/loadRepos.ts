import {
  fetchOrgReposSimple,
  fetchUserOrgsRest,
  fetchViewerReposSimple,
  type Org,
  type Repo,
  type Viewer
} from '../api/github'
import { DEMO_TOKEN } from '../api/demo-data'
import { orgConfigStore } from '../store/orgConfig'
import { cacheRepos, getAllCachedRepos } from '../store/db'

// `Viewer` is already a named export of the github barrel; re-export it here so
// useViewerData can import both the type and the sync helpers from one place.
export type { Viewer }
export type RestOrgs = Awaited<ReturnType<typeof fetchUserOrgsRest>>

// How many org repo-fetches run at once. Bounded so we get parallel speedup
// without bursting past GitHub's rate limit on accounts with many orgs.
const SYNC_CONCURRENCY = 3

export type SyncContext = {
  token: string
  viewer: Viewer
  restOrgs: RestOrgs
  forceFresh: boolean
  onProgress: (msg: string) => void
  onRepos: (repos: Repo[]) => void
  onOrgs: (orgs: Org[]) => void
  onErrors: (errors: { source: string; message: string }[]) => void
  onSynced: () => void
}

// Merge viewer orgs + REST orgs without duplicates, viewer first. REST sometimes
// returns orgs GraphQL misses (token type / SSO visibility), so we union them.
export function mergeOrgs(viewer: Viewer, restOrgs: RestOrgs): Org[] {
  const merged = new Map<string, Org>()
  for (const o of viewer.organizations.nodes) merged.set(o.login, o)
  for (const o of restOrgs ?? []) {
    if (!merged.has(o.login)) {
      merged.set(o.login, { login: o.login, avatarUrl: o.avatar_url, url: o.url })
    }
  }
  return [{ login: viewer.login, avatarUrl: viewer.avatarUrl, url: viewer.url }, ...merged.values()]
}

// Decorate-sort-undecorate so each pushedAt is parsed once instead of on every
// comparison (O(n) parses rather than O(n log n)).
export function sortRepos(repos: Repo[]): Repo[] {
  return repos
    .map((r) => ({ repo: r, t: new Date(r.pushedAt).getTime() }))
    .sort((a, b) => b.t - a.t)
    .map((x) => x.repo)
}

// Runs the bounded-concurrency repo sync. Pure-ish: it calls fetch functions and
// the supplied callbacks but never touches React state directly, so it's
// testable in isolation. Returns void — callers observe results via callbacks.
export async function syncRepos(ctx: SyncContext): Promise<void> {
  const { token, viewer, restOrgs, forceFresh, onProgress, onRepos, onOrgs, onErrors, onSynced } = ctx

  const allOrgsList = mergeOrgs(viewer, restOrgs)
  onOrgs(allOrgsList)

  const { setAllOrgs, getEnabledOrgs, getSyncingOrgs, orgNeedsSync, markOrgSynced } = orgConfigStore.getState()
  setAllOrgs(
    allOrgsList.map((o) => ({
      login: o.login,
      avatarUrl: o.avatarUrl,
      enabled: true,
      syncEnabled: true,
      lastSyncedAt: null
    }))
  )

  const enabledOrgs = getEnabledOrgs()
  const syncingOrgs = getSyncingOrgs()

  onProgress(`Checking local cache for ${enabledOrgs.length} orgs...`)

  const byId = new Map<string, Repo>()
  const errs: { source: string; message: string }[] = []
  const cachedByOrg = new Map<string, Repo[]>()
  const sourcesToSync = [viewer.login, ...syncingOrgs.filter((login) => login !== viewer.login)]

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
    onRepos(sortRepos([...byId.values()]))
  }

  const orgsToFetch = forceFresh
    ? sourcesToSync.slice()
    : sourcesToSync.filter((login) => {
        const cached = cachedByOrg.get(login) ?? []
        return cached.length === 0 || orgNeedsSync(login)
      })

  if (orgsToFetch.length === 0) {
    onProgress('')
    onErrors([])
    // Treat a no-op refresh as "we've confirmed cache is fresh".
    onSynced()
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
      const orgRepos =
        login === viewer.login ? await fetchViewerReposSimple(token) : await fetchOrgReposSimple(token, login)
      if (token !== DEMO_TOKEN) await cacheRepos(login, orgRepos)
      markOrgSynced(login)
      for (const r of orgRepos) byId.set(r.id, r)
    } catch (e) {
      console.warn(`Failed to load repos from ${login}:`, e)
      errs.push({ source: login, message: e instanceof Error ? e.message : String(e) })
    } finally {
      completed++
      onProgress(`${prefix} repos (${completed}/${total})`)
      onRepos(sortRepos([...byId.values()]))
    }
  }
  const workers = Array.from({ length: Math.min(SYNC_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const login = queue.shift()
      if (login) await runOne(login)
    }
  })
  await Promise.all(workers)

  onRepos(sortRepos([...byId.values()]))
  onErrors(errs)
  onProgress('')
  onSynced()
}
