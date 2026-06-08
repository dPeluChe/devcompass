import { useMemo } from 'react'
import { notificationWebUrl, type GitHubNotification } from '../../../api/github'
import { relativeTime } from '../../../utils/time'
import { OrgChip } from '../OrgChip'
import { useNotifications } from '../useNotifications'
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

  const items = useMemo(
    () => (data ?? []).slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [data]
  )

  return (
    <main className="hs-main">
      <Header title="Notifications" count={items.length} meta="unread · everything that involves you, across all repos" />

      {isLoading && <div className="hs-empty"><strong>Loading…</strong></div>}
      {error && (
        <div className="hs-empty" style={{ color: 'var(--danger)' }}>
          <strong>Failed to load.</strong>{error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && !error && items.length === 0 && (
        <div className="hs-empty">
          <strong>Inbox zero. 🎉</strong>
          Mentions, review requests and assignments across all your repos show here.
        </div>
      )}

      {items.length > 0 && (
        <section className="hs-surface">
          {items.map((n) => <NotificationRow key={n.id} n={n} />)}
        </section>
      )}
    </main>
  )
}

function NotificationRow({ n }: { n: GitHubNotification }) {
  const [owner] = n.repository.full_name.split('/')
  return (
    <a className="hs-notif-row" href={notificationWebUrl(n)} target="_blank" rel="noopener noreferrer">
      <span className={`hs-dot ${REASON_DOT[n.reason] ?? 'info'}`} />
      <span className="hs-notif-glyph" title={n.subject.type}>{SUBJECT_GLYPH[n.subject.type] ?? '•'}</span>
      <div className="hs-notif-main">
        <span className="hs-notif-title">{n.subject.title}</span>
        <div className="hs-notif-meta muted">
          <OrgChip login={owner} avatarUrl={n.repository.owner.avatar_url} />
          {n.repository.full_name} · {n.reason.replace(/_/g, ' ')} · {relativeTime(n.updated_at)}
        </div>
      </div>
    </a>
  )
}
