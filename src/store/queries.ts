import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
})

export const queryKeys = {
  viewer: ['viewer'] as const,
  viewerRepos: ['viewer', 'repos'] as const,
  orgRepos: (login: string) => ['org', login, 'repos'] as const,
  repo: (owner: string, name: string) => ['repo', owner, name] as const,
  repoDetail: (owner: string, name: string) => ['repo', owner, name, 'detail'] as const,
  branches: (owner: string, name: string) => ['repo', owner, name, 'branches'] as const,
  prSearch: (query: string) => ['prs', 'search', query] as const,
  pr: (owner: string, name: string, number: number) => ['pr', owner, name, number] as const,
  rateLimit: ['rateLimit'] as const,
  tokenInfo: ['tokenInfo'] as const,
  userOrgs: ['user', 'orgs'] as const,
}