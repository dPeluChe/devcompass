import { db, type StorageBreakdown } from '../../store/db'

function timeAgo(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return `${Math.floor(day / 30)}mo ago`
}

/**
 * Cache tab — groups the prefs-table entries (per-API response caches)
 * by what they belong to and lets the user evict individual rows.
 */
type CacheGroup = {
  title: string
  ttl: string
  prefix: string
  /** Override the per-row label. Used to mask the token-as-discriminator
   *  for session-level caches so it never renders to the DOM. */
  rowLabel?: (sub: string) => string
  /** Visual emphasis: per-resource caches (PR detail, Branches) get a
   *  brighter card border so they stand out from session singletons. */
  emphasis?: 'primary' | 'session'
  /** Short helper line under the title to remind why we cache this. */
  blurb?: string
}

export function CachePanel({ breakdown, onChange }: { breakdown: StorageBreakdown; onChange: () => void }) {
  const groups: CacheGroup[] = [
    // Per-resource caches: change as the user navigates; one entry per repo / PR.
    {
      title: 'PR detail',
      ttl: '15m',
      prefix: 'prDetail:',
      emphasis: 'primary',
      blurb: 'Each open of a PR detail modal — keyed by owner/repo/#PR.'
    },
    {
      title: 'Branches',
      ttl: '15m',
      prefix: 'branches:',
      emphasis: 'primary',
      blurb: 'Branch list for each repo opened from the Repos grid.'
    },
    {
      title: 'Contribution calendar',
      ttl: '12h',
      prefix: 'contrib:',
      emphasis: 'primary',
      blurb: 'Viewer contribution heatmap powering Digest. Cached long because daily activity changes slowly.'
    },
    {
      title: 'Since-last-visit snapshot',
      ttl: '∞',
      prefix: 'visit:',
      blurb: 'Baseline that powers the Home → Since last visit feed.'
    },
    // Session-level singletons: one entry per token. The token is the
    // discriminator — never show it.
    {
      title: '/user/orgs',
      ttl: '1h',
      prefix: 'userOrgs:',
      emphasis: 'session',
      rowLabel: () => 'current session',
      blurb: 'REST list of orgs the viewer belongs to.'
    },
    {
      title: 'Viewer (login + memberships)',
      ttl: '1h',
      prefix: 'viewer:',
      emphasis: 'session',
      rowLabel: () => 'current session',
      blurb: 'GraphQL viewer query — login, avatar, viewer.organizations.'
    },
    {
      title: 'Token info (scopes, SSO)',
      ttl: '1h',
      prefix: 'tokenInfo:',
      emphasis: 'session',
      rowLabel: () => 'current session',
      blurb: 'X-OAuth-Scopes + X-GitHub-SSO from /user response headers.'
    }
  ]

  async function deleteEntry(key: string) {
    await db.prefs.delete(key)
    onChange()
  }

  async function deleteGroup(prefix: string) {
    const matching = breakdown.prefKeys.filter((p) => p.key.startsWith(prefix)).map((p) => p.key)
    if (matching.length === 0) return
    await db.prefs.bulkDelete(matching)
    onChange()
  }

  return (
    <section>
      <h2>API response cache</h2>
      <p className="muted storage-blurb">
        Each row below is an API call this app made and saved to IndexedDB so
        the next request can be served locally. TTL is the freshness window —
        after that the cache entry is ignored and a fresh call goes out.
        Delete a row to force the next request to re-fetch.
      </p>

      {groups.map((g) => {
        const rows = breakdown.prefKeys.filter((p) => p.key.startsWith(g.prefix))
        const emphasisClass = g.emphasis ? `cache-group--${g.emphasis}` : ''
        return (
          <div key={g.prefix} className={`cache-group ${emphasisClass}`}>
            <div className="cache-group-head">
              <span className="cache-group-title">
                <strong>{g.title}</strong>
                <span className="cache-group-ttl">TTL {g.ttl}</span>
                <span className="muted">· {rows.length} cached</span>
              </span>
              {rows.length > 0 && (
                <button className="cache-group-clear" onClick={() => deleteGroup(g.prefix)}>
                  Clear group
                </button>
              )}
            </div>
            {g.blurb && <div className="cache-group-blurb muted">{g.blurb}</div>}
            {rows.length === 0 ? (
              <div className="cache-group-empty muted">No entries.</div>
            ) : (
              <div className="cache-chip-list">
                {rows.map((r) => {
                  const sub = r.key.slice(g.prefix.length)
                  const label = g.rowLabel ? g.rowLabel(sub) : sub
                  return (
                    <span key={r.key} className="cache-chip" title={`cached ${timeAgo(r.updatedAt)} — click × to evict`}>
                      <code className="cache-chip-key">{label || '(default)'}</code>
                      <span className="cache-chip-time muted">{timeAgo(r.updatedAt)}</span>
                      <button
                        className="cache-chip-delete"
                        aria-label="Evict from cache"
                        onClick={() => deleteEntry(r.key)}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
