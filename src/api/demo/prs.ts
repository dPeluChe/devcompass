import type { PullRequest, PRDetail, PRCommit, Review, Comment, FileChange } from '../github'
import { ago, ghAvatar, fullPR, mergedPR } from './helpers'

// ---------------------------------------------------------------------------
// Inbox PRs (for searchPRs)
// ---------------------------------------------------------------------------

export const DEMO_PRS_REVIEW_REQUESTED: PullRequest[] = [
  fullPR('P001', 4721, 'feat(app-router): support React 19 concurrent features', 'vercel', 'next.js', 'sebmarkbage', 0, 5, {
    labels: [{ name: 'enhancement', color: '84b6eb' }],
    reviewDecision: 'REVIEW_REQUIRED',
    additions: 1482, deletions: 340, changedFiles: 23, comments: 8,
  }),
  fullPR('P060', 8342, 'fix(realtime): reconnection backoff exceeds 30 s limit', 'supabase', 'supabase', 'sujay-r', 1, 3, {
    labels: [{ name: 'bug', color: 'd73a4a' }, { name: 'performance', color: 'e4e669' }],
    reviewDecision: 'REVIEW_REQUIRED', base: 'develop',
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

// Review pool: open PRs by teammates you could review but aren't assigned/requested on.
export const DEMO_PRS_POOL: PullRequest[] = [
  fullPR('PP01', 88, 'feat(billing): usage-based metering for the platform API', 'iteris', 'platform-api', 'sofiad', 0, 2, {
    ciState: 'SUCCESS', reviewDecision: 'REVIEW_REQUIRED',
    labels: [{ name: 'enhancement', color: '84b6eb' }], additions: 643, deletions: 88, changedFiles: 19, comments: 1,
  }),
  fullPR('PP02', 216, 'fix(web): debounce the search box to cut re-renders', 'iteris', 'web-app', 'carlosm', 0, 1, {
    ciState: 'FAILURE', reviewDecision: 'REVIEW_REQUIRED', base: 'staging',
    labels: [{ name: 'performance', color: 'e4e669' }], additions: 31, deletions: 12, changedFiles: 3, comments: 0,
  }),
  fullPR('PP03', 7, 'docs: contributor guide + architecture diagram', 'iteris', 'infra', 'lucamb', 1, 3, {
    ciState: 'SUCCESS', reviewDecision: 'REVIEW_REQUIRED',
    labels: [{ name: 'documentation', color: '0075ca' }], additions: 210, deletions: 4, changedFiles: 2, comments: 2,
  }),
]

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

// ---------------------------------------------------------------------------
// Digest v2 — merged PRs (one search window worth)
// ---------------------------------------------------------------------------

export const DEMO_MERGED_PRS = [
  mergedPR(86, 'fix(auth): refresh token race on concurrent tabs', 'iteris', 'platform-api', 0, 18),
  mergedPR(212, 'feat(dashboard): export metrics panel as CSV', 'iteris', 'web-app', 1, 40),
  mergedPR(15, 'feat(home): unified Issues feed', 'dPeluChe', 'devcompass', 2, 9),
  mergedPR(84, 'chore(deps): bump fastify to v5', 'iteris', 'platform-api', 3, 64),
  mergedPR(4690, 'fix(turbopack): sourcemaps for edge runtime', 'vercel', 'next.js', 5, 30),
]
