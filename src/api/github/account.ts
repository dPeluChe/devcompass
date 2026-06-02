import { DEMO_TOKEN, DEMO_RATE_LIMIT, DEMO_CALENDAR, DEMO_TOKEN_INFO, DEMO_ORGS_REST } from '../demo-data'
import { gql } from './client'
import type { RateLimit, ContribCalendar, TokenInfo } from './types'

export async function fetchRateLimit(token: string): Promise<RateLimit> {
  if (token === DEMO_TOKEN) return DEMO_RATE_LIMIT
  const data = await gql<{ rateLimit: RateLimit }>(token, `query { rateLimit { remaining limit resetAt } }`)
  return data.rateLimit
}

/**
 * Pulls the viewer's GitHub contribution calendar — the same data that powers
 * the green squares on github.com/<user>. One GraphQL query; the calendar
 * automatically covers the trailing 53 weeks ending "today" when no date
 * range is supplied.
 */
export async function fetchContributionCalendar(token: string): Promise<ContribCalendar> {
  if (token === DEMO_TOKEN) return DEMO_CALENDAR
  const data = await gql<{ viewer: { contributionsCollection: { contributionCalendar: ContribCalendar } } }>(
    token,
    `
    query {
      viewer {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              firstDay
              contributionDays {
                date
                contributionCount
                color
                weekday
              }
            }
          }
        }
      }
    }
  `
  )
  return data.viewer.contributionsCollection.contributionCalendar
}

/**
 * Probes /user via REST to read auth-related response headers. GraphQL doesn't
 * expose token scopes, so a single REST hop is the cheapest way to see what the
 * token can actually do — and crucially, whether SSO authorization is missing.
 */
export async function fetchTokenInfo(token: string): Promise<TokenInfo> {
  if (token === DEMO_TOKEN) return DEMO_TOKEN_INFO
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  const scopesHeader = res.headers.get('X-OAuth-Scopes')
  const ssoHeader = res.headers.get('X-GitHub-SSO')
  const expiryHeader = res.headers.get('GitHub-Authentication-Token-Expiration')
  let sso: TokenInfo['ssoRequired'] = null
  if (ssoHeader) {
    // Format: "required; url=https://github.com/orgs/.../sso?...; partial-results"
    // or:    "partial-results; organizations=12345,67890"
    const urlMatch = ssoHeader.match(/url=([^;]+)/)
    const orgsMatch = ssoHeader.match(/organizations=([^;]+)/)
    sso = {
      url: urlMatch?.[1]?.trim() ?? 'https://github.com/settings/tokens',
      orgIds: orgsMatch?.[1]?.split(',').map((s) => s.trim()) ?? []
    }
  }
  return {
    type: scopesHeader === null ? 'fine-grained' : scopesHeader === '' ? 'unknown' : 'classic',
    scopes: scopesHeader ? scopesHeader.split(',').flatMap((s) => { const t = s.trim(); return t ? [t] : [] }) : [],
    ssoRequired: sso,
    expiresAt: expiryHeader ?? null
  }
}

/**
 * Lists orgs the authenticated user belongs to via REST. Sometimes returns more
 * than `viewer.organizations` (the GraphQL field is stricter about visibility).
 */
export async function fetchUserOrgsRest(token: string): Promise<{ login: string; avatar_url: string; url: string }[]> {
  if (token === DEMO_TOKEN) return DEMO_ORGS_REST
  const res = await fetch('https://api.github.com/user/orgs?per_page=100', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  return res.json()
}
