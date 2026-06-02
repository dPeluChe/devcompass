import type { Review } from '../../../api/github'
export { relativeTime } from '../../../utils/time'

export function stripHtmlExcerpt(html: string, maxLen = 280): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
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
