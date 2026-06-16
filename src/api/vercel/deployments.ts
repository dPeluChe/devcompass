import { vercelFetch, vercelFetchText, type VercelAuth } from './client'
import type { VercelDeployment, VercelDeploymentState, VercelProject } from './types'
import { DEMO_TOKEN, DEMO_VERCEL_PROJECTS, demoVercelDeployments, demoFailedDeployments, demoVercelBuildLog } from '../demo-data'

/** `link` → "owner/repo" for a GitHub-connected project, else null. */
export function repoFromProject(p: VercelProject): string | null {
  if (p.link?.type === 'github' && p.link.org && p.link.repo) return `${p.link.org}/${p.link.repo}`
  return null
}

/** Production URL for a project — prefers a custom domain, falls back to <name>.vercel.app. */
export function prodUrlForProject(p: VercelProject): string {
  const aliases = p.targets?.production?.alias ?? []
  const chosen = aliases.find((a) => !a.endsWith('.vercel.app')) ?? aliases[0] ?? `${p.name}.vercel.app`
  return chosen.startsWith('http') ? chosen : `https://${chosen}`
}

/** Normalize the deployment's effective state (state ?? readyState). */
export function deploymentState(d: VercelDeployment): VercelDeploymentState {
  return d.state ?? d.readyState ?? 'QUEUED'
}

/** List the account's projects (first page, 100). Used to seed project→repo mapping. */
export async function fetchVercelProjects(auth: VercelAuth): Promise<VercelProject[]> {
  if (auth.token === DEMO_TOKEN) return DEMO_VERCEL_PROJECTS
  const data = await vercelFetch<{ projects?: VercelProject[] }>('/v9/projects', auth, { limit: 100 })
  return data.projects ?? []
}

/** Validate a token by listing projects — returns the project list on success. */
export async function validateVercelToken(auth: VercelAuth): Promise<VercelProject[]> {
  return fetchVercelProjects(auth)
}

/** Recent deployments for a project (by id or name). Newest first. */
export async function fetchVercelDeployments(
  auth: VercelAuth,
  opts: { projectId?: string; repo?: string; limit?: number }
): Promise<VercelDeployment[]> {
  if (auth.token === DEMO_TOKEN) return demoVercelDeployments(opts.repo ?? opts.projectId ?? '')
  const data = await vercelFetch<{ deployments?: VercelDeployment[] }>('/v6/deployments', auth, {
    projectId: opts.projectId,
    limit: opts.limit ?? 20,
  })
  return data.deployments ?? []
}

/** "owner/repo" for a deployment, from its GitHub commit meta. */
export function repoFromDeployment(d: VercelDeployment): string | null {
  return d.meta?.githubCommitOrg && d.meta.githubCommitRepo ? `${d.meta.githubCommitOrg}/${d.meta.githubCommitRepo}` : null
}

/** Recent FAILED production deployments across the account — for the Needs-me alert. */
export async function fetchFailedDeployments(auth: VercelAuth, limit = 15): Promise<VercelDeployment[]> {
  if (auth.token === DEMO_TOKEN) return demoFailedDeployments()
  const data = await vercelFetch<{ deployments?: VercelDeployment[] }>('/v6/deployments', auth, {
    state: 'ERROR', target: 'production', limit,
  })
  // Defensive client-side filter — don't trust the server params to narrow exactly.
  return (data.deployments ?? []).filter((d) => deploymentState(d) === 'ERROR' && d.target === 'production')
}

type LogEvent = { text?: string; payload?: { text?: string } }
function eventText(ev: LogEvent): string | null {
  const t = ev?.text ?? ev?.payload?.text
  return t ? String(t).replace(/\n$/, '') : null
}

/** Build log text for a deployment. The events endpoint returns a JSON array or
    NDJSON depending on state — handle both. Capped to the tail. */
export async function fetchVercelBuildLogs(auth: VercelAuth, deploymentId: string, maxChars = 6000): Promise<string> {
  if (auth.token === DEMO_TOKEN) return demoVercelBuildLog(deploymentId)
  const raw = (await vercelFetchText(`/v2/deployments/${deploymentId}/events`, auth, { builds: 1, limit: 1000 })).trim()
  const lines: string[] = []
  let handled = false
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw) as LogEvent[]
      if (Array.isArray(arr)) { handled = true; for (const ev of arr) { const t = eventText(ev); if (t) lines.push(t) } }
    } catch { /* not a JSON array — fall through to NDJSON */ }
  }
  if (!handled) {
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try { const t = eventText(JSON.parse(line) as LogEvent); if (t) lines.push(t) }
      catch { lines.push(line) }
    }
  }
  const log = lines.join('\n')
  return log.length > maxChars ? `… (truncated)\n${log.slice(-maxChars)}` : log
}
