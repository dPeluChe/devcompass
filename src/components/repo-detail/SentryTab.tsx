import { useQuery } from '@tanstack/react-query'
import { fetchSentryProjectIssues } from '../../api/sentry'
import { sentryConfigStore } from '../../store/sentryConfig'
import { queryKeys } from '../../store/queries'
import { SentryIssueList } from '../connectors/SentryIssueList'
import { EmptyState, RdLoading, Surface } from './common'

/**
 * Homologation view: a repo's Sentry issues, resolved via the project↔repo map.
 * Only mounted when RepoDetail found a mapped project for this repo.
 */
export function SentryTab({ token, orgSlug, projectSlug, environment }: { token: string; orgSlug: string; projectSlug: string; environment: string }) {
  const query = useQuery({
    queryKey: queryKeys.sentryIssues(orgSlug, `${projectSlug}:${environment || 'all'}`),
    queryFn: async () => {
      const auth = sentryConfigStore.getState().getAuth()
      const { data } = await fetchSentryProjectIssues(auth, orgSlug, projectSlug, { environment })
      return data
    },
    staleTime: 60 * 1000,
  })

  const title = `Sentry · ${projectSlug}${environment ? ` · @${environment}` : ''}`

  if (query.isLoading) return <Surface title={title}><RdLoading /></Surface>
  if (query.error) {
    return (
      <Surface title={title}>
        <div className="hs-status hs-status-err">{query.error instanceof Error ? query.error.message : String(query.error)}</div>
      </Surface>
    )
  }
  const issues = query.data ?? []
  return (
    <Surface title={title} wide>
      {issues.length === 0
        ? <EmptyState label="No unresolved Sentry issues for this project." />
        : <SentryIssueList issues={issues} token={token} />}
    </Surface>
  )
}
