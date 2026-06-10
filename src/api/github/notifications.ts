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
export async function fetchNotifications(token: string, opts?: { all?: boolean; max?: number }): Promise<GitHubNotification[]> {
  if (token === DEMO_TOKEN) return DEMO_NOTIFICATIONS
  const max = opts?.max ?? 200
  const perPage = 50
  const out: GitHubNotification[] = []
  // Page until a short page or the cap — a full page means there's likely more.
  for (let page = 1; out.length < max; page++) {
    const data = await rest(
      token,
      'GET',
      `/notifications?all=${opts?.all ? 'true' : 'false'}&per_page=${perPage}&page=${page}`
    ) as GitHubNotification[]
    if (!Array.isArray(data) || data.length === 0) break
    out.push(...data)
    if (data.length < perPage) break
  }
  return out.slice(0, max)
}

/** Best-effort web URL for a notification's subject (issues/PRs; falls back to the repo). */
export function notificationWebUrl(n: GitHubNotification): string {
  const apiUrl = n.subject.url
  if (!apiUrl) return n.repository.html_url
  return apiUrl
    .replace('https://api.github.com/repos/', 'https://github.com/')
    .replace('/pulls/', '/pull/')
}

/** Marks one notification thread read. PATCH /notifications/threads/{id} → 205. */
export async function markNotificationRead(token: string, threadId: string): Promise<void> {
  if (token === DEMO_TOKEN) return
  await rest(token, 'PATCH', `/notifications/threads/${threadId}`)
}

/** Marks every notification read. PUT /notifications → 202/205. */
export async function markAllNotificationsRead(token: string): Promise<void> {
  if (token === DEMO_TOKEN) return
  await rest(token, 'PUT', '/notifications', { read: true })
}
