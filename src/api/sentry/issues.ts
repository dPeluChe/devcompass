import { sentryFetch, type SentryAuth, type SentryPage } from './client'
import type { SentryCodeMapping, SentryEnvironment, SentryIssue, SentryOrganization, SentryProject } from './types'

/**
 * Project↔repo code mappings — the homologation source. May require broader org
 * read than issue endpoints, so callers should handle failure independently of
 * the issues flow.
 */
export function fetchSentryCodeMappings(auth: SentryAuth, orgSlug: string): Promise<SentryPage<SentryCodeMapping[]>> {
  return sentryFetch<SentryCodeMapping[]>(`/organizations/${orgSlug}/code-mappings/`, auth)
}

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

/**
 * Per-project issues. Uses the project endpoint (accepts the project *slug*,
 * unlike the org endpoint's ?project= which needs a numeric id) — convenient
 * when homologating from a repo's mapped project slug.
 */
export function fetchSentryProjectIssues(
  auth: SentryAuth,
  orgSlug: string,
  projectSlug: string,
  opts?: { environment?: string; query?: string; statsPeriod?: string; limit?: number }
): Promise<SentryPage<SentryIssue[]>> {
  return sentryFetch<SentryIssue[]>(`/projects/${orgSlug}/${projectSlug}/issues/`, auth, {
    query: opts?.query ?? 'is:unresolved',
    environment: opts?.environment,
    statsPeriod: opts?.statsPeriod ?? '14d',
    limit: opts?.limit ?? 25,
  })
}
