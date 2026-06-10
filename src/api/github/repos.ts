import { DEMO_TOKEN, DEMO_VIEWER, DEMO_REPOS } from '../demo-data'
import { gql } from './client'
import type { Repo, RepoOpenPR, Viewer, RepoDetail, Branch } from './types'

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
  if (token === DEMO_TOKEN) return DEMO_VIEWER
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
  if (token === DEMO_TOKEN) return DEMO_REPOS.filter((r) => r.owner.login === DEMO_VIEWER.login)
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
  if (token === DEMO_TOKEN) return DEMO_REPOS.filter((r) => r.owner.login === login)
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

export async function fetchRepoDetail(token: string, owner: string, name: string): Promise<RepoDetail> {
  if (token === DEMO_TOKEN) {
    const repo = DEMO_REPOS.find((r) => r.owner.login === owner && r.name === name)
    if (!repo) throw new Error(`Demo: repo ${owner}/${name} not found`)
    const prnodes = (repo.openPRs.nodes ?? []).map((n) => ({
      number: n.number, title: n.title, url: n.url,
      state: 'OPEN' as const, isDraft: n.isDraft,
      createdAt: n.updatedAt, updatedAt: n.updatedAt,
      mergedAt: null, closedAt: null, author: n.author,
    }))
    return {
      id: repo.id, nameWithOwner: repo.nameWithOwner, url: repo.url,
      description: repo.description, homepageUrl: null,
      isPrivate: repo.isPrivate, isArchived: false, isFork: repo.isFork, isTemplate: false,
      diskUsage: null, forkCount: 0, stargazerCount: repo.stargazerCount,
      watchers: { totalCount: 0 }, createdAt: repo.updatedAt,
      pushedAt: repo.pushedAt, updatedAt: repo.updatedAt, licenseInfo: { name: 'MIT', spdxId: 'MIT' },
      primaryLanguage: repo.primaryLanguage,
      repositoryTopics: { nodes: [] },
      owner: { ...repo.owner, url: `https://github.com/${repo.owner.login}` },
      defaultBranchRef: repo.defaultBranchRef ? {
        name: repo.defaultBranchRef.name,
        target: { __typename: 'Commit', oid: 'abc123', history: { totalCount: 0, nodes: [] }, statusCheckRollup: null }
      } : null,
      pullRequests: { totalCount: repo.openPRs.totalCount, nodes: prnodes },
      issues: { totalCount: repo.openIssues.totalCount, nodes: [] },
      releases: { totalCount: 0, nodes: [] },
      languages: {
        totalSize: 100,
        edges: repo.primaryLanguage ? [{ size: 100, node: repo.primaryLanguage }] : [],
      },
      mentionableUsers: { totalCount: 0 },
    }
  }
  const data = await gql<{ repository: RepoDetail }>(
    token,
    `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
        nameWithOwner
        url
        description
        homepageUrl
        isPrivate
        isArchived
        isFork
        isTemplate
        diskUsage
        forkCount
        stargazerCount
        watchers { totalCount }
        createdAt
        pushedAt
        updatedAt
        licenseInfo { name spdxId }
        primaryLanguage { name color }
        owner { login avatarUrl url }
        defaultBranchRef {
          name
          target {
            __typename
            ... on Commit {
              oid
              history(first: 50) {
                totalCount
                nodes {
                  oid
                  messageHeadline
                  committedDate
                  url
                  author { name user { login avatarUrl } }
                  associatedPullRequests(first: 1) {
                    nodes { number headRefName }
                  }
                }
              }
              statusCheckRollup { state }
            }
          }
        }
        repositoryTopics(first: 20) { nodes { topic { name } } }
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
          totalSize
          edges { size node { name color } }
        }
        pullRequests(first: 30, orderBy: { field: UPDATED_AT, direction: DESC }) {
          totalCount
          nodes {
            number title url state isDraft createdAt updatedAt mergedAt closedAt
            author { login avatarUrl }
          }
        }
        issues(first: 10, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
          totalCount
          nodes {
            number title url createdAt updatedAt
            author { login avatarUrl }
            labels(first: 5) { nodes { name color } }
          }
        }
        releases(first: 5, orderBy: { field: CREATED_AT, direction: DESC }) {
          totalCount
          nodes { tagName name publishedAt url isPrerelease }
        }
        mentionableUsers { totalCount }
      }
    }
  `,
    { owner, name }
  )
  return data.repository
}

export async function fetchBranches(token: string, owner: string, name: string): Promise<Branch[]> {
  if (token === DEMO_TOKEN) return []
  // The Repository type has no "branches" field — branches are refs under
  // refs/heads/. RefOrder doesn't expose a commit-date sort either, so we
  // pull alphabetically and sort by the underlying commit date client-side.
  const data = await gql<{
    repository: {
      refs: {
        nodes: {
          name: string
          target: {
            committedDate?: string
            messageHeadline?: string
            author?: { user: { login: string; avatarUrl: string } | null } | null
          } | null
        }[]
      } | null
    }
  }>(
    token,
    `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        refs(refPrefix: "refs/heads/", first: 100, orderBy: { field: ALPHABETICAL, direction: ASC }) {
          nodes {
            name
            target {
              ... on Commit {
                committedDate
                messageHeadline
                author { user { login avatarUrl } }
              }
            }
          }
        }
      }
    }
  `,
    { owner, name }
  )
  const nodes = data.repository.refs?.nodes ?? []
  return nodes
    .flatMap((n) => {
      const t = n.target
      if (!t || !t.committedDate) return []
      return [{
        name: n.name,
        target: {
          committedDate: t.committedDate,
          messageHeadline: t.messageHeadline ?? '',
          author: t.author ?? null
        }
      }]
    })
    .toSorted((a, b) => new Date(b.target.committedDate).getTime() - new Date(a.target.committedDate).getTime())
}

export type RepoCommitActivity = {
  nameWithOwner: string
  /** Default-branch commit timestamps (ms) since the window start, newest first. */
  commitTimes: number[]
}

/**
 * Default-branch commit timestamps for up to ~10 repos in ONE aliased GraphQL
 * query — powers the Digest sparklines without per-repo request fan-out.
 */
export async function fetchReposCommitActivity(
  token: string,
  targets: { owner: string; name: string }[],
  sinceIso: string
): Promise<RepoCommitActivity[]> {
  if (token === DEMO_TOKEN || targets.length === 0) {
    // Deterministic demo shape: a gentle pseudo-activity curve per repo.
    return targets.map((t, i) => ({
      nameWithOwner: `${t.owner}/${t.name}`,
      commitTimes: Array.from({ length: 6 + (i % 5) * 3 }, (_, k) =>
        Date.now() - ((k * 37 + i * 13) % 96) * 3600_000),
    }))
  }
  const aliases = targets.map((t, i) =>
    `r${i}: repository(owner: ${JSON.stringify(t.owner)}, name: ${JSON.stringify(t.name)}) {
      nameWithOwner
      defaultBranchRef { target { ... on Commit { history(first: 100, since: $since) { nodes { committedDate } } } } }
    }`
  ).join('\n')
  type AliasRepo = {
    nameWithOwner: string
    defaultBranchRef: { target: { history?: { nodes: { committedDate: string }[] } } | null } | null
  } | null
  const data = await gql<Record<string, AliasRepo>>(
    token,
    `query($since: GitTimestamp!) {\n${aliases}\n}`,
    { since: sinceIso }
  )
  return targets.map((t, i) => {
    const node = data[`r${i}`]
    const commits = node?.defaultBranchRef?.target?.history?.nodes ?? []
    return {
      nameWithOwner: node?.nameWithOwner ?? `${t.owner}/${t.name}`,
      commitTimes: commits.map((c) => new Date(c.committedDate).getTime()),
    }
  })
}
