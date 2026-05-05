import { useQuery } from '@tanstack/react-query'
import {
  fetchAllRepos,
  fetchRateLimit,
  fetchTokenInfo,
  fetchUserOrgsRest,
  fetchViewer,
  type Viewer,
} from '../api/github'
import { queryKeys } from '../store/queries'

export function useViewer(token: string) {
  return useQuery({
    queryKey: queryKeys.viewer,
    queryFn: () => fetchViewer(token),
    enabled: !!token,
  })
}

export function useViewerWithOrgs(
  token: string,
  onProgress?: (e: { kind: string; count?: number; login?: string; total?: number }) => void
) {
  return useQuery<{ viewer: Viewer; repos: any[]; errors: any[] }, Error>({
    queryKey: queryKeys.viewerRepos,
    queryFn: async () => {
      const viewer = await fetchViewer(token)
      const restOrgs = await fetchUserOrgsRest(token).catch(() => [])
      const merged = new Map<string, any>()
      for (const o of viewer.organizations.nodes) merged.set(o.login, o)
      for (const o of restOrgs) {
        if (!merged.has(o.login)) {
          merged.set(o.login, { login: o.login, avatarUrl: o.avatar_url, url: o.url })
        }
      }
      const mergedViewer = { ...viewer, organizations: { nodes: [...merged.values()] } }
      const { repos, errors } = await fetchAllRepos(token, mergedViewer, onProgress)
      return { viewer: mergedViewer, repos, errors }
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRateLimit(token: string) {
  return useQuery({
    queryKey: queryKeys.rateLimit,
    queryFn: () => fetchRateLimit(token),
    enabled: !!token,
    staleTime: 60 * 1000,
  })
}

export function useTokenInfo(token: string) {
  return useQuery({
    queryKey: queryKeys.tokenInfo,
    queryFn: () => fetchTokenInfo(token),
    enabled: !!token,
    staleTime: 30 * 60 * 1000,
  })
}