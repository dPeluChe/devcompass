import { DEMO_TOKEN, DEMO_NOTIFICATIONS } from '../demo-data'
import { rest } from './client'

export type GitHubNotification = {
  id: string
  /** assign | mention | review_requested | team_mention | author | comment | state_change | subscribed | ci_activity | security_alert | … */
  reason: string
  unread: boolean
  updated_at: string
  subject: {
    title: string
    /** API URL of the issue/PR/commit — not a web link. */
    url: string | null
    latest_comment_url: string | null
    /** Issue | PullRequest | Commit | Discussion | Release | … */
    type: string
  }
  repository: {
    full_name: string
    html_url: string
    owner: { login: string; avatar_url: string }
  }
}

/**
 * The authenticated user's notification threads — a cross-repo "involves you"
 * inbox (mentions, assignments, review requests, …) spanning every repo, even
 * ones not synced. Default returns unread only. Needs the `notifications` or
 * `repo` scope.
 */
export async function fetchNotifications(token: string, opts?: { all?: boolean; perPage?: number }): Promise<GitHubNotification[]> {
  if (token === DEMO_TOKEN) return DEMO_NOTIFICATIONS
  const data = await rest(
    token,
    'GET',
    `/notifications?all=${opts?.all ? 'true' : 'false'}&per_page=${opts?.perPage ?? 50}`
  ) as GitHubNotification[]
  return Array.isArray(data) ? data : []
}

/** Best-effort web URL for a notification's subject (issues/PRs; falls back to the repo). */
export function notificationWebUrl(n: GitHubNotification): string {
  const apiUrl = n.subject.url
  if (!apiUrl) return n.repository.html_url
  return apiUrl
    .replace('https://api.github.com/repos/', 'https://github.com/')
    .replace('/pulls/', '/pull/')
}
