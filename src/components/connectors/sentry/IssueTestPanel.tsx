import { SentryIssueList } from '../SentryIssueList'
import type { SentryIssue } from '../../../api/sentry'
import type { Async } from './types'

export function IssueTestPanel({ iss, environment }: {
  iss: Async<SentryIssue[]>
  environment: string
}) {
  if (iss.error) {
    return <div className="hs-status hs-status-err" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>Failed: {iss.error}</div>
  }
  if (!iss.data) return null
  const envLabel = environment.trim() && environment.trim().toLowerCase() !== 'all' ? ` in @${environment.trim()}` : ' (all environments)'
  return (
    <div className="connector-results" style={{ marginTop: 12 }}>
      <div className="muted" style={{ marginBottom: 8 }}>
        {iss.data.length} issue{iss.data.length === 1 ? '' : 's'}{envLabel}
      </div>
      {iss.data.length === 0 ? (
        <span className="muted">No unresolved issues for this filter. 🎉</span>
      ) : (
        <SentryIssueList issues={iss.data} groupByProject />
      )}
    </div>
  )
}
