import { useQuery } from '@tanstack/react-query'
import { fetchNotifications, type GitHubNotification } from '../../api/github'
import { queryKeys } from '../../store/queries'
import { getCachedPref, savePref, CACHE_TTLS } from '../../store/db'

/** Pagination cap (page-chained up to this many) — exported so the scope can flag truncation. */
export const NOTIFICATIONS_LIMIT = 200

/** IDB pref key — exported so mark-as-read can update the cached unread set too. */
export function notificationsPrefKey(token: string): string {
  return `notifications:${token}`
}

/** Persist the post-mutation unread set so an IDB-cached reload doesn't resurrect read rows. */
export function persistNotificationsCache(token: string, list: GitHubNotification[]): void {
  savePref(notificationsPrefKey(token), list).catch(() => {})
}

/**
 * The viewer's unread GitHub notifications (cross-repo "involves you" inbox).
 * IDB-backed for instant reload paint; short TTL since notifications are timely.
 */
export function useNotifications(token: string) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const cached = await getCachedPref<GitHubNotification[]>(notificationsPrefKey(token), CACHE_TTLS['notifications:'])
      if (cached) return cached
      const fresh = await fetchNotifications(token, { max: NOTIFICATIONS_LIMIT })
      await savePref(notificationsPrefKey(token), fresh)
      return fresh
    },
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  })
}
