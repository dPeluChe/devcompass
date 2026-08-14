import { useQuery } from '@tanstack/react-query'
import { DEMO_TOKEN } from '../api/demo/token'
import type { SentryIssue } from '../api/sentry'
import type { VercelProject } from '../api/vercel'

/** The fixture slices components render directly (everything else stays API-side). */
export type DemoFixtures = {
  sentryIssues: SentryIssue[]
  sentryRepoMap: Record<string, string>
  vercelProjects: VercelProject[]
}

/**
 * Demo fixtures for component render paths, loaded via dynamic import so the
 * ~700 LOC of demo data stay out of the production bundle entirely. Disabled
 * (and never fetched) unless the demo token is in play.
 */
export function useDemoData(token: string) {
  return useQuery<DemoFixtures>({
    queryKey: ['demo', 'fixtures'],
    enabled: token === DEMO_TOKEN,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const [sentry, vercel] = await Promise.all([
        import('../api/demo/sentry'),
        import('../api/demo/vercel'),
      ])
      return {
        sentryIssues: sentry.DEMO_SENTRY_ISSUES,
        sentryRepoMap: sentry.DEMO_SENTRY_REPO_MAP,
        vercelProjects: vercel.DEMO_VERCEL_PROJECTS,
      }
    },
  })
}
