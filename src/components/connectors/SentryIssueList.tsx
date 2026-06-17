import { useState } from 'react'
import type { SentryIssue, SentryIssueLevel } from '../../api/sentry'
import { SentryIssueModal } from './SentryIssueModal'

export const LEVEL_COLOR: Record<SentryIssueLevel, string> = {
  fatal: '#f55', error: '#f77', warning: '#e9a23b', info: '#5b9bd5', debug: '#888', sample: '#888',
}

function IssueRow({ iss, onOpen }: { iss: SentryIssue; onOpen: () => void }) {
  return (
    <li
      className="connector-issue connector-issue-clickable"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <span className="connector-issue-level" style={{ background: LEVEL_COLOR[iss.level] ?? '#888' }} title={iss.level}>
        {iss.level}
      </span>
      <div className="connector-issue-main">
        <span className="connector-issue-title">{iss.title}</span>
        <div className="connector-issue-meta muted">
          <code>{iss.shortId}</code> · {iss.project.slug} · {iss.count} events · {iss.userCount} users
        </div>
      </div>
      <a
        className="connector-issue-ext"
        href={iss.permalink}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in Sentry"
        onClick={(e) => e.stopPropagation()}
      >↗</a>
    </li>
  )
}

/**
 * Shared issue list. `groupByProject` renders a header per project (used by the
 * org-wide connector test); the per-repo Sentry tab leaves it flat. Clicking a
 * row opens the in-app detail modal (stacktrace + tags); the ↗ opens Sentry.
 */
export function SentryIssueList({ issues, groupByProject = false, token = '' }: { issues: SentryIssue[]; groupByProject?: boolean; token?: string }) {
  const [selected, setSelected] = useState<SentryIssue | null>(null)

  const body = !groupByProject ? (
    <ul className="connector-issue-list">
      {issues.map((iss) => <IssueRow key={iss.id} iss={iss} onOpen={() => setSelected(iss)} />)}
    </ul>
  ) : (() => {
    const groups = new Map<string, SentryIssue[]>()
    for (const iss of issues) {
      const list = groups.get(iss.project.slug)
      if (list) list.push(iss)
      else groups.set(iss.project.slug, [iss])
    }
    return (
      <div className="sentry-issue-groups">
        {[...groups.entries()].map(([slug, list]) => (
          <div key={slug} className="sentry-issue-group">
            <div className="sentry-issue-group-head">{slug} · {list.length} issue{list.length === 1 ? '' : 's'}</div>
            <ul className="connector-issue-list">
              {list.map((iss) => <IssueRow key={iss.id} iss={iss} onOpen={() => setSelected(iss)} />)}
            </ul>
          </div>
        ))}
      </div>
    )
  })()

  return (
    <>
      {body}
      <SentryIssueModal issue={selected} token={token} onClose={() => setSelected(null)} />
    </>
  )
}
