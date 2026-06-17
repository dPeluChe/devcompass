import { useQuery } from '@tanstack/react-query'
import { fetchVercelDeployments } from '../../api/vercel'
import { vercelAuthFor } from '../../store/vercelConfig'

/**
 * A Vercel project's recent deployments — shared by the repo-detail Deployments
 * tab and the Sentry release-health lookup so the same project isn't fetched
 * twice. `limit` is part of the key, so a 40-deploy lookup and a 20-deploy list
 * stay distinct but reuse this one definition.
 */
export function useVercelDeployments(
  token: string,
  projectId: string | undefined,
  repo: string | undefined,
  opts?: { enabled?: boolean; limit?: number },
) {
  const limit = opts?.limit ?? 20
  return useQuery({
    queryKey: ['vercel', 'deployments', token, projectId, repo, limit],
    enabled: (opts?.enabled ?? true) && !!projectId,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchVercelDeployments(vercelAuthFor(token), { projectId, repo, limit }),
  })
}
