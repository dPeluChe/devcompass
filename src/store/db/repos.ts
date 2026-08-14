import { db, type CachedRepo } from './core'

type RepoCacheInput = Omit<CachedRepo, 'cachedAt'>

export async function cacheRepos(_orgLogin: string, repos: RepoCacheInput[]) {
  await db.repos.bulkPut(
    repos.map(r => ({
      ...r,
      cachedAt: Date.now()
    }))
  )
}

export async function getCachedRepos(orgLogin: string, maxAgeHours = 24 * 7): Promise<CachedRepo[]> {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  return db.repos
    .where('owner.login')
    .equals(orgLogin)
    .filter(r => r.cachedAt > cutoff)
    .toArray()
}

/**
 * Returns every cached repo regardless of owner. Needed because collaborator
 * repos come through the viewer's COLLABORATOR affiliation: they're stored
 * with `owner.login = <collab-org>`, but that login isn't in sourcesToSync,
 * so the per-org getCachedRepos read would miss them on a normal reload.
 */
export async function getAllCachedRepos(maxAgeHours = 24 * 7): Promise<CachedRepo[]> {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  return db.repos.filter(r => r.cachedAt > cutoff).toArray()
}

export async function clearOldRepos(maxAgeHours = 24) {
  const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000)
  await db.repos.where('cachedAt').below(cutoff).delete()
}

export async function getRepoCount(): Promise<number> {
  return db.repos.count()
}

export async function clearAllRepos() {
  await db.repos.clear()
}
