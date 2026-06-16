import { useState, type MouseEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVercelDeployments, fetchVercelBuildLogs, deploymentState, repoFromDeployment, deployFields, type VercelDeployment, type VercelDeploymentState } from '../../api/vercel'
import { vercelAuthFor } from '../../store/vercelConfig'
import { buildVercelDeployAgentText } from '../../utils/agentPrompt'
import { relativeTime } from '../../utils/time'
import { useFlash } from '../../hooks/useFlash'
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
    queryFn: () => fetchVercelDeployments(vercelAuthFor(token), { projectId, repo }),
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
        : <div className="vercel-deploys">{deps.map((d) => <DeployRow key={d.uid} token={token} d={d} />)}</div>}
    </Surface>
  )
}

function DeployRow({ token, d }: { token: string; d: VercelDeployment }) {
  const state = deploymentState(d)
  const { sha, ref, message, author } = deployFields(d)
  const href = d.inspectorUrl ?? (d.url ? `https://${d.url}` : undefined)
  const [copied, flash] = useFlash(1600)
  const [busy, setBusy] = useState(false)

  async function copyLog(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setBusy(true)
    try {
      const log = await fetchVercelBuildLogs(vercelAuthFor(token), d.uid)
      await navigator.clipboard.writeText(buildVercelDeployAgentText(d, repoFromDeployment(d), log))
    } finally {
      setBusy(false)
      flash()
    }
  }

  return (
    <a className="vercel-deploy" href={href} target="_blank" rel="noopener noreferrer">
      <span className={`vercel-state s-${STATE_TONE[state]}`}>{state.toLowerCase()}</span>
      <span className="vercel-target">{d.target === 'production' ? 'prod' : 'preview'}</span>
      <div className="vercel-deploy-main">
        <span className="vercel-deploy-msg">{message ?? d.url}</span>
        <span className="vercel-deploy-meta muted">
          {sha && <code>{sha}</code>}{ref ? ` · ${ref}` : ''}
          {author ? ` · @${author}` : ''}
          {' · '}{relativeTime(new Date(d.created).toISOString())}
        </span>
      </div>
      {state === 'ERROR' && (
        <button className="hs-modal-btn" onClick={copyLog} disabled={busy} title="Copy build log for agent">
          {copied ? '✓ Copied' : busy ? '…' : '⧉ Build log'}
        </button>
      )}
    </a>
  )
}
