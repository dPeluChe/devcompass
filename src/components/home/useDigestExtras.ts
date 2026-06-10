import { useQuery } from '@tanstack/react-query'
import { searchMergedPRs, fetchReposCommitActivity, type MergedPR, type Repo } from '../../api/github'
import { getCachedPref, savePref, CACHE_TTLS } from '../../store/db'

/**
 * Digest v2 data: both are single GraphQL calls per window, IDB-cached (30m) so
 * flipping windows or reloading doesn't re-burn quota.
 */

export type MergedStats = {
  count: number
  /** Mean open→merge in ms, null when nothing merged. */
  avgTimeToMergeMs: number | null
}

function windowStartIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export function useMergedStats(token: string, login: string | undefined, windowDays: number) {
  return useQuery<MergedStats>({
    queryKey: ['digest', 'merged', login ?? '', windowDays],
    enabled: !!token && !!login,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const key = `digestMerged:${login}:${windowDays}`
      const cached = await getCachedPref<MergedStats>(key, CACHE_TTLS['digestMerged:'])
      if (cached) return cached
      const since = windowStartIso(windowDays)
      const merged: MergedPR[] = (await searchMergedPRs(token, login!, since))
        .filter((pr) => new Date(pr.mergedAt).getTime() >= Date.now() - windowDays * 86_400_000)
      const durations = merged.map((pr) => new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime())
      const stats: MergedStats = {
        count: merged.length,
        avgTimeToMergeMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      }
      await savePref(key, stats)
      return stats
    },
  })
}

const SPARK_BUCKETS = 12

/** Bucket commit timestamps into a fixed-size sparkline series (oldest → newest). */
export function bucketize(times: number[], windowDays: number, now = Date.now()): number[] {
  const start = now - windowDays * 86_400_000
  const span = now - start
  const buckets = new Array<number>(SPARK_BUCKETS).fill(0)
  for (const t of times) {
    if (t < start || t > now) continue
    const idx = Math.min(SPARK_BUCKETS - 1, Math.floor(((t - start) / span) * SPARK_BUCKETS))
    buckets[idx] += 1
  }
  return buckets
}

export function useRepoActivity(token: string, mostActive: Repo[], windowDays: number) {
  const targets = mostActive.map((r) => ({ owner: r.owner.login, name: r.name }))
  const targetKey = targets.map((t) => `${t.owner}/${t.name}`).join(',')

  return useQuery<Record<string, number[]>>({
    queryKey: ['digest', 'activity', windowDays, targetKey],
    enabled: !!token && targets.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const key = `digestActivity:${windowDays}:${targetKey}`
      const cached = await getCachedPref<Record<string, number[]>>(key, CACHE_TTLS['digestActivity:'])
      if (cached) return cached
      const acts = await fetchReposCommitActivity(token, targets, windowStartIso(windowDays))
      const out: Record<string, number[]> = {}
      for (const a of acts) out[a.nameWithOwner] = bucketize(a.commitTimes, windowDays)
      await savePref(key, out)
      return out
    },
  })
}

/** "16h" / "1.8d" — compact duration for avg time-to-merge. */
export function formatDuration(ms: number): string {
  const hours = ms / 3600_000
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`
  if (hours < 48) return `${Math.round(hours)}h`
  return `${(hours / 24).toFixed(1)}d`
}
