import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchIssues, type IssueSearchResult } from '../../api/github'
import { DEMO_TOKEN } from '../../api/demo/token'
import { useDemoData } from '../../hooks/useDemoData'
import type { SentryIssue, SentryIssueLevel } from '../../api/sentry'
import { sentryConfigStore } from '../../store/sentryConfig'
import { queryKeys } from '../../store/queries'
import { getCachedPref, savePref, CACHE_TTLS } from '../../store/db'
import { useSentryIssues, SENTRY_ISSUE_LIMIT } from './useSentryIssues'
import type { DotLevel } from './types'

/** Pagination cap for the GitHub issue search (cursor-chained up to this many). */
const GH_ISSUE_LIMIT = 200

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
  /** Present for GitHub rows so the in-app detail modal can fetch + open. */
  github?: { owner: string; name: string; number: number }
}

const SENTRY_DOT: Record<SentryIssueLevel, DotLevel> = {
  fatal: 'critical', error: 'critical', warning: 'warn', info: 'info', debug: 'muted', sample: 'muted',
}

function fromGitHub(i: IssueSearchResult): UnifiedIssue {
  const labels = i.labels.nodes.slice(0, 3).map((l) => l.name).join(' · ')
  const [owner, name = ''] = i.repository.nameWithOwner.split('/')
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
    github: { owner, name, number: i.number },
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
  const isDemo = token === DEMO_TOKEN
  const ghQuery = useQuery({
    queryKey: queryKeys.issueSearch(`assignee:${viewerLogin ?? ''}`),
    queryFn: async () => {
      // IDB-backed so reloads paint instantly.
      const prefKey = `issueSearch:${viewerLogin}`
      const cached = await getCachedPref<IssueSearchResult[]>(prefKey, CACHE_TTLS['issueSearch:'])
      if (cached) return cached
      const fresh = await searchIssues(token, `is:issue is:open assignee:${viewerLogin}`, GH_ISSUE_LIMIT)
      await savePref(prefKey, fresh)
      return fresh
    },
    enabled: !!viewerLogin,
    staleTime: 5 * 60 * 1000,
  })
  const sentryQuery = useSentryIssues()
  const projectRepoMap = sentryConfigStore((s) => s.projectRepoMap)

  // Demo mode showcases the homologation without a real Sentry connection.
  const demo = useDemoData(token)
  const sentryData = isDemo ? demo.data?.sentryIssues : sentryQuery.data
  const repoMap = useMemo(
    () => (isDemo ? demo.data?.sentryRepoMap ?? {} : projectRepoMap),
    [isDemo, demo.data, projectRepoMap]
  )

  const items = useMemo<UnifiedIssue[]>(() => [
    ...(ghQuery.data ?? []).map(fromGitHub),
    ...(sentryData ?? []).map((iss) => fromSentry(iss, repoMap[iss.project.slug] ?? null)),
  ], [ghQuery.data, sentryData, repoMap])

  return {
    items,
    isLoading: ghQuery.isLoading || (!isDemo && sentryQuery.isLoading) || (isDemo && demo.isLoading),
    error: ghQuery.error,
    githubCount: ghQuery.data?.length ?? 0,
    sentryCount: sentryData?.length ?? 0,
    // Single-page fetches: when a feed fills its page it's likely truncated.
    truncated: {
      github: (ghQuery.data?.length ?? 0) >= GH_ISSUE_LIMIT,
      sentry: !isDemo && (sentryQuery.data?.length ?? 0) >= SENTRY_ISSUE_LIMIT,
    },
  }
}
