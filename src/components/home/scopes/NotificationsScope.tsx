import { useMemo } from 'react'
import { notificationWebUrl, type GitHubNotification } from '../../../api/github'
import { relativeTime } from '../../../utils/time'
import { OrgChip } from '../OrgChip'
import { useNotifications, NOTIFICATIONS_LIMIT } from '../useNotifications'
import { Header, type ScopeProps } from './common'
import type { DotLevel } from '../types'

const REASON_DOT: Record<string, DotLevel> = {
  review_requested: 'warn',
  assign: 'warn',
  security_alert: 'critical',
  mention: 'info',
  team_mention: 'info',
  author: 'info',
  comment: 'muted',
  state_change: 'muted',
  subscribed: 'muted',
  ci_activity: 'muted',
}

const SUBJECT_GLYPH: Record<string, string> = {
  PullRequest: '⑃',
  Issue: '◇',
  Commit: '◆',
  Release: '⊙',
  Discussion: '💬',
}

export function NotificationsScope({ token }: ScopeProps) {
  const { data, isLoading, error } = useNotifications(token)

  // Group by repo, each group ordered by recency, groups ordered by their most
  // recent notification.
  const groups = useMemo(() => {
    const m = new Map<string, { owner: string; avatarUrl: string; items: GitHubNotification[] }>()
    for (const n of data ?? []) {
      const key = n.repository.full_name
      const g = m.get(key)
      if (g) g.items.push(n)
      else m.set(key, { owner: n.repository.owner.login, avatarUrl: n.repository.owner.avatar_url, items: [n] })
    }
    const recency = (ns: GitHubNotification[]) => Math.max(...ns.map((n) => new Date(n.updated_at).getTime()))
    for (const g of m.values()) g.items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return [...m.entries()].sort((a, b) => recency(b[1].items) - recency(a[1].items))
  }, [data])

  const total = data?.length ?? 0

  return (
    <main className="hs-main">
      <Header title="Notifications" count={total} meta="unread · everything that involves you, across all repos" />

      {total >= NOTIFICATIONS_LIMIT && (
        <p className="hs-truncation-note muted">
          Showing the {NOTIFICATIONS_LIMIT} most recent — there may be more on GitHub.
        </p>
      )}

      {isLoading && <div className="hs-empty"><strong>Loading…</strong></div>}
      {error && (
        <div className="hs-empty" style={{ color: 'var(--danger)' }}>
          <strong>Failed to load.</strong>{error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && !error && total === 0 && (
        <div className="hs-empty">
          <strong>Inbox zero. 🎉</strong>
          Mentions, review requests and assignments across all your repos show here.
        </div>
      )}

      {groups.map(([fullName, group]) => (
        <section key={fullName} className="hs-issue-group">
          <h3 className="hs-issue-group-head">
            <OrgChip login={group.owner} avatarUrl={group.avatarUrl} />
            <a href={`https://github.com/${fullName}`} target="_blank" rel="noopener noreferrer">{fullName}</a>
            <span className="muted"> · {group.items.length}</span>
          </h3>
          <div className="hs-surface">
            {group.items.map((n) => <NotificationRow key={n.id} n={n} />)}
          </div>
        </section>
      ))}
    </main>
  )
}

function NotificationRow({ n }: { n: GitHubNotification }) {
  return (
    <a className="hs-notif-row" href={notificationWebUrl(n)} target="_blank" rel="noopener noreferrer">
      <span className={`hs-dot ${REASON_DOT[n.reason] ?? 'info'}`} />
      <span className="hs-notif-glyph" title={n.subject.type}>{SUBJECT_GLYPH[n.subject.type] ?? '•'}</span>
      <div className="hs-notif-main">
        <span className="hs-notif-title">{n.subject.title}</span>
        <div className="hs-notif-meta muted">{n.reason.replace(/_/g, ' ')} · {relativeTime(n.updated_at)}</div>
      </div>
    </a>
  )
}
