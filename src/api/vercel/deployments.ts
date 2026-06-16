import { vercelFetch, type VercelAuth } from './client'
import type { VercelDeployment, VercelDeploymentState, VercelProject } from './types'
import { DEMO_TOKEN, DEMO_VERCEL_PROJECTS, demoVercelDeployments } from '../demo-data'

/** `link` → "owner/repo" for a GitHub-connected project, else null. */
export function repoFromProject(p: VercelProject): string | null {
  if (p.link?.type === 'github' && p.link.org && p.link.repo) return `${p.link.org}/${p.link.repo}`
  return null
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
