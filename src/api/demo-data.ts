import type {
  Viewer, Org, Repo, RepoOpenPR, PullRequest, ContribCalendar, ContribDay,
  TokenInfo, RateLimit, PRDetail, PRCommit, Review, Comment, FileChange
} from './github'

export const DEMO_TOKEN = '__demo__'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ago(days: number, hours = 0): string {
  const ms = (days * 86400 + hours * 3600) * 1000
  return new Date(new Date('2026-05-15T14:00:00Z').getTime() - ms).toISOString()
}

function ghAvatar(login: string): string {
  return `https://github.com/${login}.png`
}

// ---------------------------------------------------------------------------
// Orgs
// ---------------------------------------------------------------------------

const ORGS: Org[] = [
  { login: 'iteris',   avatarUrl: ghAvatar('iteris'),   url: 'https://github.com/iteris'   },
  { login: 'vercel',      avatarUrl: ghAvatar('vercel'),      url: 'https://github.com/vercel'      },
  { login: 'stripe',      avatarUrl: ghAvatar('stripe'),      url: 'https://github.com/stripe'      },
  { login: 'supabase',    avatarUrl: ghAvatar('supabase'),    url: 'https://github.com/supabase'    },
  { login: 'linear',      avatarUrl: ghAvatar('linear'),      url: 'https://github.com/linear'      },
  { login: 'planetscale', avatarUrl: ghAvatar('planetscale'), url: 'https://github.com/planetscale' },
]

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

export const DEMO_VIEWER: Viewer = {
  login: 'dPeluChe',
  name: 'dPeluChe',
  avatarUrl: ghAvatar('dPeluChe'),
  url: 'https://github.com/dPeluChe',
  organizations: { nodes: ORGS },
}

// ---------------------------------------------------------------------------
// Open PRs embedded in repos
// ---------------------------------------------------------------------------

function pr(
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

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

function makeRepo(
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

const TS  = { name: 'TypeScript', color: '#3178c6' }
const GO  = { name: 'Go',         color: '#00ADD8' }
const RS  = { name: 'Rust',       color: '#dea584' }
const PY  = { name: 'Python',     color: '#3572A5' }
const PG  = { name: 'PLpgSQL',    color: '#336791' }

export const DEMO_REPOS: Repo[] = [
  makeRepo('R000', 'dPeluChe', 'devcompass', 'GitHub command center — local-first, no backend', TS, 0, false, 0, [
    pr('P000a', 18, 'feat(demo): add interactive demo mode with static dataset', 'dPeluChe', 'devcompass', 'dPeluChe', 0, false, 'SUCCESS'),
    pr('P000b', 17, 'feat(landing): SEO pass + llms.txt + JSON-LD schema', 'dPeluChe', 'devcompass', 'dPeluChe', 1, false, 'SUCCESS'),
  ], 4),

  makeRepo('R00A', 'iteris', 'platform-api', 'Core REST API for the Iteris platform', TS, 0, true, 0, [
    pr('P00A1', 87, 'feat(auth): migrate from JWT HS256 to RS256 with key rotation', 'iteris', 'platform-api', 'dPeluChe', 0, false, 'SUCCESS'),
    pr('P00A2', 85, 'fix(rate-limiter): sliding window resets on distributed nodes', 'iteris', 'platform-api', 'carlosm', 2, false, 'FAILURE'),
  ], 11),

  makeRepo('R00B', 'iteris', 'web-app', 'Customer-facing React dashboard', TS, 0, true, 1, [
    pr('P00B1', 214, 'feat(dashboard): real-time metrics panel with WebSocket feed', 'iteris', 'web-app', 'sofiad', 1),
    pr('P00B2', 211, 'chore: upgrade to React 19 + drop legacy context API', 'iteris', 'web-app', 'dPeluChe', 3, true),
  ], 18),

  makeRepo('R00C', 'iteris', 'infra', 'Terraform modules and GitHub Actions workflows', GO, 0, true, 2, [], 6),

  makeRepo('R001', 'vercel', 'next.js', 'The React Framework for the Web', TS, 128_400, false, 0, [
    pr('P001', 4721, 'feat(app-router): support React 19 concurrent features', 'vercel', 'next.js', 'sebmarkbage', 0),
    pr('P002', 4718, 'fix(server-components): hydration mismatch on dynamic imports', 'vercel', 'next.js', 'timneutkens', 1),
    pr('P003', 4715, 'chore: upgrade to webpack 6 alpha', 'vercel', 'next.js', 'devjoe', 2, true),
  ], 1842),

  makeRepo('R002', 'vercel', 'swr', 'React Hooks for Data Fetching', TS, 29_800, false, 1, [
    pr('P010', 2231, 'feat: add optimistic mutation with rollback support', 'vercel', 'swr', 'yixuanchen', 1),
    pr('P011', 2228, 'fix: infinite loop when key returns undefined', 'vercel', 'swr', 'priyak', 3),
  ], 412),

  makeRepo('R003', 'vercel', 'turborepo', 'High-performance monorepo build system for JS/TS', RS, 24_100, false, 2, [
    pr('P020', 1843, 'feat: remote cache authentication via OIDC tokens', 'vercel', 'turborepo', 'nicolo-r', 2),
  ], 289),

  makeRepo('R004', 'vercel', 'ai', 'Build AI-powered streaming UIs with React, Svelte, and Vue', TS, 12_600, false, 0, [
    pr('P030', 432, 'fix: streaming timeout on slow network connections', 'vercel', 'ai', 'dPeluChe', 0, false, 'FAILURE'),
    pr('P031', 428, 'feat: add Google Gemini provider', 'vercel', 'ai', 'mmarchand', 1),
  ], 178),

  makeRepo('R005', 'stripe', 'stripe-js', 'Stripe.js loading utility', TS, 1_840, false, 3, [
    pr('P040', 312, 'fix: race condition in Elements mount on slow connections', 'stripe', 'stripe-js', 'lchavez', 3),
  ], 67),

  makeRepo('R006', 'stripe', 'stripe-node', 'Node.js library for the Stripe API', TS, 8_420, false, 1, [
    pr('P050', 1892, 'feat: add PaymentIntent.incrementalAuthorization support', 'stripe', 'stripe-node', 'dPeluChe', 0),
    pr('P051', 1889, 'fix: retry logic ignores 429 Retry-After header', 'stripe', 'stripe-node', 'dkwan', 2),
  ], 203),

  makeRepo('R007', 'stripe', 'react-stripe-js', 'React components for Stripe.js and Stripe Elements', TS, 2_130, false, 4, [], 54),

  makeRepo('R008', 'supabase', 'supabase', 'The open source Firebase alternative', TS, 62_300, false, 0, [
    pr('P060', 8342, 'fix(realtime): reconnection backoff exceeds 30 s limit', 'supabase', 'supabase', 'sujay-r', 1),
    pr('P061', 8339, 'feat(storage): resumable upload progress events', 'supabase', 'supabase', 'w-mitsuda', 2),
    pr('P062', 8331, 'docs: update self-hosting guide for Docker Compose v2', 'supabase', 'supabase', 'abubakar-m', 5),
  ], 3847),

  makeRepo('R009', 'supabase', 'auth', 'A JWT based API for managing users and issuing JWT tokens', GO, 3_410, false, 2, [
    pr('P070', 891, 'fix: JWT expiry calculation off by one for leap years', 'supabase', 'auth', 'fnando', 1),
  ], 211),

  makeRepo('R010', 'supabase', 'postgres', 'Unmodified Postgres with useful extensions pre-installed', PG, 0, true, 5, [], 18),

  makeRepo('R011', 'linear', 'linear', 'The Linear App', TS, 0, true, 0, [
    pr('P080', 2103, 'refactor(editor): extract BlockEditor to standalone package', 'linear', 'linear', 'emilwidlund', 1),
    pr('P081', 2099, 'feat(triage): keyboard-driven bulk assignment shortcuts', 'linear', 'linear', 'tuomas-v', 2, true),
  ], 94),

  makeRepo('R012', 'linear', 'linear-sdk', 'Linear API SDK for Node.js and the browser', TS, 1_240, false, 6, [], 38),

  makeRepo('R013', 'planetscale', 'cli', 'Your PlanetScale CLI', GO, 2_920, false, 3, [
    pr('P090', 334, 'feat: add backup export format options (csv, parquet)', 'planetscale', 'cli', 'dPeluChe', 45, false, 'SUCCESS'),
  ], 124),

  makeRepo('R014', 'planetscale', 'database-js', 'The PlanetScale serverless driver for JavaScript', TS, 1_530, false, 4, [], 47),

  makeRepo('R015', 'dPeluChe', 'devtools', 'Personal dev tooling and automation scripts', TS, 0, true, 1, [
    pr('P100', 14, 'feat: add git-smart alias for contextual branch names', 'dPeluChe', 'devtools', 'dPeluChe', 1),
  ], 3),

  makeRepo('R016', 'dPeluChe', 'obsidian-plugins', 'A collection of Obsidian plugins for developers', TS, 843, false, 7, [], 22),

  makeRepo('R017', 'vercel', 'serve', 'Static file serving and SPA support', GO, 9_800, false, 12, [], 88, false),

  makeRepo('R018', 'stripe', 'stripe-go', 'Go library for the Stripe API', GO, 2_080, false, 8, [
    pr('P110', 892, 'chore: regenerate from OpenAPI spec 2026-04', 'stripe', 'stripe-go', 'jcollins-s', 5),
  ], 71),

  makeRepo('R019', 'supabase', 'realtime', 'Postgres change-data-capture over WebSockets', PY, 6_240, false, 1, [], 156),

  makeRepo('R020', 'planetscale', 'vitess', 'MySQL-compatible distributed database (fork)', GO, 18_300, false, 0, [], 432, true),
]

// ---------------------------------------------------------------------------
// Inbox PRs (for searchPRs)
// ---------------------------------------------------------------------------

function fullPR(
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
  } = {},
): PullRequest {
  return {
    id,
    number,
    title,
    url: `https://github.com/${org}/${repo}/pull/${number}`,
    state: 'OPEN',
    isDraft: opts.isDraft ?? false,
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

export const DEMO_PRS_REVIEW_REQUESTED: PullRequest[] = [
  fullPR('P001', 4721, 'feat(app-router): support React 19 concurrent features', 'vercel', 'next.js', 'sebmarkbage', 0, 5, {
    labels: [{ name: 'enhancement', color: '84b6eb' }],
    reviewDecision: 'REVIEW_REQUIRED',
    additions: 1482, deletions: 340, changedFiles: 23, comments: 8,
  }),
  fullPR('P060', 8342, 'fix(realtime): reconnection backoff exceeds 30 s limit', 'supabase', 'supabase', 'sujay-r', 1, 3, {
    labels: [{ name: 'bug', color: 'd73a4a' }, { name: 'performance', color: 'e4e669' }],
    reviewDecision: 'REVIEW_REQUIRED',
    additions: 87, deletions: 42, changedFiles: 4, comments: 3,
  }),
  fullPR('P080', 2103, 'refactor(editor): extract BlockEditor to standalone package', 'linear', 'linear', 'emilwidlund', 1, 7, {
    isPrivate: true,
    reviewDecision: 'REVIEW_REQUIRED',
    additions: 2314, deletions: 1893, changedFiles: 61, comments: 14,
  }),
]

export const DEMO_PRS_AUTHORED: PullRequest[] = [
  fullPR('P000a', 18, 'feat(demo): add interactive demo mode with static dataset', 'dPeluChe', 'devcompass', 'dPeluChe', 0, 1, {
    reviewDecision: 'REVIEW_REQUIRED',
    labels: [{ name: 'feature', color: '84b6eb' }],
    additions: 892, deletions: 31, changedFiles: 12, comments: 0,
  }),
  fullPR('P030', 432, 'fix: streaming timeout on slow network connections', 'vercel', 'ai', 'dPeluChe', 0, 2, {
    ciState: 'FAILURE',
    reviewDecision: 'REVIEW_REQUIRED',
    labels: [{ name: 'bug', color: 'd73a4a' }],
    additions: 56, deletions: 12, changedFiles: 3, comments: 1,
  }),
  fullPR('P050', 1892, 'feat: add PaymentIntent.incrementalAuthorization support', 'stripe', 'stripe-node', 'dPeluChe', 0, 4, {
    reviewDecision: 'REVIEW_REQUIRED',
    labels: [{ name: 'feature', color: '84b6eb' }],
    additions: 312, deletions: 18, changedFiles: 9, comments: 5,
  }),
  fullPR('P100', 14, 'feat: add git-smart alias for contextual branch names', 'dPeluChe', 'devtools', 'dPeluChe', 1, 3, {
    isPrivate: true,
    reviewDecision: null,
    additions: 143, deletions: 22, changedFiles: 5,
  }),
]

export const DEMO_PRS_MENTIONED: PullRequest[] = [
  fullPR('P070', 891, 'fix: JWT expiry calculation off by one for leap years', 'supabase', 'auth', 'fnando', 1, 6, {
    labels: [{ name: 'bug', color: 'd73a4a' }],
    reviewDecision: 'APPROVED',
    additions: 24, deletions: 8, changedFiles: 2, comments: 7,
  }),
  fullPR('P031', 428, 'feat: add Google Gemini provider', 'vercel', 'ai', 'mmarchand', 1, 8, {
    labels: [{ name: 'enhancement', color: '84b6eb' }],
    reviewDecision: 'REVIEW_REQUIRED',
    additions: 892, deletions: 41, changedFiles: 18, comments: 4,
  }),
]

export const DEMO_PRS_ASSIGNED: PullRequest[] = [
  fullPR('P090', 334, 'feat: add backup export format options (csv, parquet)', 'planetscale', 'cli', 'dPeluChe', 45, 60, {
    ciState: 'SUCCESS',
    reviewDecision: null,
    labels: [{ name: 'enhancement', color: '84b6eb' }],
    additions: 487, deletions: 23, changedFiles: 11, comments: 2,
  }),
]

// ---------------------------------------------------------------------------
// Token info & rate limit
// ---------------------------------------------------------------------------

export const DEMO_TOKEN_INFO: TokenInfo = {
  type: 'classic',
  scopes: ['repo', 'read:org'],
  ssoRequired: null,
  expiresAt: null,
}

export const DEMO_RATE_LIMIT: RateLimit = {
  remaining: 4987,
  limit: 5000,
  resetAt: '2026-05-15T15:00:00Z',
}

// ---------------------------------------------------------------------------
// Contribution calendar (53 weeks ending 2026-05-15)
// ---------------------------------------------------------------------------

function makeCalendar(): ContribCalendar {
  // Calendar starts on the Sunday of the week that contains (today − 52 full weeks)
  const startDate = new Date('2025-05-04T00:00:00Z') // Sunday
  const endDate   = new Date('2026-05-15T00:00:00Z') // Friday

  const weeks: ContribCalendar['weeks'] = []
  let total = 0

  for (let w = 0; w < 53; w++) {
    const days: ContribDay[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate)
      date.setUTCDate(startDate.getUTCDate() + w * 7 + d)
      if (date > endDate) break

      const weekday = date.getUTCDay()
      const isWeekend = weekday === 0 || weekday === 6
      // Deterministic pseudo-random via sin
      const s1 = Math.sin(w * 17.3 + d * 31.7) * 0.5 + 0.5
      const s2 = Math.sin(w * 7.1  + d * 11.3 + 3.7) * 0.5 + 0.5
      const threshold = isWeekend ? 0.82 : 0.38
      const count = s1 > threshold ? Math.ceil(s2 * 9) : 0
      total += count
      const color =
        count === 0 ? '#ebedf0' :
        count <= 2  ? '#9be9a8' :
        count <= 5  ? '#40c463' :
        count <= 7  ? '#30a14e' : '#216e39'
      days.push({
        date: date.toISOString().slice(0, 10),
        contributionCount: count,
        color,
        weekday,
      })
    }
    if (days.length > 0) weeks.push({ firstDay: days[0].date, contributionDays: days })
  }
  return { totalContributions: total, weeks }
}

export const DEMO_CALENDAR: ContribCalendar = makeCalendar()

// ---------------------------------------------------------------------------
// REST orgs (snake_case, as GitHub REST returns)
// ---------------------------------------------------------------------------

export const DEMO_ORGS_REST = ORGS.map((o) => ({
  login: o.login,
  avatar_url: o.avatarUrl,
  url: o.url,
}))

// ---------------------------------------------------------------------------
// PR detail (for when the user clicks into a PR)
// ---------------------------------------------------------------------------

const DEMO_COMMITS: PRCommit[] = [
  {
    oid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    abbreviatedOid: 'a1b2c3d',
    url: 'https://github.com/vercel/next.js/commit/a1b2c3d',
    messageHeadline: 'feat(app-router): initial async component support',
    messageBody: '',
    committedDate: ago(3),
    authoredDate: ago(3),
    author: { name: 'Seb Markbåge', email: 'seb@fb.com', user: { login: 'sebmarkbage', avatarUrl: ghAvatar('sebmarkbage') } },
  },
  {
    oid: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    abbreviatedOid: 'b2c3d4e',
    url: 'https://github.com/vercel/next.js/commit/b2c3d4e',
    messageHeadline: 'feat(app-router): add Suspense boundary for concurrent mode',
    messageBody: 'Wraps async server components in a Suspense boundary so the shell\nstreams immediately without blocking on data.',
    committedDate: ago(1),
    authoredDate: ago(1),
    author: { name: 'Seb Markbåge', email: 'seb@fb.com', user: { login: 'sebmarkbage', avatarUrl: ghAvatar('sebmarkbage') } },
  },
]

const DEMO_REVIEWS: Review[] = [
  {
    state: 'COMMENTED',
    bodyHTML: '<p>Looks good overall — left a few nits on the Suspense boundary placement. Can we add a test for the no-op case when <code>children</code> is already resolved?</p>',
    submittedAt: ago(0, 6),
    author: { login: 'timneutkens', avatarUrl: ghAvatar('timneutkens') },
  },
]

const DEMO_COMMENTS: Comment[] = [
  {
    bodyHTML: '<p>This fixes the issue I reported in #4698 — confirmed locally on the repro branch. 🚀</p>',
    createdAt: ago(1, 3),
    author: { login: 'leerob', avatarUrl: ghAvatar('leerob') },
  },
]

const DEMO_FILES: FileChange[] = [
  { path: 'packages/next/src/server/app-router/async-component.tsx', additions: 312, deletions: 44, changeType: 'MODIFIED' },
  { path: 'packages/next/src/client/components/suspense-boundary.tsx', additions: 87, deletions: 12, changeType: 'MODIFIED' },
  { path: 'test/e2e/app-dir/async-component/async-component.test.ts', additions: 234, deletions: 18, changeType: 'MODIFIED' },
  { path: 'packages/next/src/server/app-router/types.ts', additions: 48, deletions: 8, changeType: 'MODIFIED' },
  { path: 'packages/next/src/server/app-router/render.tsx', additions: 312, deletions: 44, changeType: 'MODIFIED' },
  { path: 'docs/02-app/01-building-your-application/01-routing/async-components.mdx', additions: 184, deletions: 112, changeType: 'MODIFIED' },
  { path: 'packages/next/src/server/app-router/index.ts', additions: 12, deletions: 8, changeType: 'MODIFIED' },
  { path: 'packages/next/package.json', additions: 1, deletions: 0, changeType: 'MODIFIED' },
]

export function getDemoPRDetail(owner: string, name: string, number: number): PRDetail {
  const base = [...DEMO_PRS_REVIEW_REQUESTED, ...DEMO_PRS_AUTHORED, ...DEMO_PRS_MENTIONED, ...DEMO_PRS_ASSIGNED]
    .find((p) => p.repository.nameWithOwner === `${owner}/${name}` && p.number === number)

  const title = base?.title ?? `Demo pull request #${number}`
  const author = base?.author ?? { login: 'dPeluChe', avatarUrl: ghAvatar('dPeluChe'), url: 'https://github.com/alexd' }

  return {
    number,
    title,
    url: `https://github.com/${owner}/${name}/pull/${number}`,
    state: 'OPEN',
    isDraft: base?.isDraft ?? false,
    bodyHTML: `<h2>Summary</h2><p>This pull request ${title.toLowerCase()}.</p><ul><li>Implements the core logic</li><li>Adds tests for the happy path and edge cases</li><li>Updates documentation</li></ul>`,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: base?.reviewDecision ?? 'REVIEW_REQUIRED',
    viewerCanUpdate: true,
    createdAt: base?.createdAt ?? ago(5),
    updatedAt: base?.updatedAt ?? ago(0),
    author: { ...author, url: `https://github.com/${author.login}` },
    baseRefName: 'main',
    headRefName: 'feat/' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
    additions: base?.additions ?? 312,
    deletions: base?.deletions ?? 44,
    changedFiles: base?.changedFiles ?? 8,
    repository: { nameWithOwner: `${owner}/${name}`, url: `https://github.com/${owner}/${name}` },
    labels: base?.labels ?? { nodes: [] },
    assignees: { nodes: [] },
    commits: { totalCount: DEMO_COMMITS.length, nodes: DEMO_COMMITS },
    reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'dPeluChe', avatarUrl: ghAvatar('dPeluChe') } }] },
    reviews: { nodes: DEMO_REVIEWS },
    comments: { nodes: DEMO_COMMENTS },
    files: { nodes: DEMO_FILES },
    ciState: base?.ciState ?? 'SUCCESS',
    checks: [
      { __typename: 'CheckRun', name: 'build', conclusion: 'success', status: 'COMPLETED', detailsUrl: null, checkSuite: null },
      { __typename: 'CheckRun', name: 'test (node 20)', conclusion: base?.ciState === 'FAILURE' ? 'failure' : 'success', status: 'COMPLETED', detailsUrl: null, checkSuite: null },
      { __typename: 'CheckRun', name: 'lint', conclusion: 'success', status: 'COMPLETED', detailsUrl: null, checkSuite: null },
      { __typename: 'CheckRun', name: 'type-check', conclusion: 'success', status: 'COMPLETED', detailsUrl: null, checkSuite: null },
    ],
  }
}
