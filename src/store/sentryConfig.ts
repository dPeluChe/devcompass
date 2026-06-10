import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SentryAuth } from '../api/sentry'
import { sanitizeToken } from './sanitizeToken'

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
   * Homologation map: Sentry project slug → GitHub `nameWithOwner`. Seeded from
   * Sentry's GitHub code-mappings on Validate; consumed by RepoDetail's Sentry
   * tab (reverse lookup repo → project).
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
      // Sanitize the token at the storage boundary too (same as the PAT) — getAuth
      // re-sanitizes on read, but the persisted value shouldn't carry stray unicode.
      update: (patch) => set(patch.token !== undefined ? { ...patch, token: sanitizeToken(patch.token) } : patch),
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
