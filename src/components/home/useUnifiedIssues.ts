import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchIssues, type IssueSearchResult } from '../../api/github'
import type { SentryIssue, SentryIssueLevel } from '../../api/sentry'
import { sentryConfigStore } from '../../store/sentryConfig'
import { queryKeys } from '../../store/queries'
import { useSentryIssues } from './useSentryIssues'
import type { DotLevel } from './types'

export type IssueSource = 'github' | 'sentry'

/** One homologated issue from either source, grouped by repo in the feed. */
export type UnifiedIssue = {
  id: string
  source: IssueSource
  title: string
  url: string
  /** GitHub: the repo. Sentry: the mapped repo, or null when unmapped. */
  repo: string | null
  updatedAt: string
  dot: DotLevel
  metaLine: string
  /** Present for Sentry rows so the in-app detail modal can open. */
  sentry?: SentryIssue
}

const SENTRY_DOT: Record<SentryIssueLevel, DotLevel> = {
  fatal: 'critical', error: 'critical', warning: 'warn', info: 'info', debug: 'muted', sample: 'muted',
}

function fromGitHub(i: IssueSearchResult): UnifiedIssue {
  const labels = i.labels.nodes.slice(0, 3).map((l) => l.name).join(' · ')
  return {
    id: `gh:${i.id}`,
    source: 'github',
    title: i.title,
    url: i.url,
    repo: i.repository.nameWithOwner,
    updatedAt: i.updatedAt,
    dot: 'info',
    metaLine: [`#${i.number}`, labels, i.comments.totalCount ? `${i.comments.totalCount} comments` : '']
      .filter(Boolean).join(' · '),
  }
}

function fromSentry(iss: SentryIssue, repo: string | null): UnifiedIssue {
  return {
    id: `sentry:${iss.id}`,
    source: 'sentry',
    title: iss.title,
    url: iss.permalink,
    repo,
    updatedAt: iss.lastSeen,
    dot: SENTRY_DOT[iss.level] ?? 'info',
    metaLine: `${iss.level} · ${iss.project.slug} · ${iss.count} events · ${iss.userCount} users`,
    sentry: iss,
  }
}

/**
 * Merges open GitHub issues assigned to the viewer with unresolved Sentry issues
 * into one source-tagged list. The GitHub and Sentry queries are independent and
 * cached separately; this hook just adapts + concatenates.
 */
export function useUnifiedIssues(token: string, viewerLogin: string | undefined) {
  const ghQuery = useQuery({
    queryKey: queryKeys.issueSearch(`assignee:${viewerLogin}`),
    queryFn: () => searchIssues(token, `is:issue is:open assignee:${viewerLogin}`),
    enabled: !!viewerLogin,
    staleTime: 5 * 60 * 1000,
  })
  const sentryQuery = useSentryIssues()
  const projectRepoMap = sentryConfigStore((s) => s.projectRepoMap)

  const items = useMemo<UnifiedIssue[]>(() => [
    ...(ghQuery.data ?? []).map(fromGitHub),
    ...(sentryQuery.data ?? []).map((iss) => fromSentry(iss, projectRepoMap[iss.project.slug] ?? null)),
  ], [ghQuery.data, sentryQuery.data, projectRepoMap])

  return {
    items,
    isLoading: ghQuery.isLoading || sentryQuery.isLoading,
    error: ghQuery.error,
    githubCount: ghQuery.data?.length ?? 0,
    sentryCount: sentryQuery.data?.length ?? 0,
  }
}
