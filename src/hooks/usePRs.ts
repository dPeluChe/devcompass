import { useQuery } from '@tanstack/react-query'
import { searchPRs, fetchPullRequestDetail } from '../api/github'
import { queryKeys } from '../store/queries'

export function usePRSearch(token: string, query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.prSearch(query),
    queryFn: () => searchPRs(token, query),
    enabled: enabled && !!token && !!query,
    staleTime: 2 * 60 * 1000,
  })
}

export function usePRDetail(token: string, owner: string, name: string, number: number) {
  return useQuery({
    queryKey: queryKeys.pr(owner, name, number),
    queryFn: () => fetchPullRequestDetail(token, owner, name, number),
    enabled: !!token && !!owner && !!name && number > 0,
  })
}