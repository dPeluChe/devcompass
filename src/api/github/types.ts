// Public types for the GitHub API layer. Re-exported wholesale by the barrel.

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

export type ContribDay = {
  /** ISO date, e.g. "2026-05-13" */
  date: string
  contributionCount: number
  /** Hex color GitHub computed for this day (e.g. "#9be9a8"). Empty cells use "#ebedf0". */
  color: string
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
}

export type ContribCalendar = {
  totalContributions: number
  /** Always 53 weeks × ≤7 days. First/last weeks may be partial. */
  weeks: { contributionDays: ContribDay[]; firstDay: string }[]
}

export type TokenInfo = {
  /** "classic" if X-OAuth-Scopes header present, "fine-grained" otherwise. */
  type: 'classic' | 'fine-grained' | 'unknown'
  /** Scopes for classic tokens. Empty for fine-grained (per-resource permissions). */
  scopes: string[]
  /** SSO orgs that require token authorization. Pulled from X-GitHub-SSO header. */
  ssoRequired: { url: string; orgIds: string[] } | null
  /** ISO expiration date from GitHub-Authentication-Token-Expiration header. Null = no expiry or not reported. */
  expiresAt: string | null
}

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
  /** Head branch the PR is built from (e.g. "feat/foo"). */
  headRefName?: string
  /** Base branch the PR targets (e.g. "main"). */
  baseRefName?: string
}

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

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'

export type MergeMethod = 'merge' | 'squash' | 'rebase'

export type WorkflowJob = {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed' | 'waiting'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null
  html_url: string
  started_at: string | null
  completed_at: string | null
}

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
              associatedPullRequests: { nodes: { number: number; headRefName: string }[] }
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
      state: 'OPEN' | 'CLOSED' | 'MERGED'
      isDraft: boolean
      createdAt: string
      updatedAt: string
      mergedAt: string | null
      closedAt: string | null
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

export type Branch = {
  name: string
  target: {
    committedDate: string
    messageHeadline: string
    author: { user: { login: string; avatarUrl: string } | null } | null
  }
}
