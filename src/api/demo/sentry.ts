import type { SentryIssue } from '../sentry'
import { ago } from './helpers'

// Sentry demo: unresolved errors mapped onto the demo repos so the unified
// Issues feed showcases the homologation without a real Sentry connection.
export const DEMO_SENTRY_ISSUES: SentryIssue[] = [
  {
    id: 'S001', shortId: 'PLATFORM-API-3K', title: "TypeError: Cannot read properties of undefined (reading 'orgId')",
    culprit: 'middleware/auth.ts in resolveSession', level: 'error', status: 'unresolved',
    count: '128', userCount: 37, firstSeen: ago(6), lastSeen: ago(0, 2),
    permalink: 'https://demo.sentry.io/issues/S001/', project: { id: '1', slug: 'platform-api', name: 'platform-api' },
    isUnhandled: true, priority: 'high',
  },
  {
    id: 'S002', shortId: 'WEB-APP-9F', title: 'ChunkLoadError: Loading chunk 42 failed (deploy hash mismatch)',
    culprit: 'app/routes/dashboard.tsx', level: 'warning', status: 'unresolved',
    count: '54', userCount: 19, firstSeen: ago(2), lastSeen: ago(0, 5),
    permalink: 'https://demo.sentry.io/issues/S002/', project: { id: '2', slug: 'web-app', name: 'web-app' },
    isUnhandled: false, priority: 'medium',
  },
  {
    id: 'S003', shortId: 'PLATFORM-API-4A', title: 'N+1 Query detected: SELECT * FROM memberships WHERE user_id = ?',
    culprit: 'services/orgs.ts in listUserOrgs', level: 'info', status: 'unresolved',
    count: '311', userCount: 8, firstSeen: ago(12), lastSeen: ago(1),
    permalink: 'https://demo.sentry.io/issues/S003/', project: { id: '1', slug: 'platform-api', name: 'platform-api' },
    isUnhandled: false, priority: 'low',
  },
]

/** Sentry project slug → GitHub repo, mirroring a configured connector. */
export const DEMO_SENTRY_REPO_MAP: Record<string, string> = {
  'platform-api': 'iteris/platform-api',
  'web-app': 'iteris/web-app',
}
