import type { ScopeKey } from '../types'
import { Header } from './common'

export function PlaceholderScope({ scope }: { scope: ScopeKey }) {
  const titles: Record<string, { title: string; meta: string; body: string }> = {
    watching: { title: 'Watching', meta: 'Active PRs that don\'t need action right now', body: 'Coming in Phase 2 — lower-urgency rows from the same searchPRs cohorts.' },
    digest: { title: 'Operational digest', meta: 'Trends and counts', body: 'Coming in Phase 3 as a separate /insights route.' },
    rate: { title: 'Token & rate', meta: 'Token type, scopes, SSO, rate limit', body: 'Available today under Config → Token.' }
  }
  const t = titles[scope] ?? { title: scope, meta: '', body: 'Placeholder.' }
  return (
    <main className="hs-main">
      <Header title={t.title} count={undefined} meta={t.meta} />
      <div className="hs-empty">
        <strong>{t.title}</strong>
        {t.body}
      </div>
    </main>
  )
}
