import { DEMO_TOKEN } from '../demo/token'
import { gql } from './client'
import type { Repo, RepoOpenPR, Viewer } from './types'

const REPO_FIELDS = `
  id
  name
  nameWithOwner
  url
  description
  isPrivate
  isArchived
  isFork
  stargazerCount
  pushedAt
  updatedAt
  primaryLanguage { name color }
  owner { login avatarUrl }
  defaultBranchRef { name }
  openPRs: pullRequests(first: 3, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
    totalCount
    nodes {
      id
      number
      title
      url
      updatedAt
      isDraft
      author { login avatarUrl }
      commits(last: 1) {
        nodes { commit { statusCheckRollup { state } } }
      }
    }
  }
  openIssues: issues(states: OPEN) { totalCount }
`

// Raw shape from GitHub before we flatten ciState onto each PR node.
type RawRepoOpenPR = Omit<RepoOpenPR, 'ciState'> & {
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}
type RawRepo = Omit<Repo, 'openPRs'> & {
  openPRs: { totalCount: number; nodes?: RawRepoOpenPR[] }
}

function flattenRepo(raw: RawRepo): Repo {
  const nodes = raw.openPRs.nodes?.map((n) => {
    const { commits, ...rest } = n
    return {
      ...rest,
      ciState: commits?.nodes[0]?.commit.statusCheckRollup?.state ?? null
    } satisfies RepoOpenPR
  })
  return { ...raw, openPRs: { totalCount: raw.openPRs.totalCount, nodes } }
}

export async function fetchViewer(token: string): Promise<Viewer> {
  if (token === DEMO_TOKEN) {
    const { DEMO_VIEWER } = await import('../demo/github')
    return DEMO_VIEWER
  }
  const data = await gql<{ viewer: Viewer }>(token, `
    query {
      viewer {
        login
        name
        avatarUrl
        url
        organizations(first: 100) {
          nodes { login avatarUrl url }
        }
      }
    }
  `)
  return data.viewer
}

type Page = { nodes: Repo[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
type RawPage = { nodes: RawRepo[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

async function fetchViewerReposPage(token: string, after: string | null): Promise<Page> {
  const data = await gql<{ viewer: { repositories: RawPage } }>(
    token,
    `
    query($after: String) {
      viewer {
        repositories(
          first: 50
          after: $after
          affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes { ${REPO_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `,
    { after }
  )
  return { ...data.viewer.repositories, nodes: data.viewer.repositories.nodes.map(flattenRepo) }
}

export async function fetchViewerReposSimple(token: string): Promise<Repo[]> {
  if (token === DEMO_TOKEN) {
    const { DEMO_REPOS, DEMO_VIEWER } = await import('../demo/github')
    return DEMO_REPOS.filter((r) => r.owner.login === DEMO_VIEWER.login)
  }
  const repos: Repo[] = []
  let after: string | null = null
  for (;;) {
    const page = await fetchViewerReposPage(token, after)
    repos.push(...page.nodes)
    if (!page.pageInfo.hasNextPage) break
    after = page.pageInfo.endCursor
  }
  return repos
}

async function fetchOrgReposPage(token: string, login: string, after: string | null): Promise<Page> {
  const data = await gql<{ organization: { repositories: RawPage } | null }>(
    token,
    `
    query($login: String!, $after: String) {
      organization(login: $login) {
        repositories(
          first: 50
          after: $after
          orderBy: { field: PUSHED_AT, direction: DESC }
        ) {
          nodes { ${REPO_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `,
    { login, after }
  )
  const raw = data.organization?.repositories
  if (!raw) return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }
  return { ...raw, nodes: raw.nodes.map(flattenRepo) }
}

export async function fetchOrgReposSimple(token: string, login: string): Promise<Repo[]> {
  if (token === DEMO_TOKEN) {
    const { DEMO_REPOS } = await import('../demo/github')
    return DEMO_REPOS.filter((r) => r.owner.login === login)
  }
  const repos: Repo[] = []
  let after: string | null = null
  for (;;) {
    const page = await fetchOrgReposPage(token, login, after)
    repos.push(...page.nodes)
    if (!page.pageInfo.hasNextPage) break
    after = page.pageInfo.endCursor
  }
  return repos
}
