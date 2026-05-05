import { useQuery } from '@tanstack/react-query'
import { fetchRepoDetail, fetchBranches, type RepoDetail, type Branch } from '../api/github'
import { queryKeys } from '../store/queries'

export function useRepoDetail(token: string, owner: string, name: string) {
  return useQuery<RepoDetail, Error>({
    queryKey: queryKeys.repoDetail(owner, name),
    queryFn: () => fetchRepoDetail(token, owner, name),
    enabled: !!token && !!owner && !!name,
  })
}

export function useBranches(token: string, owner: string, name: string) {
  return useQuery<Branch[], Error>({
    queryKey: queryKeys.branches(owner, name),
    queryFn: () => fetchBranches(token, owner, name),
    enabled: !!token && !!owner && !!name,
  })
}