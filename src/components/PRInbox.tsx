import { useEffect, useMemo, useState } from 'react'
import { searchPRs, type PullRequest, type Viewer } from '../api/github'
import { PRDetail } from './PRDetail'

type Role = 'mine' | 'assigned' | 'review'
export type InboxFilter = 'all' | Role | 'failing' | 'stale'

type EnrichedPR = PullRequest & { roles: Role[] }

type SelectedPR = { owner: string; name: string; number: number }
type Props = {
  token: string
  viewer: Viewer
  initialSelected?: SelectedPR | null
  initialFilter?: InboxFilter
}

export function PRInbox({ token, viewer, initialSelected, initialFilter }: Props) {
  const [prs, setPrs] = useState<EnrichedPR[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [hideDrafts, setHideDrafts] = useState(false)
  const [showStale, setShowStale] = useState(true)
  const [roleFilter, setRoleFilter] = useState<InboxFilter>(initialFilter ?? 'review')

  const [selected, setSelected] = useState<SelectedPR | null>(initialSelected ?? null)

  useEffect(() => {
    if (initialSelected) setSelected(initialSelected)
  }, [initialSelected])

  // Allow Home KPIs to drive a fresh filter when navigating in. We only react
  // to non-null prop changes so manual filter clicks aren't overwritten.
  useEffect(() => {
    if (initialFilter) setRoleFilter(initialFilter)
  }, [initialFilter])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const me = viewer.login
        const [authored, assigned, review] = await Promise.all([
          searchPRs(token, `is:pr is:open author:${me} archived:false sort:updated-desc`, 100),
          searchPRs(token, `is:pr is:open assignee:${me} archived:false sort:updated-desc`, 100),
          searchPRs(token, `is:pr is:open review-requested:${me} archived:false sort:updated-desc`, 100)
        ])
        if (cancelled) return
        const merged = mergePRs(authored, assigned, review)
        setPrs(merged)
        // Auto-select first PR when arriving so the right pane has content.
        if (!initialSelected && merged.length > 0) {
          const first = merged[0]
          const [owner, name] = first.repository.nameWithOwner.split('/')
          setSelected({ owner, name, number: first.number })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, viewer.login, initialSelected])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return prs.filter((p) => {
      if (hideDrafts && p.isDraft) return false
      if (roleFilter === 'failing' && !isFailing(p)) return false
      else if (roleFilter === 'stale' && !isStale(p)) return false
      else if (roleFilter !== 'all' && roleFilter !== 'failing' && roleFilter !== 'stale' && !p.roles.includes(roleFilter)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.repository.nameWithOwner.toLowerCase().includes(q) ||
        (p.author?.login ?? '').toLowerCase().includes(q)
      )
    })
  }, [prs, search, hideDrafts, roleFilter])

  const counts = useMemo(() => {
    const c = { all: prs.length, mine: 0, assigned: 0, review: 0, failing: 0, stale: 0 }
    for (const p of prs) {
      if (p.roles.includes('mine')) c.mine++
      if (p.roles.includes('assigned')) c.assigned++
      if (p.roles.includes('review')) c.review++
      if (isFailing(p)) c.failing++
      if (isStale(p)) c.stale++
    }
    return c
  }, [prs])

  return (
    <div className="inbox-split">
      <aside className="inbox-list">
        <div className="inbox-controls">
          <input
            type="search"
            placeholder="Search title, repo, author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="role-filters inbox-tabs">
          <RolePill active={roleFilter === 'review'} onClick={() => setRoleFilter('review')} count={counts.review} label="Needs review" variant="review" />
          <RolePill active={roleFilter === 'assigned'} onClick={() => setRoleFilter('assigned')} count={counts.assigned} label="Assigned" variant="assigned" />
          <RolePill active={roleFilter === 'mine'} onClick={() => setRoleFilter('mine')} count={counts.mine} label="My PRs" variant="mine" />
          <RolePill active={roleFilter === 'failing'} onClick={() => setRoleFilter('failing')} count={counts.failing} label="Failing" />
          <RolePill active={roleFilter === 'stale'} onClick={() => setRoleFilter('stale')} count={counts.stale} label="Stale" />
          <RolePill active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} count={counts.all} label="All" />
        </div>
        <div className="inbox-toggles">
          <label>
            <input type="checkbox" checked={hideDrafts} onChange={(e) => setHideDrafts(e.target.checked)} />
            Hide drafts
          </label>
          <label>
            <input type="checkbox" checked={showStale} onChange={(e) => setShowStale(e.target.checked)} />
            Mark stale (&gt;14d)
          </label>
        </div>

        {error && <pre className="error-inline">{error}</pre>}
        {loading && <p className="muted">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="muted empty">No PRs in this view.</p>}

        <ul className="pr-cards">
          {filtered.map((pr) => (
            <PRCard
              key={pr.id}
              pr={pr}
              showStale={showStale}
              selected={isSelected(selected, pr)}
              onSelect={() => {
                const [owner, name] = pr.repository.nameWithOwner.split('/')
                setSelected({ owner, name, number: pr.number })
              }}
            />
          ))}
        </ul>
      </aside>

      <section className="inbox-detail">
        {selected ? (
          <PRDetail token={token} owner={selected.owner} name={selected.name} number={selected.number} />
        ) : (
          <div className="detail-empty muted">
            <p>Select a PR from the left to see details.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function isSelected(sel: { owner: string; name: string; number: number } | null, pr: PullRequest): boolean {
  if (!sel) return false
  return `${sel.owner}/${sel.name}` === pr.repository.nameWithOwner && sel.number === pr.number
}

function RolePill({
  active,
  onClick,
  count,
  label,
  variant
}: {
  active: boolean
  onClick: () => void
  count: number
  label: string
  variant?: Role
}) {
  return (
    <button className={`role-pill ${active ? 'active' : ''} ${variant ? `pill-${variant}` : ''}`} onClick={onClick}>
      {label} <span className="pill-count">{count}</span>
    </button>
  )
}

function PRCard({
  pr,
  showStale,
  selected,
  onSelect
}: {
  pr: EnrichedPR
  showStale: boolean
  selected: boolean
  onSelect: () => void
}) {
  const ageDays = (Date.now() - new Date(pr.updatedAt).getTime()) / 86_400_000
  const stale = showStale && ageDays > 14
  const ci = pr.ciState ?? 'NONE'
  const waiting = waitingOn(pr)

  return (
    <li
      className={`pr-card ${pr.isDraft ? 'draft' : ''} ${stale ? 'stale' : ''} ${selected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      title={pr.title}
    >
      <div className="pr-line-1">
        <span className={`pr-state state-${ci.toLowerCase()}`} title={`CI: ${ci}`}>{ciIcon(ci)}</span>
        <span className="pr-card-title-text">{pr.title}</span>
        <div className="role-badges">
          {pr.roles.includes('mine') && <span className="role-badge bg-mine" title="I created">🚀</span>}
          {pr.roles.includes('assigned') && <span className="role-badge bg-assigned" title="Assigned to me">👤</span>}
          {pr.roles.includes('review') && <span className="role-badge bg-review" title="Waiting for my review">👀</span>}
        </div>
      </div>

      <div className="pr-line-2 muted">
        <span className="pr-repo-inline">{pr.repository.nameWithOwner}</span>
        <span>#{pr.number}</span>
        <span title={pr.updatedAt}>{timeAgo(pr.updatedAt)}</span>
        <span className="diff">
          <span className="add">+{pr.additions}</span>{' '}
          <span className="del">−{pr.deletions}</span>
        </span>
        {pr.comments.totalCount > 0 && <span>💬 {pr.comments.totalCount}</span>}
        <span className={`mini-flag waiting waiting-${waiting.toLowerCase()}`}>waiting: {waiting}</span>
        {pr.isDraft && <span className="mini-flag">draft</span>}
        {stale && <span className="mini-flag warn">stale</span>}
        {pr.reviewDecision === 'APPROVED' && <span className="mini-flag ok">✓</span>}
        {pr.reviewDecision === 'CHANGES_REQUESTED' && <span className="mini-flag danger">⚠</span>}
      </div>
    </li>
  )
}

function isFailing(pr: PullRequest): boolean {
  return pr.ciState === 'FAILURE' || pr.ciState === 'ERROR'
}

function isStale(pr: PullRequest): boolean {
  return (Date.now() - new Date(pr.updatedAt).getTime()) / 86_400_000 > 14
}

function waitingOn(pr: EnrichedPR): 'YOU' | 'CI' | 'AUTHOR' | 'REVIEW' {
  if (pr.roles.includes('review')) return 'YOU'
  if (pr.ciState === 'PENDING' || pr.ciState === 'EXPECTED') return 'CI'
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'AUTHOR'
  return 'REVIEW'
}

function mergePRs(authored: PullRequest[], assigned: PullRequest[], review: PullRequest[]): EnrichedPR[] {
  const byId = new Map<string, EnrichedPR>()
  const tag = (list: PullRequest[], role: Role) => {
    for (const p of list) {
      const existing = byId.get(p.id)
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role)
      } else {
        byId.set(p.id, { ...p, roles: [role] })
      }
    }
  }
  tag(authored, 'mine')
  tag(assigned, 'assigned')
  tag(review, 'review')
  return Array.from(byId.values()).toSorted(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

function ciIcon(state: string): string {
  switch (state) {
    case 'SUCCESS':
      return '✓'
    case 'FAILURE':
    case 'ERROR':
      return '✕'
    case 'PENDING':
    case 'EXPECTED':
      return '⋯'
    default:
      return '○'
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo`
  return `${Math.floor(day / 365)}y`
}
