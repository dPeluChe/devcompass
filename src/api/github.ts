const GH_GRAPHQL = 'https://api.github.com/graphql'

export type Repo = {
  id: string
  name: string
  nameWithOwner: string
  url: string
  description: string | null
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  stargazerCount: number
  pushedAt: string
  updatedAt: string
  primaryLanguage: { name: string; color: string | null } | null
  owner: { login: string; avatarUrl: string }
  defaultBranchRef: { name: string } | null
  openPRs: { totalCount: number }
  openIssues: { totalCount: number }
}

export type Org = { login: string; avatarUrl: string; url: string }

export type Viewer = {
  login: string
  name: string | null
  avatarUrl: string
  url: string
  organizations: { nodes: Org[] }
}

export type RateLimit = {
  remaining: number
  limit: number
  resetAt: string
}

export type ProgressEvent =
  | { kind: 'viewer'; count: number }
  | { kind: 'org'; login: string; count: number }
  | { kind: 'done'; total: number }

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
  openPRs: pullRequests(states: OPEN) { totalCount }
  openIssues: issues(states: OPEN) { totalCount }
`

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  }
  const json = await res.json()
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '))
  }
  return json.data as T
}

export async function fetchViewer(token: string): Promise<Viewer> {
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

async function fetchViewerReposPage(token: string, after: string | null): Promise<Page> {
  const data = await gql<{ viewer: { repositories: Page } }>(
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
  return data.viewer.repositories
}

async function fetchOrgReposPage(token: string, login: string, after: string | null): Promise<Page> {
  const data = await gql<{ organization: { repositories: Page } | null }>(
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
  return data.organization?.repositories ?? { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }
}

async function paginate(fetchPage: (after: string | null) => Promise<Page>, onPage?: (n: number) => void): Promise<Repo[]> {
  const all: Repo[] = []
  let after: string | null = null
  for (;;) {
    const page = await fetchPage(after)
    all.push(...page.nodes)
    onPage?.(all.length)
    if (!page.pageInfo.hasNextPage) break
    after = page.pageInfo.endCursor
  }
  return all
}

/**
 * Aggregates repos from the viewer + every org the viewer belongs to.
 * Dedupes by repo id (a repo can appear via both viewer and org).
 */
export async function fetchAllRepos(
  token: string,
  viewer: Viewer,
  onProgress?: (e: ProgressEvent) => void
): Promise<{ repos: Repo[]; errors: { source: string; message: string }[] }> {
  const byId = new Map<string, Repo>()
  const errors: { source: string; message: string }[] = []

  try {
    const viewerRepos = await paginate(
      (after) => fetchViewerReposPage(token, after),
      (n) => onProgress?.({ kind: 'viewer', count: n })
    )
    for (const r of viewerRepos) byId.set(r.id, r)
  } catch (e) {
    errors.push({ source: 'viewer', message: e instanceof Error ? e.message : String(e) })
  }

  for (const org of viewer.organizations.nodes) {
    try {
      const orgRepos = await paginate(
        (after) => fetchOrgReposPage(token, org.login, after),
        (n) => onProgress?.({ kind: 'org', login: org.login, count: n })
      )
      for (const r of orgRepos) byId.set(r.id, r)
    } catch (e) {
      errors.push({ source: `org:${org.login}`, message: e instanceof Error ? e.message : String(e) })
    }
  }

  const repos = [...byId.values()].sort(
    (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
  )
  onProgress?.({ kind: 'done', total: repos.length })
  return { repos, errors }
}

export async function fetchRateLimit(token: string): Promise<RateLimit> {
  const data = await gql<{ rateLimit: RateLimit }>(token, `query { rateLimit { remaining limit resetAt } }`)
  return data.rateLimit
}

export type TokenInfo = {
  /** "classic" if X-OAuth-Scopes header present, "fine-grained" otherwise. */
  type: 'classic' | 'fine-grained' | 'unknown'
  /** Scopes for classic tokens. Empty for fine-grained (per-resource permissions). */
  scopes: string[]
  /** SSO orgs that require token authorization. Pulled from X-GitHub-SSO header. */
  ssoRequired: { url: string; orgIds: string[] } | null
}

/**
 * Probes /user via REST to read auth-related response headers. GraphQL doesn't
 * expose token scopes, so a single REST hop is the cheapest way to see what the
 * token can actually do — and crucially, whether SSO authorization is missing.
 */
export async function fetchTokenInfo(token: string): Promise<TokenInfo> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  const scopesHeader = res.headers.get('X-OAuth-Scopes')
  const ssoHeader = res.headers.get('X-GitHub-SSO')
  let sso: TokenInfo['ssoRequired'] = null
  if (ssoHeader) {
    // Format: "required; url=https://github.com/orgs/.../sso?...; partial-results"
    // or:    "partial-results; organizations=12345,67890"
    const urlMatch = ssoHeader.match(/url=([^;]+)/)
    const orgsMatch = ssoHeader.match(/organizations=([^;]+)/)
    sso = {
      url: urlMatch?.[1]?.trim() ?? 'https://github.com/settings/tokens',
      orgIds: orgsMatch?.[1]?.split(',').map((s) => s.trim()) ?? []
    }
  }
  return {
    type: scopesHeader === null ? 'fine-grained' : scopesHeader === '' ? 'unknown' : 'classic',
    scopes: scopesHeader ? scopesHeader.split(',').map((s) => s.trim()).filter(Boolean) : [],
    ssoRequired: sso
  }
}

// ---------- PR search (cross-repo inbox) ----------

export type PullRequest = {
  id: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  createdAt: string
  updatedAt: string
  author: { login: string; avatarUrl: string } | null
  repository: { nameWithOwner: string; url: string; isPrivate: boolean }
  labels: { nodes: { name: string; color: string }[] }
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  comments: { totalCount: number }
  additions: number
  deletions: number
  changedFiles: number
  ciState: string | null
}

type RawPR = Omit<PullRequest, 'ciState'> & {
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}

export async function searchPRs(token: string, query: string, first = 50): Promise<PullRequest[]> {
  const data = await gql<{ search: { nodes: RawPR[] } }>(
    token,
    `
    query($q: String!, $first: Int!) {
      search(query: $q, type: ISSUE, first: $first) {
        issueCount
        nodes {
          ... on PullRequest {
            id
            number
            title
            url
            state
            isDraft
            createdAt
            updatedAt
            author { login avatarUrl }
            repository { nameWithOwner url isPrivate }
            labels(first: 8) { nodes { name color } }
            reviewDecision
            comments { totalCount }
            additions
            deletions
            changedFiles
            commits(last: 1) {
              nodes { commit { statusCheckRollup { state } } }
            }
          }
        }
      }
    }
  `,
    { q: query, first }
  )
  return data.search.nodes
    .filter((n): n is RawPR => !!n && !!n.id)
    .map((n) => ({
      ...n,
      ciState: n.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null
    }))
}

// ---------- PR detail (single PR, rich) ----------

export type FileChange = {
  path: string
  additions: number
  deletions: number
  changeType: 'ADDED' | 'MODIFIED' | 'DELETED' | 'RENAMED' | 'COPIED' | 'CHANGED'
}

export type Review = {
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  bodyHTML: string
  submittedAt: string | null
  author: { login: string; avatarUrl: string } | null
}

export type Comment = {
  bodyHTML: string
  createdAt: string
  author: { login: string; avatarUrl: string } | null
}

export type CheckContext =
  | {
      __typename: 'CheckRun'
      name: string
      conclusion: string | null
      status: string
      detailsUrl: string | null
      checkSuite: { workflowRun: { workflow: { name: string } } | null } | null
    }
  | { __typename: 'StatusContext'; context: string; state: string; targetUrl: string | null }

export type PRDetail = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  bodyHTML: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  mergeStateStatus: string
  createdAt: string
  updatedAt: string
  author: { login: string; avatarUrl: string; url: string } | null
  baseRefName: string
  headRefName: string
  additions: number
  deletions: number
  changedFiles: number
  repository: { nameWithOwner: string; url: string }
  labels: { nodes: { name: string; color: string }[] }
  assignees: { nodes: { login: string; avatarUrl: string }[] }
  reviewRequests: {
    nodes: {
      requestedReviewer:
        | { __typename: 'User'; login: string; avatarUrl: string }
        | { __typename: 'Team'; name: string; avatarUrl: string }
        | null
    }[]
  }
  reviews: { nodes: Review[] }
  comments: { nodes: Comment[] }
  files: { nodes: FileChange[] }
  ciState: string | null
  checks: CheckContext[]
}

export async function fetchPullRequestDetail(
  token: string,
  owner: string,
  name: string,
  number: number
): Promise<PRDetail> {
  const data = await gql<{
    repository: {
      pullRequest: Omit<PRDetail, 'ciState' | 'checks'> & {
        commits: {
          nodes: {
            commit: {
              statusCheckRollup: {
                state: string
                contexts: { nodes: CheckContext[] }
              } | null
            }
          }[]
        }
      }
    }
  }>(
    token,
    `
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          number
          title
          url
          state
          isDraft
          bodyHTML
          mergeable
          mergeStateStatus
          createdAt
          updatedAt
          author { login avatarUrl url }
          baseRefName
          headRefName
          additions
          deletions
          changedFiles
          repository { nameWithOwner url }
          labels(first: 20) { nodes { name color } }
          assignees(first: 10) { nodes { login avatarUrl } }
          reviewRequests(first: 10) {
            nodes {
              requestedReviewer {
                __typename
                ... on User { login avatarUrl }
                ... on Team { name avatarUrl }
              }
            }
          }
          reviews(first: 30) {
            nodes {
              state
              bodyHTML
              submittedAt
              author { login avatarUrl }
            }
          }
          comments(first: 30) {
            nodes {
              bodyHTML
              createdAt
              author { login avatarUrl }
            }
          }
          files(first: 100) {
            nodes { path additions deletions changeType }
          }
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                  contexts(first: 30) {
                    nodes {
                      __typename
                      ... on CheckRun {
                        name conclusion status detailsUrl
                        checkSuite { workflowRun { workflow { name } } }
                      }
                      ... on StatusContext {
                        context state targetUrl
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `,
    { owner, name, number }
  )
  const pr = data.repository.pullRequest
  const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup ?? null
  return {
    ...pr,
    ciState: rollup?.state ?? null,
    checks: rollup?.contexts.nodes ?? []
  }
}

/**
 * Lists orgs the authenticated user belongs to via REST. Sometimes returns more
 * than `viewer.organizations` (the GraphQL field is stricter about visibility).
 */
export async function fetchUserOrgsRest(token: string): Promise<{ login: string; avatar_url: string; url: string }[]> {
  const res = await fetch('https://api.github.com/user/orgs?per_page=100', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---------- Repo detail (rich query — used to explore what to surface) ----------

export type RepoDetail = {
  id: string
  nameWithOwner: string
  url: string
  description: string | null
  homepageUrl: string | null
  isPrivate: boolean
  isArchived: boolean
  isFork: boolean
  isTemplate: boolean
  diskUsage: number | null
  forkCount: number
  stargazerCount: number
  watchers: { totalCount: number }
  createdAt: string
  pushedAt: string
  updatedAt: string
  licenseInfo: { name: string; spdxId: string | null } | null
  primaryLanguage: { name: string; color: string | null } | null
  owner: { login: string; avatarUrl: string; url: string }
  defaultBranchRef: {
    name: string
    target:
      | {
          __typename: 'Commit'
          oid: string
          history: {
            totalCount: number
            nodes: {
              oid: string
              messageHeadline: string
              committedDate: string
              url: string
              author: { name: string | null; user: { login: string; avatarUrl: string } | null } | null
            }[]
          }
          statusCheckRollup: { state: string } | null
        }
      | { __typename: string }
      | null
  } | null
  repositoryTopics: { nodes: { topic: { name: string } }[] }
  languages: {
    totalSize: number
    edges: { size: number; node: { name: string; color: string | null } }[]
  }
  pullRequests: {
    totalCount: number
    nodes: {
      number: number
      title: string
      url: string
      isDraft: boolean
      createdAt: string
      updatedAt: string
      author: { login: string; avatarUrl: string } | null
    }[]
  }
  issues: {
    totalCount: number
    nodes: {
      number: number
      title: string
      url: string
      createdAt: string
      updatedAt: string
      author: { login: string; avatarUrl: string } | null
      labels: { nodes: { name: string; color: string }[] }
    }[]
  }
  releases: {
    totalCount: number
    nodes: { tagName: string; name: string | null; publishedAt: string | null; url: string; isPrerelease: boolean }[]
  }
  mentionableUsers: { totalCount: number }
}

export async function fetchRepoDetail(token: string, owner: string, name: string): Promise<RepoDetail> {
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
              history(first: 10) {
                totalCount
                nodes {
                  oid
                  messageHeadline
                  committedDate
                  url
                  author { name user { login avatarUrl } }
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
        pullRequests(first: 10, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
          totalCount
          nodes {
            number title url isDraft createdAt updatedAt
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
