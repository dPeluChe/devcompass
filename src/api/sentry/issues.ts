import { sentryFetch, sentryMutate, type SentryAuth, type SentryPage } from './client'
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

// Sentry validates `environment` against real environments and 404s on an
// unknown one. Empty or the sentinel "all" means "no filter" → omit the param.
function normEnvironment(env?: string): string | undefined {
  const e = env?.trim()
  return !e || e.toLowerCase() === 'all' ? undefined : e
}

export function fetchSentryIssues(auth: SentryAuth, opts: IssueQuery): Promise<SentryPage<SentryIssue[]>> {
  return sentryFetch<SentryIssue[]>(`/organizations/${opts.orgSlug}/issues/`, auth, {
    query: opts.query ?? 'is:unresolved',
    environment: normEnvironment(opts.environment),
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
    environment: normEnvironment(opts?.environment),
    statsPeriod: opts?.statsPeriod ?? '14d',
    limit: opts?.limit ?? 25,
  })
}

/**
 * Resolve / ignore / reopen an issue. PUT /organizations/{org}/issues/{id}/
 * with { status }. Needs event:write on the token.
 */
export function updateSentryIssueStatus(
  auth: SentryAuth,
  orgSlug: string,
  issueId: string,
  status: 'resolved' | 'ignored' | 'unresolved'
): Promise<unknown> {
  return sentryMutate(`/organizations/${orgSlug}/issues/${issueId}/`, auth, 'PUT', { status })
}

/**
 * Cursor-paginates fetchSentryIssues up to `max` issues — the cursor support
 * existed in the client but was never consumed, silently capping at one page.
 */
export async function fetchAllSentryIssues(auth: SentryAuth, opts: IssueQuery, max = 300): Promise<SentryIssue[]> {
  const out: SentryIssue[] = []
  let cursor: string | undefined
  while (out.length < max) {
    const page = await fetchSentryIssues(auth, { ...opts, cursor, limit: Math.min(100, max - out.length) })
    out.push(...page.data)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return out.slice(0, max)
}
