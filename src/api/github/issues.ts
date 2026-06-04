import { DEMO_TOKEN } from '../demo-data'
import { gql } from './client'

export type IssueSearchResult = {
  id: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  createdAt: string
  updatedAt: string
  author: { login: string; avatarUrl: string } | null
  repository: { nameWithOwner: string; url: string; owner: { login: string; avatarUrl: string } }
  labels: { nodes: { name: string; color: string }[] }
  comments: { totalCount: number }
}

/**
 * Cross-repo GitHub issue search (the bug-tracker side, distinct from PR search).
 * Filters out PRs that the ISSUE search type also returns by keeping only nodes
 * resolved as Issue (they carry an id).
 */
export async function searchIssues(token: string, query: string, first = 50): Promise<IssueSearchResult[]> {
  if (token === DEMO_TOKEN) return []
  const data = await gql<{ search: { nodes: (IssueSearchResult | Record<string, never>)[] } }>(
    token,
    `
    query($q: String!, $first: Int!) {
      search(query: $q, type: ISSUE, first: $first) {
        nodes {
          ... on Issue {
            id
            number
            title
            url
            state
            createdAt
            updatedAt
            author { login avatarUrl }
            repository {
              nameWithOwner
              url
              owner { login avatarUrl }
            }
            labels(first: 8) { nodes { name color } }
            comments { totalCount }
          }
        }
      }
    }
  `,
    { q: query, first }
  )
  return data.search.nodes.filter((n): n is IssueSearchResult => !!(n as IssueSearchResult).id)
}

export type GitHubIssueDetail = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  bodyHTML: string
  /** Raw markdown — used for the "copy for agent" payload. */
  body: string
  createdAt: string
  updatedAt: string
  author: { login: string; avatarUrl: string } | null
  repository: { nameWithOwner: string }
  labels: { nodes: { name: string; color: string }[] }
  assignees: { nodes: { login: string; avatarUrl: string }[] }
  comments: { totalCount: number }
}

export async function fetchIssueDetail(token: string, owner: string, name: string, number: number): Promise<GitHubIssueDetail> {
  const data = await gql<{ repository: { issue: GitHubIssueDetail } }>(
    token,
    `
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          number
          title
          url
          state
          bodyHTML
          body
          createdAt
          updatedAt
          author { login avatarUrl }
          repository { nameWithOwner }
          labels(first: 20) { nodes { name color } }
          assignees(first: 10) { nodes { login avatarUrl } }
          comments { totalCount }
        }
      }
    }
  `,
    { owner, name, number }
  )
  return data.repository.issue
}
