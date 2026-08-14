import type { IssueSearchResult } from '../github'
import { issue } from './helpers'

// Unified Issues feed (GitHub issues + Sentry errors) — demo dataset

export const DEMO_ISSUES: IssueSearchResult[] = [
  issue('I001', 92, 'Login redirect loops when SSO session expires mid-flow', 'iteris', 'platform-api', 'carlosm', 0, [{ name: 'bug', color: 'd73a4a' }, { name: 'auth', color: '0e8a16' }], 6),
  issue('I002', 219, 'Dashboard metrics panel renders empty on Safari 17', 'iteris', 'web-app', 'sofiad', 1, [{ name: 'bug', color: 'd73a4a' }], 3),
  issue('I003', 4730, 'RFC: streaming metadata API for app router', 'vercel', 'next.js', 'sebmarkbage', 2, [{ name: 'discussion', color: 'cc317c' }], 41),
  issue('I004', 21, 'Add keyboard shortcut cheatsheet to the help modal', 'dPeluChe', 'devcompass', 'dPeluChe', 3, [{ name: 'enhancement', color: '84b6eb' }], 1),
]
