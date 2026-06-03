import type { SentryIssue, SentryIssueLevel } from '../../api/sentry'

export const LEVEL_COLOR: Record<SentryIssueLevel, string> = {
  fatal: '#f55', error: '#f77', warning: '#e9a23b', info: '#5b9bd5', debug: '#888', sample: '#888',
}

/** Shared issue list — used by the Sentry connector and the repo-detail Sentry tab. */
export function SentryIssueList({ issues }: { issues: SentryIssue[] }) {
  return (
    <ul className="connector-issue-list">
      {issues.map((iss) => (
        <li key={iss.id} className="connector-issue">
          <span className="connector-issue-level" style={{ background: LEVEL_COLOR[iss.level] ?? '#888' }} title={iss.level}>
            {iss.level}
          </span>
          <div className="connector-issue-main">
            <a href={iss.permalink} target="_blank" rel="noopener noreferrer" className="connector-issue-title">
              {iss.title}
            </a>
            <div className="connector-issue-meta muted">
              <code>{iss.shortId}</code> · {iss.project.slug} · {iss.count} events · {iss.userCount} users
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
