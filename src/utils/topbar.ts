import type { RateLimit } from '../api/github'

export function syncTitle(
  lastSyncAt: number | null,
  isSyncing: boolean,
  progressMsg: string | null,
  rateLimit: RateLimit | undefined,
  isLowFor: (remaining: number, limit: number) => boolean
): string {
  const parts: string[] = []
  if (isSyncing) parts.push(progressMsg || 'Syncing…')
  else if (lastSyncAt) parts.push(`Last sync ${new Date(lastSyncAt).toLocaleString()}`)
  else parts.push('Not synced yet')
  if (rateLimit) {
    const low = isLowFor(rateLimit.remaining, rateLimit.limit)
    parts.push(
      low
        ? `API quota low — ${rateLimit.remaining}/${rateLimit.limit}, resets ${new Date(rateLimit.resetAt).toLocaleTimeString()}`
        : `API quota ${rateLimit.remaining}/${rateLimit.limit}, resets ${new Date(rateLimit.resetAt).toLocaleTimeString()}`
    )
  }
  return parts.join(' · ')
}

export function timeAgoShort(ms: number): string {
  const diff = Date.now() - ms
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
