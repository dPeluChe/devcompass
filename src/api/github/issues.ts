import { DEMO_TOKEN, DEMO_ISSUES } from '../demo-data'
import { gql, rest } from './client'

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
export async function searchIssues(token: string, query: string, max = 200): Promise<IssueSearchResult[]> {
  if (token === DEMO_TOKEN) return DEMO_ISSUES
  const out: IssueSearchResult[] = []
  let after: string | null = null
  // Cursor-paginate (50/page) up to `max` so big backlogs aren't silently
  // first-page-only. The cap keeps a pathological account from burning quota.
  while (out.length < max) {
    const data: {
      search: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: (IssueSearchResult | Record<string, never>)[]
      }
    } = await gql(
      token,
      `
      query($q: String!, $first: Int!, $after: String) {
        search(query: $q, type: ISSUE, first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
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
      { q: query, first: Math.min(50, max - out.length), after }
    )
    out.push(...data.search.nodes.filter((n): n is IssueSearchResult => !!(n as IssueSearchResult).id))
    if (!data.search.pageInfo.hasNextPage) break
    after = data.search.pageInfo.endCursor
  }
  return out
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

export async function fetchIssueDetail(token: string, owner: string, name: string, number: number): Promise<GitHubIssueDetail | null> {
  const data = await gql<{ repository: { issue: GitHubIssueDetail | null } | null }>(
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
  return data.repository?.issue ?? null
}

/** Close or reopen an issue. PATCH /repos/{owner}/{repo}/issues/{number}. */
export async function setIssueState(token: string, owner: string, name: string, number: number, state: 'closed' | 'open'): Promise<void> {
  if (token === DEMO_TOKEN) return
  await rest(token, 'PATCH', `/repos/${owner}/${name}/issues/${number}`, { state })
}
