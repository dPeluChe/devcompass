import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVercelBuildLogs, deploymentState, repoFromDeployment, type VercelDeployment } from '../../api/vercel'
import { vercelAuthFor } from '../../store/vercelConfig'
import { buildVercelDeployAgentText } from '../../utils/agentPrompt'
import { relativeTime } from '../../utils/time'
import { CopyButton } from '../CopyButton'

/** In-app detail for a failed (or any) Vercel deployment: commit context + build log. */
export function DeployModal({ deploy, token, onClose }: { deploy: VercelDeployment | null; token: string; onClose: () => void }) {
  const open = !!deploy

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
  const sha = deploy.meta?.githubCommitSha?.slice(0, 7)
  const ref = deploy.meta?.githubCommitRef
  const msg = deploy.meta?.githubCommitMessage?.split('\n')[0]
  const log = logQuery.data ?? ''

  return (
    <div className="issue-modal-shell">
      <div className="issue-modal-backdrop" role="button" tabIndex={-1} aria-label="Close" onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} />
      <div className="issue-modal" role="dialog" aria-modal="true">
        <header className="issue-modal-head">
          <span className={`connector-issue-level`} style={{ background: state === 'ERROR' ? 'var(--danger)' : '#3fb950' }}>{state.toLowerCase()}</span>
          <h2 className="issue-modal-title">{msg ?? `${repo ?? deploy.name} deploy`}</h2>
          <button className="issue-modal-close" onClick={onClose} title="Close (esc)">×</button>
        </header>

        <div className="issue-modal-meta muted">
          {repo && <code>{repo}</code>} · {deploy.target === 'production' ? 'production' : 'preview'}
          {sha ? ` · ${sha}` : ''}{ref ? ` · ${ref}` : ''}
          {deploy.meta?.githubCommitAuthorName ? ` · @${deploy.meta.githubCommitAuthorName}` : ''}
          {' · '}{relativeTime(new Date(deploy.created).toISOString())}
        </div>

        <div className="issue-modal-actions">
          <CopyButton getText={() => buildVercelDeployAgentText(deploy, repo, log)} />
          {deploy.inspectorUrl && <a className="hs-modal-btn link" href={deploy.inspectorUrl} target="_blank" rel="noopener noreferrer">Open in Vercel ↗</a>}
          {repo && sha && <a className="hs-modal-btn link" href={`https://github.com/${repo}/commit/${deploy.meta?.githubCommitSha}`} target="_blank" rel="noopener noreferrer">Commit ↗</a>}
          {repo && ref && <a className="hs-modal-btn link" href={`https://github.com/${repo}/tree/${ref}`} target="_blank" rel="noopener noreferrer">Branch ↗</a>}
        </div>

        <div className="issue-modal-body">
          <h4 className="deploy-log-head">Build log</h4>
          {logQuery.isLoading && <p className="muted">Loading build log…</p>}
          {logQuery.error && <p className="muted">Couldn't load the log ({logQuery.error instanceof Error ? logQuery.error.message : String(logQuery.error)}).</p>}
          {logQuery.data !== undefined && <pre className="deploy-log">{log || '(empty)'}</pre>}
        </div>
      </div>
    </div>
  )
}
