import { useQuery } from '@tanstack/react-query'
import { fetchNotifications } from '../../api/github'
import { queryKeys } from '../../store/queries'

/**
 * The viewer's unread GitHub notifications (cross-repo "involves you" inbox).
 * Short staleTime since notifications are timely; shared with the sidebar count.
 */
export function useNotifications(token: string) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchNotifications(token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  })
}
