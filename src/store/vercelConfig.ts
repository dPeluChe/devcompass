import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VercelAuth } from '../api/vercel'
import { DEMO_TOKEN } from '../api/demo-data'
import { sanitizeToken } from './sanitizeToken'

/** Vercel access tokens have no fixed public prefix; just sanity-check length. */
export function validateVercelTokenFormat(raw: string): { ok: boolean; warning: string | null } {
  const t = sanitizeToken(raw)
  if (!t) return { ok: false, warning: null }
  if (t.length < 20) return { ok: false, warning: `That looks too short for a Vercel access token (${t.length} chars).` }
  return { ok: true, warning: null }
}

export interface VercelConfig {
  /** BYO Vercel access token (vercel.com → Settings → Tokens). */
  token: string
  /** Team id/slug; '' for a personal account. */
  teamId: string
  /** Relay endpoint. Default same-origin '/api/proxy'; overridable for self-host. */
  proxyBase: string
  enabled: boolean
  /**
   * Homologation map: Vercel project id → GitHub `nameWithOwner`. Seeded from
   * each project's git `link` on Validate; consumed by RepoDetail's Deployments
   * tab (reverse lookup repo → project).
   */
  projectRepoMap: Record<string, string>
  /** Vercel project id → display name, for the tab title. */
  projectNames: Record<string, string>
  /** Vercel project id → live production URL. */
  projectUrls: Record<string, string>
}

const DEFAULTS: VercelConfig = {
  token: '',
  teamId: '',
  proxyBase: '/api/proxy',
  enabled: false,
  projectRepoMap: {},
  projectNames: {},
  projectUrls: {},
}

interface VercelConfigState extends VercelConfig {
  update: (patch: Partial<VercelConfig>) => void
  reset: () => void
  /** Auth bundle for the Vercel client, with the token sanitized. */
  getAuth: () => VercelAuth
  isConfigured: () => boolean
  /** Reverse the project→repo map: "owner/repo" → { projectId, name } or null. */
  projectForRepo: (nameWithOwner: string) => { id: string; name: string } | null
}

export const vercelConfigStore = create<VercelConfigState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      // Sanitize the token at the storage boundary (same as the PAT / Sentry).
      update: (patch) => set(patch.token !== undefined ? { ...patch, token: sanitizeToken(patch.token) } : patch),
      reset: () => set(DEFAULTS),
      getAuth: () => {
        const s = get()
        return { token: sanitizeToken(s.token), teamId: s.teamId.trim(), proxyBase: s.proxyBase || '/api/proxy' }
      },
      isConfigured: () => !!sanitizeToken(get().token),
      projectForRepo: (nameWithOwner) => {
        const target = nameWithOwner.toLowerCase()
        const s = get()
        const hit = Object.entries(s.projectRepoMap).find(([, repo]) => repo.toLowerCase() === target)
        return hit ? { id: hit[0], name: s.projectNames[hit[0]] ?? hit[0] } : null
      },
    }),
    { name: 'devcompass-vercel-config' }
  )
)

/** Resolve the Vercel auth for a given app token — demo gets a demo auth, else the store's. */
export function vercelAuthFor(token: string): VercelAuth {
  return token === DEMO_TOKEN
    ? { token: DEMO_TOKEN, teamId: '', proxyBase: '' }
    : vercelConfigStore.getState().getAuth()
}
