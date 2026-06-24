import type {
  RepoOpenPR, Repo, PullRequest, IssueSearchResult, GitHubNotification,
} from '../github'
import type { VercelDeployment } from '../vercel'

export const DEMO_TOKEN = '__demo__'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function ago(days: number, hours = 0): string {
  const ms = (days * 86400 + hours * 3600) * 1000
  return new Date(new Date('2026-05-15T14:00:00Z').getTime() - ms).toISOString()
}

export function ghAvatar(login: string): string {
  return `https://github.com/${login}.png`
}

export function pr(
  id: string,
  number: number,
  title: string,
  org: string,
  repo: string,
  authorLogin: string,
  updatedDaysAgo: number,
  isDraft = false,
  ciState: string | null = 'SUCCESS',
): RepoOpenPR {
  return {
    id,
    number,
    title,
    url: `https://github.com/${org}/${repo}/pull/${number}`,
    updatedAt: ago(updatedDaysAgo),
    isDraft,
    author: { login: authorLogin, avatarUrl: ghAvatar(authorLogin) },
    ciState,
  }
}

export function makeRepo(
  id: string,
  org: string,
  name: string,
  description: string,
  lang: { name: string; color: string } | null,
  stars: number,
  isPrivate: boolean,
  pushedDaysAgo: number,
  openPRNodes: RepoOpenPR[] = [],
  openIssues = 0,
  isFork = false,
): Repo {
  return {
    id,
    name,
    nameWithOwner: `${org}/${name}`,
    url: `https://github.com/${org}/${name}`,
    description,
    isPrivate,
    isArchived: false,
    isFork,
    stargazerCount: stars,
    pushedAt: ago(pushedDaysAgo),
    updatedAt: ago(pushedDaysAgo + 1),
    primaryLanguage: lang,
    owner: { login: org, avatarUrl: ghAvatar(org) },
    defaultBranchRef: { name: 'main' },
    openPRs: { totalCount: openPRNodes.length, nodes: openPRNodes },
    openIssues: { totalCount: openIssues },
  }
}

export const TS  = { name: 'TypeScript', color: '#3178c6' }
export const GO  = { name: 'Go',         color: '#00ADD8' }
export const RS  = { name: 'Rust',       color: '#dea584' }
export const PY  = { name: 'Python',     color: '#3572A5' }
export const PG  = { name: 'PLpgSQL',    color: '#336791' }

export function fullPR(
  id: string,
  number: number,
  title: string,
  org: string,
  repo: string,
  authorLogin: string,
  updatedDaysAgo: number,
  createdDaysAgo: number,
  opts: {
    isDraft?: boolean
    ciState?: string | null
    reviewDecision?: PullRequest['reviewDecision']
    labels?: { name: string; color: string }[]
    additions?: number
    deletions?: number
    changedFiles?: number
    comments?: number
    isPrivate?: boolean
    branch?: string
    base?: string
  } = {},
): PullRequest {
  return {
    id,
    number,
    title,
    url: `https://github.com/${org}/${repo}/pull/${number}`,
    state: 'OPEN',
    isDraft: opts.isDraft ?? false,
    headRefName: opts.branch ?? `${title.match(/^(\w+)/)?.[1] ?? 'pr'}/${number}`,
    baseRefName: opts.base ?? 'main',
    createdAt: ago(createdDaysAgo),
    updatedAt: ago(updatedDaysAgo),
    author: { login: authorLogin, avatarUrl: ghAvatar(authorLogin) },
    repository: {
      nameWithOwner: `${org}/${repo}`,
      url: `https://github.com/${org}/${repo}`,
      isPrivate: opts.isPrivate ?? false,
      owner: { login: org, avatarUrl: ghAvatar(org) },
    },
    labels: { nodes: opts.labels ?? [] },
    reviewDecision: opts.reviewDecision ?? null,
    comments: { totalCount: opts.comments ?? 0 },
    additions: opts.additions ?? 0,
    deletions: opts.deletions ?? 0,
    changedFiles: opts.changedFiles ?? 1,
    ciState: opts.ciState ?? 'SUCCESS',
  }
}

export function issue(
  id: string,
  number: number,
  title: string,
  org: string,
  repo: string,
  authorLogin: string,
  updatedDaysAgo: number,
  labels: { name: string; color: string }[] = [],
  comments = 0,
): IssueSearchResult {
  return {
    id,
    number,
    title,
    url: `https://github.com/${org}/${repo}/issues/${number}`,
    state: 'OPEN',
    createdAt: ago(updatedDaysAgo + 4),
    updatedAt: ago(updatedDaysAgo),
    author: { login: authorLogin, avatarUrl: ghAvatar(authorLogin) },
    repository: { nameWithOwner: `${org}/${repo}`, url: `https://github.com/${org}/${repo}`, owner: { login: org, avatarUrl: ghAvatar(org) } },
    labels: { nodes: labels },
    comments: { totalCount: comments },
  }
}

export function notif(
  id: string,
  reason: string,
  type: string,
  title: string,
  org: string,
  repo: string,
  webPath: string,
  updatedDaysAgo: number,
  hoursAgo = 0,
): GitHubNotification {
  return {
    id,
    reason,
    unread: true,
    updated_at: ago(updatedDaysAgo, hoursAgo),
    subject: {
      title,
      url: `https://api.github.com/repos/${org}/${repo}/${webPath}`,
      latest_comment_url: null,
      type,
    },
    repository: {
      full_name: `${org}/${repo}`,
      html_url: `https://github.com/${org}/${repo}`,
      owner: { login: org, avatar_url: ghAvatar(org) },
    },
  }
}

export function mergedPR(number: number, title: string, org: string, repo: string, mergedDaysAgo: number, openForHours: number) {
  const merged = new Date(new Date(ago(mergedDaysAgo)).getTime())
  return {
    number,
    title,
    url: `https://github.com/${org}/${repo}/pull/${number}`,
    createdAt: new Date(merged.getTime() - openForHours * 3600_000).toISOString(),
    mergedAt: merged.toISOString(),
    repository: { nameWithOwner: `${org}/${repo}` },
  }
}

export function deploy(
  uid: string, repo: string, state: VercelDeployment['state'], target: string | null,
  daysAgo: number, hoursAgo: number, sha: string, ref: string, msg: string, author: string,
): VercelDeployment {
  const [org, name] = repo.split('/')
  return {
    uid, name, url: `${name}-${uid.slice(-4)}.vercel.app`,
    created: new Date(ago(daysAgo, hoursAgo)).getTime(),
    state, target,
    creator: { username: author },
    inspectorUrl: `https://vercel.com/${org}/${name}/${uid}`,
    meta: { githubCommitSha: sha, githubCommitRef: ref, githubCommitMessage: msg, githubCommitAuthorName: author, githubCommitOrg: org, githubCommitRepo: name },
  }
}
