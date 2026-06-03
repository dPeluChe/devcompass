import { sentryFetch, type SentryAuth, type SentryPage } from './client'
import type { SentryEnvironment, SentryIssue, SentryOrganization, SentryProject } from './types'

export function fetchSentryOrgs(auth: SentryAuth): Promise<SentryPage<SentryOrganization[]>> {
  return sentryFetch<SentryOrganization[]>('/organizations/', auth)
}

export function fetchSentryProjects(auth: SentryAuth, orgSlug: string): Promise<SentryPage<SentryProject[]>> {
  return sentryFetch<SentryProject[]>(`/organizations/${orgSlug}/projects/`, auth)
}

/** Per-project environment list — drives the environment filter on issues. */
export function fetchSentryEnvironments(
  auth: SentryAuth,
  orgSlug: string,
  projectSlug: string
): Promise<SentryPage<SentryEnvironment[]>> {
  return sentryFetch<SentryEnvironment[]>(`/projects/${orgSlug}/${projectSlug}/environments/`, auth)
}

export type IssueQuery = {
  orgSlug: string
  /** Numeric project id; omit (or '-1') for all projects. */
  project?: string
  /** Environment name, e.g. "production". Omit for all environments. */
  environment?: string
  /** Sentry search query. Default: unresolved only. */
  query?: string
  /** Relative window, e.g. "14d", "24h". */
  statsPeriod?: string
  cursor?: string
  limit?: number
}

export function fetchSentryIssues(auth: SentryAuth, opts: IssueQuery): Promise<SentryPage<SentryIssue[]>> {
  return sentryFetch<SentryIssue[]>(`/organizations/${opts.orgSlug}/issues/`, auth, {
    query: opts.query ?? 'is:unresolved',
    environment: opts.environment,
    project: opts.project,
    statsPeriod: opts.statsPeriod ?? '14d',
    cursor: opts.cursor,
    limit: opts.limit ?? 25,
  })
}
