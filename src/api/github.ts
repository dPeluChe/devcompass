const GH_GRAPHQL = 'https://api.github.com/graphql'

export type RepoOpenPR = {
  id: string
  number: number
  title: string
  url: string
  updatedAt: string
  isDraft: boolean
  author: { login: string; avatarUrl: string } | null
  /** Last commit's status check rollup state — drives row-level "CI failing" chips on Home. */
  ciState?: string | null
}

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
  openPRs: { totalCount: number; nodes?: RepoOpenPR[] }
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

async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 2000
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(GH_GRAPHQL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      })
      
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub API ${res.status}: ${text}`)
      }
      
      const json = await res.json()
      if (json.errors) {
        throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '))
      }
      return json.data as T
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`GraphQL attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY}ms...`, lastError.message)
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      }
    }
  }
  throw lastError || new Error('Unknown error')
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

  // Sync orgs in parallel — each org is independent. Map.set is safe from any one
  // microtask at a time; later writes overwrite earlier ones for the same repo id,
  // which is fine because they carry the same data.
  await Promise.all(
    viewer.organizations.nodes.map(async (org) => {
      try {
        const orgRepos = await paginate(
          (after) => fetchOrgReposPage(token, org.login, after),
          (n) => onProgress?.({ kind: 'org', login: org.login, count: n })
        )
        for (const r of orgRepos) byId.set(r.id, r)
      } catch (e) {
        errors.push({ source: `org:${org.login}`, message: e instanceof Error ? e.message : String(e) })
      }
    })
  )

  const repos = Array.from(byId.values()).toSorted(
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
    scopes: scopesHeader ? scopesHeader.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : [] }) : [],
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
  repository: {
    nameWithOwner: string
    url: string
    isPrivate: boolean
    owner: { login: string; avatarUrl: string }
  }
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
            repository {
              nameWithOwner
              url
              isPrivate
              owner { login avatarUrl }
            }
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
  return data.search.nodes.flatMap((n) =>
    n && n.id
      ? [{ ...(n as RawPR), ciState: (n as RawPR).commits.nodes[0]?.commit.statusCheckRollup?.state ?? null }]
      : []
  )
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
      checkSuite: { workflowRun: { databaseId: number | null; workflow: { name: string } } | null } | null
    }
  | { __typename: 'StatusContext'; context: string; state: string; targetUrl: string | null }

export type PRCommit = {
  oid: string
  abbreviatedOid: string
  url: string
  messageHeadline: string
  messageBody: string
  committedDate: string
  authoredDate: string
  author: {
    name: string | null
    email: string | null
    user: { login: string; avatarUrl: string } | null
  } | null
}

export type PRDetail = {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  bodyHTML: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  mergeStateStatus: string
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  viewerCanUpdate: boolean
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
  commits: { totalCount: number; nodes: PRCommit[] }
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
      pullRequest: Omit<PRDetail, 'ciState' | 'checks' | 'commits'> & {
        commits: {
          totalCount: number
          nodes: {
            commit: PRCommit & {
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
          reviewDecision
          viewerCanUpdate
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
          commits(last: 100) {
            totalCount
            nodes {
              commit {
                oid
                abbreviatedOid
                url
                messageHeadline
                messageBody
                committedDate
                authoredDate
                author {
                  name
                  email
                  user { login avatarUrl }
                }
                statusCheckRollup {
                  state
                  contexts(first: 30) {
                    nodes {
                      __typename
                      ... on CheckRun {
                        name conclusion status detailsUrl
                        checkSuite { workflowRun { databaseId workflow { name } } }
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
  // PullRequest.commits with `last: N` returns ancestor → descendant order, so
  // the HEAD (most recent) is the last node. The status rollup lives there.
  const head = pr.commits.nodes[pr.commits.nodes.length - 1]?.commit
  const rollup = head?.statusCheckRollup ?? null
  // Strip statusCheckRollup off each commit before exposing as PRCommit.
  const commitNodes: PRCommit[] = pr.commits.nodes.map((n) => {
    const { statusCheckRollup: _, ...rest } = n.commit
    return rest
  })
  return {
    ...pr,
    commits: { totalCount: pr.commits.totalCount, nodes: commitNodes },
    ciState: rollup?.state ?? null,
    checks: rollup?.contexts.nodes ?? []
  }
}

// ---------- Mutations (REST) ----------

/**
 * Calls the GitHub REST API. Throws with the response message on non-2xx so the
 * caller can show it inline. Centralizes auth + content-type + body handling so
 * the action helpers below stay one-liners.
 */
async function rest(token: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body == null ? undefined : JSON.stringify(body)
  })
  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = (j && (j.message ?? j.error)) ? `: ${j.message ?? j.error}` : ''
    } catch {
      detail = `: ${await res.text().catch(() => '')}`
    }
    throw new Error(`GitHub ${res.status}${detail}`)
  }
  if (res.status === 204) return null
  return res.json().catch(() => null)
}

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

/** Submits a PR review. body is required for REQUEST_CHANGES and COMMENT. */
export async function submitReview(
  token: string,
  owner: string,
  name: string,
  number: number,
  event: ReviewEvent,
  body?: string
): Promise<void> {
  await rest(token, 'POST', `/repos/${owner}/${name}/pulls/${number}/reviews`, {
    event,
    body: body ?? ''
  })
}

/** Posts an issue-level comment on the PR (the same endpoint used by GitHub's "Comment" button). */
export async function addIssueComment(token: string, owner: string, name: string, number: number, body: string): Promise<void> {
  await rest(token, 'POST', `/repos/${owner}/${name}/issues/${number}/comments`, { body })
}

/** Re-runs only the failed jobs of a workflow run. Cheaper than re-running everything. */
export async function rerunFailedJobs(token: string, owner: string, name: string, runId: number): Promise<void> {
  await rest(token, 'POST', `/repos/${owner}/${name}/actions/runs/${runId}/rerun-failed-jobs`)
}

export type MergeMethod = 'merge' | 'squash' | 'rebase'

/**
 * Merges a pull request using the chosen method. GitHub returns 405 if the PR
 * isn't mergeable yet (failing checks, missing approval, conflicts). Caller
 * should surface the error message inline.
 */
export async function mergePullRequest(
  token: string,
  owner: string,
  name: string,
  number: number,
  method: MergeMethod,
  options?: { commit_title?: string; commit_message?: string; sha?: string }
): Promise<void> {
  await rest(token, 'PUT', `/repos/${owner}/${name}/pulls/${number}/merge`, {
    merge_method: method,
    ...(options ?? {})
  })
}

export type WorkflowJob = {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed' | 'waiting'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null
  html_url: string
  started_at: string | null
  completed_at: string | null
}

/** Lists jobs in a workflow run. Used to map a CheckRun.name to a job_id so we can fetch its logs. */
export async function fetchWorkflowRunJobs(token: string, owner: string, name: string, runId: number): Promise<WorkflowJob[]> {
  const data = await rest(token, 'GET', `/repos/${owner}/${name}/actions/runs/${runId}/jobs?per_page=100`) as { jobs: WorkflowJob[] }
  return data.jobs ?? []
}

/**
 * Returns the raw log text for a job. The endpoint 302s to a short-lived presigned
 * URL — we let the browser follow it transparently. Logs can be huge (megabytes),
 * so callers should truncate before rendering.
 */
export async function fetchJobLogs(token: string, owner: string, name: string, jobId: number): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/actions/jobs/${jobId}/logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} fetching logs`)
  return res.text()
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
              history(first: 50) {
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

export type Branch = {
  name: string
  target: {
    committedDate: string
    messageHeadline: string
    author: { user: { login: string; avatarUrl: string } | null } | null
  }
}

export async function fetchBranches(token: string, owner: string, name: string): Promise<Branch[]> {
  const data = await gql<{
    repository: {
      branches: {
        nodes: {
          name: string
          target: {
            committedDate: string
            messageHeadline: string
            author: { user: { login: string; avatarUrl: string } | null } | null
          }
        }[]
      }
    }
  }>(
    token,
    `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        branches(first: 100, orderBy: { field: COMMIT_DATE, direction: DESC }) {
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
  return data.repository.branches.nodes
}
