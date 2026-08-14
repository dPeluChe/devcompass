import { db, type PinnedRepo } from './core'

export async function pinRepo(repoId: string, nameWithOwner: string) {
  await db.pinnedRepos.put({
    repoId,
    nameWithOwner,
    pinnedAt: Date.now()
  })
}

export async function unpinRepo(repoId: string) {
  await db.pinnedRepos.delete(repoId)
}

export async function getPinnedRepos(): Promise<PinnedRepo[]> {
  return db.pinnedRepos.orderBy('pinnedAt').reverse().toArray()
}

export async function isPinned(repoId: string): Promise<boolean> {
  return (await db.pinnedRepos.get(repoId)) !== undefined
}
