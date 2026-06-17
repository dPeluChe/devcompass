import { useEffect, useMemo, useState } from 'react'
import { fetchRepoDetail, type RepoDetail as RepoDetailT } from '../api/github'
import { RdLoading, RdTabs, type Tab } from './repo-detail/common'
import { RdHeader } from './repo-detail/Header'
import { OverviewTab } from './repo-detail/OverviewTab'
import { CommitsTab } from './repo-detail/CommitsTab'
import { PRsTab } from './repo-detail/PRsTab'
import { IssuesTab, ReleasesTab } from './repo-detail/IssuesReleases'
import { SentryTab } from './repo-detail/SentryTab'
import { DeploymentsTab } from './repo-detail/DeploymentsTab'
import { branchCommitsTotal } from './repo-detail/utils'
import { sentryConfigStore } from '../store/sentryConfig'
import { vercelConfigStore } from '../store/vercelConfig'
import { DEMO_TOKEN, DEMO_VERCEL_PROJECTS } from '../api/demo-data'
import { repoFromProject } from '../api/vercel'

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
  const { token: sentryToken, orgSlug: sentryOrg, environment: sentryEnv, projectRepoMap } = sentryConfigStore()
  const sentryProjectSlug = useMemo(() => {
    if (!sentryToken.trim() || !sentryOrg.trim()) return null
    const target = `${owner}/${name}`.toLowerCase()
    const hit = Object.entries(projectRepoMap).find(([, repo]) => repo.toLowerCase() === target)
    return hit ? hit[0] : null
  }, [projectRepoMap, sentryToken, sentryOrg, owner, name])

  // Same homologation for Vercel: does this repo have a mapped Vercel project?
  const { token: vercelToken, projectRepoMap: vercelMap, projectNames: vercelNames } = vercelConfigStore()
  const vercelProject = useMemo(() => {
    const target = `${owner}/${name}`.toLowerCase()
    if (token === DEMO_TOKEN) {
      const p = DEMO_VERCEL_PROJECTS.find((pp) => repoFromProject(pp)?.toLowerCase() === target)
      return p ? { id: p.id, name: p.name } : null
    }
    if (!vercelToken.trim()) return null
    const hit = Object.entries(vercelMap).find(([, repo]) => repo.toLowerCase() === target)
    return hit ? { id: hit[0], name: vercelNames[hit[0]] ?? hit[0] } : null
  }, [token, owner, name, vercelToken, vercelMap, vercelNames])

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
            showDeployments={!!vercelProject}
          />
          <div className="rd-body">
            {tab === 'overview' && <OverviewTab token={token} owner={owner} name={name} data={data} />}
            {tab === 'commits' && <CommitsTab data={data} />}
            {tab === 'prs' && <PRsTab data={data} />}
            {tab === 'issues' && <IssuesTab data={data} />}
            {tab === 'releases' && <ReleasesTab data={data} />}
            {tab === 'deployments' && vercelProject && (
              <DeploymentsTab token={token} projectId={vercelProject.id} projectName={vercelProject.name} repo={`${owner}/${name}`} />
            )}
            {tab === 'sentry' && sentryProjectSlug && (
              <SentryTab token={token} orgSlug={sentryOrg.trim()} projectSlug={sentryProjectSlug} environment={sentryEnv.trim()} />
            )}
          </div>
        </>
      )}
    </aside>
  )
}
