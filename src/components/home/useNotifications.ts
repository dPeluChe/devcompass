import { useQuery } from '@tanstack/react-query'
import { fetchNotifications } from '../../api/github'
import { queryKeys } from '../../store/queries'

/** Single-page fetch cap (no Link-header chain yet) — exported so the scope can flag truncation. */
export const NOTIFICATIONS_LIMIT = 50

/**
 * The viewer's unread GitHub notifications (cross-repo "involves you" inbox).
 * Short staleTime since notifications are timely; shared with the sidebar count.
 */
export function useNotifications(token: string) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotifications(token, { perPage: NOTIFICATIONS_LIMIT }),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  })
}
