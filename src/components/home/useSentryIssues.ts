import { useQuery } from '@tanstack/react-query'
import { fetchAllSentryIssues, type SentryIssue } from '../../api/sentry'
import { sentryConfigStore } from '../../store/sentryConfig'
import { getCachedPref, savePref } from '../../store/db'
import { queryKeys } from '../../store/queries'

// Errors are volatile, so a short IndexedDB TTL: instant render on reload, but
// re-pulled within ~10 min. Reuses the same prefs cache as viewer/PR detail.
const TTL = 10 * 60 * 1000

/** Pagination cap (cursor-chained up to this many) — exported so consumers can flag truncation. */
export const SENTRY_ISSUE_LIMIT = 300

/**
 * Unresolved Sentry issues across the configured org (capped), cached to
 * IndexedDB. Shared by the Home Sentry scope and the sidebar count — react-query
 * dedupes the two by key, so there's a single fetch.
 */
export function useSentryIssues() {
  const cfg = sentryConfigStore()
  const org = cfg.orgSlug.trim()
  const env = cfg.environment.trim()

  return useQuery<SentryIssue[]>({
    queryKey: queryKeys.sentryIssues(org, env || 'all'),
    enabled: cfg.isConfigured(),
    staleTime: TTL,
    queryFn: async () => {
      const key = `sentryIssues:${org}:${env || 'all'}`
      const cached = await getCachedPref<SentryIssue[]>(key, TTL)
      if (cached) return cached
      const data = await fetchAllSentryIssues(sentryConfigStore.getState().getAuth(), {
        orgSlug: org,
        environment: env,
        query: 'is:unresolved',
      }, SENTRY_ISSUE_LIMIT)
      await savePref(key, data)
      return data
    },
  })
}
