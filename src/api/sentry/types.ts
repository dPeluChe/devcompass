// Sentry Web API shapes (the subset devcompass consumes). Docs:
// https://docs.sentry.io/api/

export type SentryOrganization = {
  id: string
  slug: string
  name: string
}

export type SentryProject = {
  id: string
  slug: string
  name: string
  platform: string | null
}

export type SentryIssueLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug' | 'sample'

export type SentryIssueStatus = 'unresolved' | 'resolved' | 'ignored' | 'muted'

export type SentryIssue = {
  id: string
  /** Human-friendly short id, e.g. "BACKEND-42". */
  shortId: string
  title: string
  /** Where it happened (function / transaction). */
  culprit: string | null
  level: SentryIssueLevel
  status: SentryIssueStatus
  /** Event count over the queried window — Sentry returns this as a string. */
  count: string
  /** Distinct users affected. */
  userCount: number
  firstSeen: string
  lastSeen: string
  /** Web link to the issue on sentry.io. */
  permalink: string
  project: { id: string; slug: string; name: string }
  metadata?: { type?: string; value?: string; filename?: string }
}

export type SentryEnvironment = { name: string }

/**
 * Links a Sentry project to a source repo (Sentry's "code mappings", used for
 * stack-trace → source linking). The basis for homologating Sentry issues with
 * GitHub repos. `repoName` is "owner/repo" for the GitHub provider.
 */
export type SentryCodeMapping = {
  id: string
  projectId: string
  projectSlug: string
  repoName: string
  defaultBranch: string | null
}
