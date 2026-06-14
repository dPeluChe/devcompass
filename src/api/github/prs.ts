import {
  DEMO_TOKEN, DEMO_PRS_REVIEW_REQUESTED, DEMO_PRS_AUTHORED,
  DEMO_PRS_MENTIONED, DEMO_PRS_ASSIGNED, DEMO_PRS_POOL, DEMO_MERGED_PRS, getDemoPRDetail
} from '../demo-data'
import { gql, rest } from './client'
import type { PullRequest, PRDetail, PRCommit, CheckContext, ReviewEvent, MergeMethod, WorkflowJob } from './types'

// ---------- PR search (cross-repo inbox) ----------

type RawPR = Omit<PullRequest, 'ciState'> & {
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}

export async function searchPRs(token: string, query: string, first = 50): Promise<PullRequest[]> {
  if (token === DEMO_TOKEN) {
    // Order matters: the review-pool query negates the reviewer/author/assignee
    // qualifiers (so it also contains those substrings) — match it first via the
    // unique `draft:false`.
    if (query.includes('draft:false'))       return DEMO_PRS_POOL
    if (query.includes('review-requested:')) return DEMO_PRS_REVIEW_REQUESTED
    if (query.includes('author:'))           return DEMO_PRS_AUTHORED
    if (query.includes('mentions:'))         return DEMO_PRS_MENTIONED
    if (query.includes('assignee:'))         return DEMO_PRS_ASSIGNED
    return []
  }
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

export async function fetchPullRequestDetail(
  token: string,
  owner: string,
  name: string,
  number: number
): Promise<PRDetail> {
  if (token === DEMO_TOKEN) return getDemoPRDetail(owner, name, number)
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
  const commitNodes: PRCommit[] = pr.commits.nodes.map((n) => ({
    oid: n.commit.oid,
    abbreviatedOid: n.commit.abbreviatedOid,
    url: n.commit.url,
    messageHeadline: n.commit.messageHeadline,
    messageBody: n.commit.messageBody,
    committedDate: n.commit.committedDate,
    authoredDate: n.commit.authoredDate,
    author: n.commit.author
  }))
  return {
    ...pr,
    commits: { totalCount: pr.commits.totalCount, nodes: commitNodes },
    ciState: rollup?.state ?? null,
    checks: rollup?.contexts.nodes ?? []
  }
}

// ---------- Mutations (REST) ----------

/** Submits a PR review. body is required for REQUEST_CHANGES and COMMENT. */
export async function submitReview(
  token: string,
  owner: string,
  name: string,
  number: number,
  event: ReviewEvent,
  body?: string
): Promise<void> {
  if (token === DEMO_TOKEN) return
  await rest(token, 'POST', `/repos/${owner}/${name}/pulls/${number}/reviews`, {
    event,
    body: body ?? ''
  })
}

/** Posts an issue-level comment on the PR (the same endpoint used by GitHub's "Comment" button). */
export async function addIssueComment(token: string, owner: string, name: string, number: number, body: string): Promise<void> {
  if (token === DEMO_TOKEN) return
  await rest(token, 'POST', `/repos/${owner}/${name}/issues/${number}/comments`, { body })
}

/** Re-runs only the failed jobs of a workflow run. Cheaper than re-running everything. */
export async function rerunFailedJobs(token: string, owner: string, name: string, runId: number): Promise<void> {
  if (token === DEMO_TOKEN) return
  await rest(token, 'POST', `/repos/${owner}/${name}/actions/runs/${runId}/rerun-failed-jobs`)
}

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
  if (token === DEMO_TOKEN) return
  await rest(token, 'PUT', `/repos/${owner}/${name}/pulls/${number}/merge`, {
    merge_method: method,
    ...(options ?? {})
  })
}

/** Lists jobs in a workflow run. Used to map a CheckRun.name to a job_id so we can fetch its logs. */
export async function fetchWorkflowRunJobs(token: string, owner: string, name: string, runId: number): Promise<WorkflowJob[]> {
  if (token === DEMO_TOKEN) return []
  const data = await rest(token, 'GET', `/repos/${owner}/${name}/actions/runs/${runId}/jobs?per_page=100`) as { jobs?: WorkflowJob[] } | null
  return data?.jobs ?? []
}

/**
 * Returns the raw log text for a job. The endpoint 302s to a short-lived presigned
 * URL — we let the browser follow it transparently. Logs can be huge (megabytes),
 * so callers should truncate before rendering.
 */
export async function fetchJobLogs(token: string, owner: string, name: string, jobId: number): Promise<string> {
  if (token === DEMO_TOKEN) return '(no logs in demo mode)'
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/actions/jobs/${jobId}/logs`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} fetching logs`)
  return res.text()
}

export type MergedPR = {
  number: number
  title: string
  url: string
  createdAt: string
  mergedAt: string
  repository: { nameWithOwner: string }
}

/**
 * PRs involving the viewer merged since `sinceIso` (one search, first page of
 * 100 — digest-grade numbers, not an audit). Powers "merged in window" and
 * avg time-to-merge on the Digest.
 */
export async function searchMergedPRs(token: string, login: string, sinceIso: string): Promise<MergedPR[]> {
  if (token === DEMO_TOKEN) return DEMO_MERGED_PRS
  const q = `is:pr is:merged involves:${login} merged:>=${sinceIso.slice(0, 10)} sort:updated-desc`
  const data = await gql<{ search: { nodes: (MergedPR | Record<string, never>)[] } }>(
    token,
    `
    query($q: String!) {
      search(query: $q, type: ISSUE, first: 100) {
        nodes {
          ... on PullRequest {
            number
            title
            url
            createdAt
            mergedAt
            repository { nameWithOwner }
          }
        }
      }
    }
  `,
    { q }
  )
  return data.search.nodes.filter((n): n is MergedPR => !!(n as MergedPR).mergedAt)
}
