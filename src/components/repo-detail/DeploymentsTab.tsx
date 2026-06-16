import { useQuery } from '@tanstack/react-query'
import { fetchVercelDeployments, deploymentState, type VercelDeployment, type VercelDeploymentState } from '../../api/vercel'
import { vercelConfigStore } from '../../store/vercelConfig'
import { DEMO_TOKEN } from '../../api/demo-data'
import { relativeTime } from '../../utils/time'
import { EmptyState, RdLoading, Surface } from './common'

const STATE_TONE: Record<VercelDeploymentState, string> = {
  READY: 'ok', ERROR: 'crit', BUILDING: 'warn', QUEUED: 'warn', INITIALIZING: 'warn', CANCELED: 'muted',
}

/**
 * A repo's recent Vercel deployments, resolved via the project↔repo map.
 * Only mounted when RepoDetail found a mapped Vercel project for this repo.
 */
export function DeploymentsTab({ token, projectId, projectName, repo }: {
  token: string; projectId: string; projectName: string; repo: string
}) {
  const query = useQuery({
    queryKey: ['vercel', 'deployments', token, projectId, repo],
    queryFn: () => {
      // Demo mode has no real connector — pass the demo token so the fetcher
      // serves canned deployments.
      const auth = token === DEMO_TOKEN
        ? { token: DEMO_TOKEN, teamId: '', proxyBase: '' }
        : vercelConfigStore.getState().getAuth()
      return fetchVercelDeployments(auth, { projectId, repo })
    },
    staleTime: 60 * 1000,
  })

  const title = `Vercel · ${projectName}`
  if (query.isLoading) return <Surface title={title}><RdLoading /></Surface>
  if (query.error) {
    return <Surface title={title}><div className="hs-status hs-status-err">{query.error instanceof Error ? query.error.message : String(query.error)}</div></Surface>
  }
  const deps = query.data ?? []
  return (
    <Surface title={title} wide>
      {deps.length === 0
        ? <EmptyState label="No deployments for this project yet." />
        : <div className="vercel-deploys">{deps.map((d) => <DeployRow key={d.uid} d={d} />)}</div>}
    </Surface>
  )
}

function DeployRow({ d }: { d: VercelDeployment }) {
  const state = deploymentState(d)
  const sha = d.meta?.githubCommitSha?.slice(0, 7)
  const ref = d.meta?.githubCommitRef
  const msg = d.meta?.githubCommitMessage?.split('\n')[0]
  const href = d.inspectorUrl ?? (d.url ? `https://${d.url}` : undefined)
  return (
    <a className="vercel-deploy" href={href} target="_blank" rel="noopener noreferrer">
      <span className={`vercel-state s-${STATE_TONE[state]}`}>{state.toLowerCase()}</span>
      <span className="vercel-target">{d.target === 'production' ? 'prod' : 'preview'}</span>
      <div className="vercel-deploy-main">
        <span className="vercel-deploy-msg">{msg ?? d.url}</span>
        <span className="vercel-deploy-meta muted">
          {sha && <code>{sha}</code>}{ref ? ` · ${ref}` : ''}
          {d.meta?.githubCommitAuthorName ? ` · @${d.meta.githubCommitAuthorName}` : d.creator?.username ? ` · @${d.creator.username}` : ''}
          {' · '}{relativeTime(new Date(d.created).toISOString())}
        </span>
      </div>
    </a>
  )
}
