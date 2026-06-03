import { useEffect, useMemo, useState } from 'react'
import { fetchRepoDetail, type RepoDetail as RepoDetailT } from '../api/github'
import { RdLoading, RdTabs, type Tab } from './repo-detail/common'
import { RdHeader } from './repo-detail/Header'
import { OverviewTab } from './repo-detail/OverviewTab'
import { CommitsTab } from './repo-detail/CommitsTab'
import { PRsTab } from './repo-detail/PRsTab'
import { IssuesTab, ReleasesTab } from './repo-detail/IssuesReleases'
import { SentryTab } from './repo-detail/SentryTab'
import { branchCommitsTotal } from './repo-detail/utils'
import { sentryConfigStore } from '../store/sentryConfig'

type Props = {
  token: string
  owner: string
  name: string
  onClose: () => void
}

export function RepoDetail({ token, owner, name, onClose }: Props) {
  const [data, setData] = useState<RepoDetailT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  // Homologation: does this repo have a mapped Sentry project? (reverse the
  // project-slug → "owner/repo" map seeded from Sentry's code mappings.)
  const sentry = sentryConfigStore()
  const sentryProjectSlug = useMemo(() => {
    if (!sentry.isConfigured()) return null
    const target = `${owner}/${name}`.toLowerCase()
    const hit = Object.entries(sentry.projectRepoMap).find(([, repo]) => repo.toLowerCase() === target)
    return hit ? hit[0] : null
  }, [sentry, owner, name])

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    setTab('overview')
    ;(async () => {
      try {
        const d = await fetchRepoDetail(token, owner, name)
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [token, owner, name])

  return (
    <aside className="rd">
      <RdHeader owner={owner} name={name} data={data} onClose={onClose} />

      {error && <pre className="error-inline rd-error">{error}</pre>}
      {!data && !error && <RdLoading />}

      {data && (
        <>
          <RdTabs
            tab={tab}
            onChange={setTab}
            commitCount={branchCommitsTotal(data) ?? 0}
            prCount={data.pullRequests.totalCount}
            issueCount={data.issues.totalCount}
            releaseCount={data.releases.totalCount}
            showSentry={!!sentryProjectSlug}
          />
          <div className="rd-body">
            {tab === 'overview' && <OverviewTab token={token} owner={owner} name={name} data={data} />}
            {tab === 'commits' && <CommitsTab data={data} />}
            {tab === 'prs' && <PRsTab data={data} />}
            {tab === 'issues' && <IssuesTab data={data} />}
            {tab === 'releases' && <ReleasesTab data={data} />}
            {tab === 'sentry' && sentryProjectSlug && (
              <SentryTab orgSlug={sentry.orgSlug.trim()} projectSlug={sentryProjectSlug} environment={sentry.environment.trim()} />
            )}
          </div>
        </>
      )}
    </aside>
  )
}
