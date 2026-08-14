import type { GitHubNotification } from '../github'
import { notif } from './helpers'

// Notifications inbox — demo dataset

export const DEMO_NOTIFICATIONS: GitHubNotification[] = [
  notif('N001', 'review_requested', 'PullRequest', 'feat(app-router): support React 19 concurrent features', 'vercel', 'next.js', 'pulls/4721', 0, 1),
  notif('N002', 'mention', 'Issue', 'Login redirect loops when SSO session expires mid-flow', 'iteris', 'platform-api', 'issues/92', 0, 3),
  notif('N003', 'assign', 'Issue', 'Dashboard metrics panel renders empty on Safari 17', 'iteris', 'web-app', 'issues/219', 1),
  notif('N004', 'ci_activity', 'CheckSuite', 'CI failed on main: test (node 20)', 'iteris', 'platform-api', 'actions', 0, 6),
  notif('N005', 'subscribed', 'Release', 'v15.4.0', 'vercel', 'next.js', 'releases/15.4.0', 2),
  notif('N006', 'comment', 'PullRequest', 'refactor(editor): extract BlockEditor to standalone package', 'linear', 'linear', 'pulls/2103', 1, 4),
]
