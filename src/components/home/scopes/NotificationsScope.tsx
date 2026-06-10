import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markAllNotificationsRead, markNotificationRead, notificationWebUrl, type GitHubNotification } from '../../../api/github'
import { relativeTime } from '../../../utils/time'
import { queryKeys } from '../../../store/queries'
import { OrgChip } from '../OrgChip'
import { useNotifications, NOTIFICATIONS_LIMIT, persistNotificationsCache } from '../useNotifications'
import { GitHubIssueModal, type GitHubIssueRef } from '../GitHubIssueModal'
import { Header, ScopeSkeleton, type ScopeProps } from './common'
import type { AttentionItem, DotLevel } from '../types'

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

/** PR/issue number from the subject's API URL (…/pulls/4721 | …/issues/92). */
function subjectNumber(n: GitHubNotification): number | null {
  const m = n.subject.url?.match(/\/(?:pulls|issues)\/(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}

/** Minimal AttentionItem so a PR notification can open the in-app DetailModal. */
function toAttentionItem(n: GitHubNotification, number: number): AttentionItem {
  const [org, repo = ''] = n.repository.full_name.split('/')
  return {
    id: `notif:${n.id}`,
    org,
    orgAvatarUrl: n.repository.owner.avatar_url,
    repo,
    nameWithOwner: n.repository.full_name,
    number,
    title: n.subject.title,
    url: `https://github.com/${n.repository.full_name}/pull/${number}`,
    isDraft: false,
    updatedAt: n.updated_at,
    ciState: null,
    reviewDecision: null,
    author: null,
    reasons: [],
    dot: REASON_DOT[n.reason] ?? 'info',
  }
}

export function NotificationsScope({ token, onOpenItem }: ScopeProps) {
  const { data, isLoading, error } = useNotifications(token)
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [openIssue, setOpenIssue] = useState<GitHubIssueRef | null>(null)

  // Mark-as-read drops the row from the unread list optimistically — the cache
  // IS the unread set, so removal is the truthful post-mutation state. The IDB
  // pref is updated too so a reload within TTL doesn't resurrect read rows.
  function dropFromCaches(predicate: (n: GitHubNotification) => boolean) {
    const next = (queryClient.getQueryData<GitHubNotification[]>(queryKeys.notifications) ?? []).filter(predicate)
    queryClient.setQueryData(queryKeys.notifications, next)
    persistNotificationsCache(token, next)
  }
  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(token, id),
    onMutate: (id) => dropFromCaches((n) => n.id !== id),
    onError: (e) => setActionError(e instanceof Error ? e.message : String(e)),
  })
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onMutate: () => dropFromCaches(() => false),
    onError: (e) => setActionError(e instanceof Error ? e.message : String(e)),
  })

  const q = filter.trim().toLowerCase()
  const filtered = useMemo(
    () => (data ?? []).filter((n) => !q || n.subject.title.toLowerCase().includes(q) || n.repository.full_name.toLowerCase().includes(q)),
    [data, q]
  )

  // Group by repo, each group ordered by recency, groups ordered by their most
  // recent notification.
  const groups = useMemo(() => {
    const m = new Map<string, { owner: string; avatarUrl: string; items: GitHubNotification[] }>()
    for (const n of filtered) {
      const key = n.repository.full_name
      const g = m.get(key)
      if (g) g.items.push(n)
      else m.set(key, { owner: n.repository.owner.login, avatarUrl: n.repository.owner.avatar_url, items: [n] })
    }
    const recency = (ns: GitHubNotification[]) => Math.max(...ns.map((n) => new Date(n.updated_at).getTime()))
    for (const g of m.values()) g.items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return [...m.entries()].sort((a, b) => recency(b[1].items) - recency(a[1].items))
  }, [filtered])

  const total = data?.length ?? 0

  // Open in-app when we can (PRs → DetailModal, issues → issue modal);
  // everything else falls back to GitHub.
  function openNotification(n: GitHubNotification) {
    const number = subjectNumber(n)
    if (number && n.subject.type === 'PullRequest') {
      onOpenItem(toAttentionItem(n, number))
      return
    }
    if (number && n.subject.type === 'Issue') {
      const [owner, name = ''] = n.repository.full_name.split('/')
      setOpenIssue({ token, owner, name, number })
      return
    }
    window.open(notificationWebUrl(n), '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="hs-main">
      <div className="hs-notif-headrow">
        <Header title="Notifications" count={total} meta="unread · everything that involves you, across all repos" />
        {total > 0 && (
          <button className="hs-modal-btn" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            {markAll.isPending ? 'Marking…' : '✓ Mark all read'}
          </button>
        )}
      </div>

      {actionError && <p className="hs-truncation-note" style={{ color: 'var(--danger)' }}>{actionError}</p>}

      {total >= NOTIFICATIONS_LIMIT && (
        <p className="hs-truncation-note muted">
          Showing the {NOTIFICATIONS_LIMIT} most recent — there may be more on GitHub.
        </p>
      )}

      {total > 8 && (
        <input
          className="hs-scope-filter"
          placeholder="Filter by title or repo…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}

      {isLoading && <ScopeSkeleton />}
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
      {!isLoading && total > 0 && filtered.length === 0 && (
        <div className="hs-empty"><strong>No matches for “{filter.trim()}”.</strong></div>
      )}

      {groups.map(([fullName, group]) => (
        <section key={fullName} className="hs-issue-group">
          <h3 className="hs-issue-group-head">
            <OrgChip login={group.owner} avatarUrl={group.avatarUrl} />
            <a href={`https://github.com/${fullName}`} target="_blank" rel="noopener noreferrer">{fullName}</a>
            <span className="muted"> · {group.items.length}</span>
          </h3>
          <div className="hs-surface">
            {group.items.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={() => openNotification(n)}
                onMarkRead={() => markOne.mutate(n.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <GitHubIssueModal issue={openIssue} onClose={() => setOpenIssue(null)} />
    </main>
  )
}

function NotificationRow({ n, onOpen, onMarkRead }: { n: GitHubNotification; onOpen: () => void; onMarkRead: () => void }) {
  return (
    <div
      className="hs-notif-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <span className={`hs-dot ${REASON_DOT[n.reason] ?? 'info'}`} />
      <span className="hs-notif-glyph" title={n.subject.type}>{SUBJECT_GLYPH[n.subject.type] ?? '•'}</span>
      <div className="hs-notif-main">
        <span className="hs-notif-title">{n.subject.title}</span>
        <div className="hs-notif-meta muted">{n.reason.replace(/_/g, ' ')} · {relativeTime(n.updated_at)}</div>
      </div>
      <a
        className="hs-issue-ext"
        href={notificationWebUrl(n)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on GitHub"
        onClick={(e) => e.stopPropagation()}
      >↗</a>
      <button
        className="hs-notif-read"
        title="Mark as read"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead() }}
      >✓</button>
    </div>
  )
}
