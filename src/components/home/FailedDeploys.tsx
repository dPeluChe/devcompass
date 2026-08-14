import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchFailedDeployments, repoFromDeployment, deployFields, type VercelDeployment } from '../../api/vercel'
import { vercelConfigStore, vercelAuthFor } from '../../store/vercelConfig'
import { DEMO_TOKEN } from '../../api/demo/token'
import { getCachedPref, savePref, getDismissedDeploys, CACHE_TTLS } from '../../store/db'
import { relativeTime } from '../../utils/time'
import { OrgChip } from './OrgChip'
import { DeployModal } from './DeployModal'

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
      let deploys = await getCachedPref<VercelDeployment[]>(key, CACHE_TTLS['vercelFailed:'])
      if (!deploys) {
        deploys = await fetchFailedDeployments(vercelAuthFor(token), 15)
        await savePref(key, deploys)
      }
      // Drop the ones the user already marked as handled.
      const dismissed = await getDismissedDeploys()
      return deploys.filter((d) => !dismissed.has(d.uid))
    },
  })
}

/** Failed production deploys, rendered like the PR attention rows (newest first),
    opening an in-app modal — shown at the top of Needs me. */
export function FailedDeploys({ token }: { token: string }) {
  const [selected, setSelected] = useState<VercelDeployment | null>(null)
  const { data } = useFailedDeploys(token)
  const sorted = useMemo(() => [...(data ?? [])].sort((a, b) => b.created - a.created), [data])
  if (sorted.length === 0) return null

  return (
    <>
      <h3 className="hs-section-label">
        Failed deploys
        <span className="muted"> — production builds that broke</span>
      </h3>
      <section className="hs-surface">
        {sorted.map((d) => <DeployRow key={d.uid} d={d} onOpen={() => setSelected(d)} />)}
      </section>
      <DeployModal deploy={selected} token={token} onClose={() => setSelected(null)} />
    </>
  )
}

function DeployRow({ d, onOpen }: { d: VercelDeployment; onOpen: () => void }) {
  const repo = repoFromDeployment(d)
  const [org, name] = (repo ?? `/${d.name}`).split('/')
  const { ref, message } = deployFields(d)
  const title = message ?? 'production deploy failed'

  return (
    <div className="hs-row" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}>
      <span className="hs-dot critical" />
      <div className="hs-row-main">
        <div className="hs-row-title">
          <OrgChip login={org} avatarUrl={`https://github.com/${org}.png`} />
          <span className="hs-org-name">{org}</span>
          <span className="hs-sep">/</span>
          <span className="hs-repo-name">{name}</span>
          <span className="hs-pr-title">{title}</span>
        </div>
        <div className="hs-row-meta">
          <span className="hs-source-badge vercel">▲ Vercel</span>
          <span className="hs-reason r-ci-failing">deploy failed</span>
          <span className="hs-row-time">{relativeTime(new Date(d.created).toISOString(), false)}</span>
          {ref && <span className="hs-branch" title={`Branch: ${ref}`}>⎇ {ref}</span>}
        </div>
      </div>
    </div>
  )
}
