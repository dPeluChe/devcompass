/**
 * Returns a compact relative-time string for a given ISO timestamp.
 *
 * `suffix = true`  → "3h ago", "2d ago"  (DetailModal, SummaryTab)
 * `suffix = false` → "3h", "2d"           (AttentionRow, CompactRow)
 */
export function relativeTime(iso: string, suffix = true): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60)  return suffix ? `${min}m ago`  : `${min}m`
  const hr  = Math.floor(min / 60)
  if (hr  < 24)  return suffix ? `${hr}h ago`   : `${hr}h`
  const day = Math.floor(hr  / 24)
  if (day < 30)  return suffix ? `${day}d ago`   : `${day}d`
  const mo  = Math.floor(day / 30)
  if (mo  < 12)  return suffix ? `${mo}mo ago`   : `${mo}mo`
  return suffix ? `${Math.floor(day / 365)}y ago` : `${Math.floor(day / 365)}y`
}
