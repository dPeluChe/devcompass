import { FaTag } from 'react-icons/fa'
import type { RepoDetail as RepoDetailT } from '../../api/github'
import { EmptyState } from './common'
import { shortAgo } from './utils'

export function IssuesTab({ data }: { data: RepoDetailT }) {
  if (data.issues.nodes.length === 0) return <EmptyState label="No open issues." />
  return (
    <section className="hs-surface rd-list">
      {data.issues.nodes.map((it) => (
        <a key={it.number} className="rd-row" href={it.url} target="_blank" rel="noreferrer">
          <span className="rd-pr-num">#{it.number}</span>
          <div className="rd-row-main">
            <div className="rd-row-title">{it.title}</div>
            <div className="rd-row-meta muted">
              {it.labels.nodes.length > 0 && (
                <span className="rd-labels">
                  {it.labels.nodes.map((l) => (
                    <span
                      key={l.name}
                      className="rd-label"
                      style={{ background: `#${l.color}26`, borderColor: `#${l.color}` }}
                    >
                      {l.name}
                    </span>
                  ))}
                </span>
              )}
              <span>{it.author?.login ?? 'unknown'} · updated {shortAgo(it.updatedAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </section>
  )
}

export function ReleasesTab({ data }: { data: RepoDetailT }) {
  if (data.releases.nodes.length === 0) return <EmptyState label="No releases." />
  return (
    <section className="hs-surface rd-list">
      {data.releases.nodes.map((r) => (
        <a key={r.tagName} className="rd-row" href={r.url} target="_blank" rel="noreferrer">
          <span className="rd-row-icon"><FaTag size={11} /></span>
          <div className="rd-row-main">
            <div className="rd-row-title">
              {r.name ?? r.tagName}
              {r.isPrerelease && <span className="rd-tag">pre-release</span>}
            </div>
            <div className="rd-row-meta muted">
              {r.tagName} · {r.publishedAt ? `published ${shortAgo(r.publishedAt)}` : 'unpublished'}
            </div>
          </div>
        </a>
      ))}
    </section>
  )
}
