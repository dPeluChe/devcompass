import type { ContribCalendar, ContribDay, TokenInfo, RateLimit } from '../github'
import { ORGS } from './repos'

// ---------------------------------------------------------------------------
// Token info & rate limit
// ---------------------------------------------------------------------------

export const DEMO_TOKEN_INFO: TokenInfo = {
  type: 'classic',
  scopes: ['repo', 'read:org'],
  ssoRequired: null,
  expiresAt: null,
}

export const DEMO_RATE_LIMIT: RateLimit = {
  remaining: 4987,
  limit: 5000,
  resetAt: '2026-05-15T15:00:00Z',
}

// ---------------------------------------------------------------------------
// Contribution calendar (53 weeks ending 2026-05-15)
// ---------------------------------------------------------------------------

function makeCalendar(): ContribCalendar {
  // Calendar starts on the Sunday of the week that contains (today − 52 full weeks)
  const startDate = new Date('2025-05-04T00:00:00Z') // Sunday
  const endDate   = new Date('2026-05-15T00:00:00Z') // Friday

  const weeks: ContribCalendar['weeks'] = []
  let total = 0

  for (let w = 0; w < 53; w++) {
    const days: ContribDay[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate)
      date.setUTCDate(startDate.getUTCDate() + w * 7 + d)
      if (date > endDate) break

      const weekday = date.getUTCDay()
      const isWeekend = weekday === 0 || weekday === 6
      // Deterministic pseudo-random via sin
      const s1 = Math.sin(w * 17.3 + d * 31.7) * 0.5 + 0.5
      const s2 = Math.sin(w * 7.1  + d * 11.3 + 3.7) * 0.5 + 0.5
      const threshold = isWeekend ? 0.82 : 0.38
      const count = s1 > threshold ? Math.ceil(s2 * 9) : 0
      total += count
      const color =
        count === 0 ? '#ebedf0' :
        count <= 2  ? '#9be9a8' :
        count <= 5  ? '#40c463' :
        count <= 7  ? '#30a14e' : '#216e39'
      days.push({
        date: date.toISOString().slice(0, 10),
        contributionCount: count,
        color,
        weekday,
      })
    }
    if (days.length > 0) weeks.push({ firstDay: days[0].date, contributionDays: days })
  }
  return { totalContributions: total, weeks }
}

export const DEMO_CALENDAR: ContribCalendar = makeCalendar()

// ---------------------------------------------------------------------------
// REST orgs (snake_case, as GitHub REST returns)
// ---------------------------------------------------------------------------

export const DEMO_ORGS_REST = ORGS.map((o) => ({
  login: o.login,
  avatar_url: o.avatarUrl,
  url: o.url,
}))
