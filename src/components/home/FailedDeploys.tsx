import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchFailedDeployments, fetchVercelBuildLogs, repoFromDeployment, type VercelDeployment,
} from '../../api/vercel'
import { vercelConfigStore, vercelAuthFor } from '../../store/vercelConfig'
import { DEMO_TOKEN } from '../../api/demo-data'
import { getCachedPref, savePref, CACHE_TTLS } from '../../store/db'
import { buildVercelDeployAgentText } from '../../utils/agentPrompt'
import { relativeTime } from '../../utils/time'
import { useFlash } from '../../hooks/useFlash'

/** Failed production deploys across the account. Shared by key, so calling it in
    both NeedsScope (for the count) and the section below fetches once. */
export function useFailedDeploys(token: string) {
  const configured = vercelConfigStore((s) => s.isConfigured())
  return useQuery<VercelDeployment[]>({
    queryKey: ['vercel', 'failed-deploys', token],
    enabled: token === DEMO_TOKEN || configured,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const key = `vercelFailed:${token}`
      const cached = await getCachedPref<VercelDeployment[]>(key, CACHE_TTLS['vercelFailed:'])
      if (cached) return cached
      const deploys = await fetchFailedDeployments(vercelAuthFor(token), 15)
      await savePref(key, deploys)
      return deploys
    },
  })
}

/** Failed production deploys across the account — shown at the top of Needs me. */
export function FailedDeploys({ token }: { token: string }) {
  const deploys = useFailedDeploys(token).data ?? []
  if (deploys.length === 0) return null

  return (
    <>
      <h3 className="hs-section-label">
        Failed deploys
        <span className="muted"> — production builds that broke</span>
      </h3>
      <section className="hs-surface">
        {deploys.map((d) => <DeployAlertRow key={d.uid} token={token} d={d} />)}
      </section>
    </>
  )
}

function DeployAlertRow({ token, d }: { token: string; d: VercelDeployment }) {
  const repo = repoFromDeployment(d)
  const sha = d.meta?.githubCommitSha?.slice(0, 7)
  const href = d.inspectorUrl ?? (d.url ? `https://${d.url}` : undefined)
  const [copied, flash] = useFlash(1600)
  const [busy, setBusy] = useState(false)

  async function copyLog() {
    setBusy(true)
    try {
      const log = await fetchVercelBuildLogs(vercelAuthFor(token), d.uid)
      await navigator.clipboard.writeText(buildVercelDeployAgentText(d, repo, log))
      flash()
    } catch {
      flash()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hs-notif-row">
      <span className="hs-dot critical" />
      <div className="hs-notif-main">
        <span className="hs-notif-title">
          {repo ? <strong>{repo}</strong> : d.name} — {d.meta?.githubCommitMessage?.split('\n')[0] ?? 'production deploy failed'}
        </span>
        <div className="hs-notif-meta muted">
          deploy failed{sha ? ` · ${sha}` : ''}{d.meta?.githubCommitRef ? ` · ${d.meta.githubCommitRef}` : ''}
          {d.meta?.githubCommitAuthorName ? ` · @${d.meta.githubCommitAuthorName}` : ''} · {relativeTime(new Date(d.created).toISOString())}
        </div>
      </div>
      <button className="hs-modal-btn" onClick={copyLog} disabled={busy} title="Copy build log for agent">
        {copied ? '✓ Copied' : busy ? '…' : '⧉ Build log'}
      </button>
      {href && <a className="hs-issue-ext" href={href} target="_blank" rel="noopener noreferrer" title="Open in Vercel">↗</a>}
    </div>
  )
}
