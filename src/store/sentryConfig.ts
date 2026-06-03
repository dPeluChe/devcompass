import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SentryAuth } from '../api/sentry'

// Same ASCII sanitation as the GitHub PAT — pasted tokens often pick up NBSP /
// zero-width chars that break fetch headers. See store/auth.ts.
function sanitizeToken(token: string): string {
  return token.replace(/[^\x20-\x7e]/g, '').trim()
}

export interface SentryConfig {
  /** BYO Sentry auth token (sentry.io → Settings → Auth Tokens). */
  token: string
  /** '' → sentry.io; 'us'/'de' → regional host. */
  region: string
  orgSlug: string
  /** Selected environment filter; '' = all environments. */
  environment: string
  /** Relay endpoint. Default same-origin '/api/proxy'; overridable for self-host. */
  proxyBase: string
  enabled: boolean
  /**
   * Homologation map: Sentry project slug → GitHub `nameWithOwner`. Lets a
   * Sentry issue render alongside its repo. Seeded from Sentry's own GitHub
   * code-mappings, with manual override. Not yet consumed by views (PR 1).
   */
  projectRepoMap: Record<string, string>
}

const DEFAULTS: SentryConfig = {
  token: '',
  region: '',
  orgSlug: '',
  environment: '',
  proxyBase: '/api/proxy',
  enabled: false,
  projectRepoMap: {},
}

interface SentryConfigState extends SentryConfig {
  update: (patch: Partial<SentryConfig>) => void
  reset: () => void
  /** Auth bundle for the Sentry client, with the token sanitized. */
  getAuth: () => SentryAuth
  isConfigured: () => boolean
}

export const sentryConfigStore = create<SentryConfigState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULTS),
      getAuth: () => {
        const s = get()
        return { token: sanitizeToken(s.token), region: s.region.trim(), proxyBase: s.proxyBase || '/api/proxy' }
      },
      isConfigured: () => {
        const s = get()
        return !!sanitizeToken(s.token) && !!s.orgSlug.trim()
      },
    }),
    { name: 'devcompass-sentry-config' }
  )
)
