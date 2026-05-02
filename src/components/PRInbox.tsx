import { useEffect, useMemo, useState } from 'react'
import { searchPRs, type PullRequest, type Viewer } from '../api/github'

type Props = { token: string; viewer: Viewer }

export function PRInbox({ token, viewer }: Props) {
  const [authored, setAuthored] = useState<PullRequest[]>([])
  const [toReview, setToReview] = useState<PullRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [hideDrafts, setHideDrafts] = useState(false)
  const [showStale, setShowStale] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const me = viewer.login
        const [a, r] = await Promise.all([
          searchPRs(
            token,
            `is:pr is:open author:${me} archived:false sort:updated-desc`,
            100
          ),
          searchPRs(
            token,
            `is:pr is:open archived:false -author:${me} (review-requested:${me} OR assignee:${me}) sort:updated-desc`,
            100
          )
        ])
        if (cancelled) return
        setAuthored(a)
        setToReview(r)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, viewer.login])

  const filterFn = useMemo(() => {
    const q = search.toLowerCase().trim()
    return (p: PullRequest) => {
      if (hideDrafts && p.isDraft) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.repository.nameWithOwner.toLowerCase().includes(q) ||
        (p.author?.login ?? '').toLowerCase().includes(q)
      )
    }
  }, [search, hideDrafts])

  const filteredAuthored = useMemo(() => authored.filter(filterFn), [authored, filterFn])
  const filteredToReview = useMemo(() => toReview.filter(filterFn), [toReview, filterFn])

  return (
    <div className="inbox">
      <div className="inbox-controls">
        <input
          type="search"
          placeholder="Buscar título, repo, autor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          <input type="checkbox" checked={hideDrafts} onChange={(e) => setHideDrafts(e.target.checked)} />
          Ocultar drafts
        </label>
        <label>
          <input type="checkbox" checked={showStale} onChange={(e) => setShowStale(e.target.checked)} />
          Marcar stale (&gt;14d)
        </label>
      </div>

      {error && <pre className="error-inline">{error}</pre>}

      <div className="inbox-cols">
        <Column
          icon="🚀"
          title="Yo abrí"
          subtitle="PRs creados por mí"
          prs={filteredAuthored}
          totalCount={authored.length}
          loading={loading}
          emptyMsg="No tenés PRs abiertos."
          showStale={showStale}
          variant="authored"
        />
        <Column
          icon="👀"
          title="Para revisar"
          subtitle="Asignados o esperando mi review"
          prs={filteredToReview}
          totalCount={toReview.length}
          loading={loading}
          emptyMsg="Sin pendientes. Tomá un café."
          showStale={showStale}
          variant="review"
        />
      </div>
    </div>
  )
}

function Column({
  icon,
  title,
  subtitle,
  prs,
  totalCount,
  loading,
  emptyMsg,
  showStale,
  variant
}: {
  icon: string
  title: string
  subtitle: string
  prs: PullRequest[]
  totalCount: number
  loading: boolean
  emptyMsg: string
  showStale: boolean
  variant: 'authored' | 'review'
}) {
  return (
    <section className="col">
      <header className="col-header">
        <div>
          <h2>
            <span className="col-icon">{icon}</span> {title}
          </h2>
          <p className="muted">{subtitle}</p>
        </div>
        <span className="col-count">{prs.length}{prs.length !== totalCount && <span className="muted"> / {totalCount}</span>}</span>
      </header>

      {loading && <p className="muted">Cargando...</p>}
      {!loading && prs.length === 0 && <p className="empty muted">{emptyMsg}</p>}

      <ul className="pr-cards">
        {prs.map((pr) => (
          <PRCard key={pr.id} pr={pr} showStale={showStale} variant={variant} />
        ))}
      </ul>
    </section>
  )
}

function PRCard({ pr, showStale, variant }: { pr: PullRequest; showStale: boolean; variant: 'authored' | 'review' }) {
  const ageDays = (Date.now() - new Date(pr.updatedAt).getTime()) / 86_400_000
  const stale = showStale && ageDays > 14
  const ci = pr.ciState ?? 'NONE'

  return (
    <li className={`pr-card ${pr.isDraft ? 'draft' : ''} ${stale ? 'stale' : ''}`}>
      <div className="pr-card-top">
        <a href={pr.repository.url} target="_blank" rel="noreferrer" className="pr-repo">
          {pr.repository.nameWithOwner}
        </a>
        {stale && <span className="badge stale-badge" title={`${Math.round(ageDays)} días sin actualizar`}>stale</span>}
      </div>

      <a href={pr.url} target="_blank" rel="noreferrer" className="pr-card-title">
        <span className={`pr-state state-${ci.toLowerCase()}`} title={`CI: ${ci}`}>
          {ciIcon(ci)}
        </span>
        {pr.title}
      </a>

      <div className="pr-card-badges">
        {pr.isDraft && <span className="badge">draft</span>}
        {pr.reviewDecision === 'APPROVED' && <span className="badge ok">✓ approved</span>}
        {pr.reviewDecision === 'CHANGES_REQUESTED' && <span className="badge danger">⚠ changes</span>}
        {pr.reviewDecision === 'REVIEW_REQUIRED' && variant === 'review' && (
          <span className="badge warn">tu turno</span>
        )}
        {pr.labels.nodes.slice(0, 4).map((l) => (
          <span
            key={l.name}
            className="label"
            style={{ background: `#${l.color}33`, borderColor: `#${l.color}` }}
          >
            {l.name}
          </span>
        ))}
        {pr.labels.nodes.length > 4 && <span className="muted">+{pr.labels.nodes.length - 4}</span>}
      </div>

      <div className="pr-card-meta muted">
        <span>#{pr.number}</span>
        {variant === 'review' && pr.author && (
          <>
            <span>·</span>
            <span title={pr.author.login}>
              <img src={pr.author.avatarUrl} alt="" width={14} height={14} className="avatar-xs" /> {pr.author.login}
            </span>
          </>
        )}
        <span>·</span>
        <span title={pr.updatedAt}>{timeAgo(pr.updatedAt)}</span>
        <span>·</span>
        <span className="diff">
          <span className="add">+{pr.additions}</span>{' '}
          <span className="del">−{pr.deletions}</span>
        </span>
        <span>·</span>
        <span>{pr.changedFiles}f</span>
        {pr.comments.totalCount > 0 && (
          <>
            <span>·</span>
            <span>💬 {pr.comments.totalCount}</span>
          </>
        )}
      </div>
    </li>
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
