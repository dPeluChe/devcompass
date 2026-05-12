import type { Review } from '../../../api/github'

export function relativeTime(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(day / 365)}y ago`
}

export function reviewStateClass(s: Review['state']): string {
  if (s === 'APPROVED') return 'approved'
  if (s === 'CHANGES_REQUESTED') return 'changes'
  return ''
}

export function reviewStateLabel(s: Review['state']): string {
  if (s === 'APPROVED') return 'approved'
  if (s === 'CHANGES_REQUESTED') return 'requested changes'
  if (s === 'COMMENTED') return 'commented'
  if (s === 'DISMISSED') return 'dismissed'
  return s.toLowerCase()
}
