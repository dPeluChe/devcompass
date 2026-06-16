import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchVercelBuildLogs, deploymentState, repoFromDeployment, deployFields, type VercelDeployment } from '../../api/vercel'
import { vercelAuthFor } from '../../store/vercelConfig'
import { dismissDeploy } from '../../store/db'
import { buildVercelDeployAgentText } from '../../utils/agentPrompt'
import { relativeTime } from '../../utils/time'
import { CopyButton } from '../CopyButton'

/** In-app detail for a failed (or any) Vercel deployment: commit context + build log. */
export function DeployModal({ deploy, token, onClose }: { deploy: VercelDeployment | null; token: string; onClose: () => void }) {
  const open = !!deploy
  const queryClient = useQueryClient()

  async function markHandled() {
    if (!deploy) return
    await dismissDeploy(deploy.uid)
    queryClient.invalidateQueries({ queryKey: ['vercel', 'failed-deploys'] })
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  const logQuery = useQuery({
    queryKey: ['vercel', 'log', deploy?.uid],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchVercelBuildLogs(vercelAuthFor(token), deploy!.uid),
  })

  if (!deploy) return null
  const state = deploymentState(deploy)
  const repo = repoFromDeployment(deploy)
  const { sha, fullSha, ref, message, author } = deployFields(deploy)
  const log = logQuery.data ?? ''

  return (
    <div className="issue-modal-shell">
      <div className="issue-modal-backdrop" role="button" tabIndex={-1} aria-label="Close" onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} />
      <div className="issue-modal" role="dialog" aria-modal="true">
        <header className="issue-modal-head">
          <span className="hs-source-badge vercel">▲ Vercel</span>
          <span className="connector-issue-level" style={{ background: state === 'ERROR' ? 'var(--danger)' : '#3fb950' }}>{state.toLowerCase()}</span>
          <h2 className="issue-modal-title">{message ?? `${repo ?? deploy.name} deploy`}</h2>
          <button className="issue-modal-close" onClick={onClose} title="Close (esc)">×</button>
        </header>

        <div className="issue-modal-meta muted">
          {repo && <code>{repo}</code>} · {deploy.target === 'production' ? 'production' : 'preview'}
          {sha ? ` · ${sha}` : ''}{ref ? ` · ${ref}` : ''}
          {author ? ` · @${author}` : ''}
          {' · '}{relativeTime(new Date(deploy.created).toISOString())}
        </div>

        <div className="issue-modal-actions">
          <CopyButton getText={() => buildVercelDeployAgentText(deploy, repo, log)} />
          <button className="hs-modal-btn ok" onClick={markHandled} title="Acknowledge — removes it from your Needs me alert">✓ Mark as handled</button>
          {deploy.inspectorUrl && <a className="hs-modal-btn link" href={deploy.inspectorUrl} target="_blank" rel="noopener noreferrer">Open in Vercel ↗</a>}
          {repo && fullSha && <a className="hs-modal-btn link" href={`https://github.com/${repo}/commit/${fullSha}`} target="_blank" rel="noopener noreferrer">Commit ↗</a>}
          {repo && ref && <a className="hs-modal-btn link" href={`https://github.com/${repo}/tree/${ref}`} target="_blank" rel="noopener noreferrer">Branch ↗</a>}
        </div>

        <div className="issue-modal-body">
          <h4 className="deploy-log-head">Build log</h4>
          {logQuery.isLoading && <p className="muted">Loading build log…</p>}
          {logQuery.error && <p className="muted">Couldn't load the log ({logQuery.error instanceof Error ? logQuery.error.message : String(logQuery.error)}).</p>}
          {logQuery.data !== undefined && (
            log
              ? <pre className="deploy-log">{log}</pre>
              : <p className="muted">No build log available — Vercel prunes build logs for older deployments. Open it in Vercel for the full output.</p>
          )}
        </div>
      </div>
    </div>
  )
}
