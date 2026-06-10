/**
 * Passive GitHub rate-limit awareness. API responses already carry the quota
 * in x-ratelimit-* headers — gql()/rest() report them here for free (no extra
 * calls), and the explicit rateLimit query feeds the graphql pool too.
 *
 * Consumers: queries.ts gates focus/reconnect refetches on isRateLow(), and the
 * Dashboard topbar shows a warning. The gate only pauses passive background
 * refreshing — user-initiated actions always go through.
 */

export type RatePool = {
  remaining: number
  limit: number
  /** Epoch ms when the window resets; null if unknown. */
  resetAt: number | null
}

// GitHub meters GraphQL and REST separately. The 'search' pool (30/min) churns
// and self-heals in seconds — gating everything on it would cause false alarms,
// so only these two long-window pools participate.
const TRACKED = new Set(['graphql', 'core'])

const pools = new Map<string, RatePool>()

/** A pool is low under 5% of its window (min 100 requests). */
export function isLowFor(remaining: number, limit: number): boolean {
  return remaining < Math.max(100, Math.floor(limit * 0.05))
}

function poolIsLow(pool: RatePool, now: number): boolean {
  // Past the reset the quota is fresh again, whatever our stale numbers say.
  if (pool.resetAt !== null && now >= pool.resetAt) return false
  return isLowFor(pool.remaining, pool.limit)
}

/** Record quota straight from response headers (free — no extra API calls). */
export function noteRateHeaders(headers: Headers): void {
  const remaining = parseInt(headers.get('x-ratelimit-remaining') ?? '', 10)
  const limit = parseInt(headers.get('x-ratelimit-limit') ?? '', 10)
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return
  const resource = headers.get('x-ratelimit-resource') ?? 'core'
  if (!TRACKED.has(resource)) return
  const resetSec = parseInt(headers.get('x-ratelimit-reset') ?? '', 10)
  pools.set(resource, {
    remaining,
    limit,
    resetAt: Number.isFinite(resetSec) ? resetSec * 1000 : null,
  })
}

/** Record the GraphQL pool from the dedicated rateLimit query. */
export function noteGraphqlRateLimit(remaining: number, limit: number, resetAtIso: string): void {
  const resetAt = Date.parse(resetAtIso)
  pools.set('graphql', { remaining, limit, resetAt: Number.isFinite(resetAt) ? resetAt : null })
}

/** True when any tracked pool is nearly exhausted — pause passive refetching. */
export function isRateLow(now = Date.now()): boolean {
  for (const pool of pools.values()) {
    if (poolIsLow(pool, now)) return true
  }
  return false
}

/** Snapshot for UI (the lowest tracked pool), or null before any data. */
export function rateSnapshot(now = Date.now()): (RatePool & { low: boolean }) | null {
  let worst: RatePool | null = null
  for (const pool of pools.values()) {
    if (!worst || pool.remaining / pool.limit < worst.remaining / worst.limit) worst = pool
  }
  return worst ? { ...worst, low: poolIsLow(worst, now) } : null
}

/** Test hook — clears recorded pools. */
export function resetRateGate(): void {
  pools.clear()
}
