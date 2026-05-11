import { useEffect, useState } from 'react'
import { fetchRepoDetail, type RepoDetail as RepoDetailT } from '../api/github'

type Props = {
  token: string
  owner: string
  name: string
  onClose: () => void
}

export function RepoDetail({ token, owner, name, onClose }: Props) {
  const [data, setData] = useState<RepoDetailT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    ;(async () => {
      try {
        const d = await fetchRepoDetail(token, owner, name)
        if (!cancelled) setData(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, owner, name])

  return (
    <aside className="detail">
      <header>
        <div>
          <h2>{owner}/{name}</h2>
          {data && (
            <a href={data.url} target="_blank" rel="noreferrer" className="muted">
              {data.url}
            </a>
          )}
        </div>
        <button onClick={onClose} aria-label="Cerrar">✕</button>
      </header>

      {error && <pre className="error-inline">{error}</pre>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <div className="detail-body">
          <Section title="Resumen">
<KV k="Description" v={data.description ?? '—'} />
            <KV k="Visibility" v={data.isPrivate ? 'Private' : 'Public'} />
            <KV k="Size" v={data.diskUsage != null ? `${(data.diskUsage / 1024).toFixed(1)} MB` : '—'} />
            <KV k="Stars / Forks / Watchers" v={`★ ${data.stargazerCount} · ⑂ ${data.forkCount} · 👁 ${data.watchers.totalCount}`} />
            <KV k="Default branch" v={data.defaultBranchRef?.name ?? '—'} />
            <KV k="Creado" v={fmtDate(data.createdAt)} />
            <KV k="Último push" v={fmtDate(data.pushedAt)} />
          </Section>

          {data.repositoryTopics.nodes.length > 0 && (
            <Section title="Topics">
              <div className="topics">
                {data.repositoryTopics.nodes.map((t) => (
                  <span key={t.topic.name} className="topic">{t.topic.name}</span>
                ))}
              </div>
            </Section>
          )}

          {data.languages.edges.length > 0 && (
            <Section title="Lenguajes">
              <div className="lang-bar">
                {data.languages.edges.map((e) => (
                  <span
                    key={e.node.name}
                    className="lang-seg"
                    title={`${e.node.name} · ${((e.size / data.languages.totalSize) * 100).toFixed(1)}%`}
                    style={{
                      width: `${(e.size / data.languages.totalSize) * 100}%`,
                      background: e.node.color ?? '#888'
                    }}
                  />
                ))}
              </div>
              <ul className="lang-list">
                {data.languages.edges.map((e) => (
                  <li key={e.node.name}>
                    <span className="dot" style={{ background: e.node.color ?? '#888' }} />
                    {e.node.name} <span className="muted">{((e.size / data.languages.totalSize) * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={`Últimos commits (${branchCommitsTotal(data) ?? 0})`}>
            {branchCommits(data).length === 0 ? (
              <p className="muted">No visible commits.</p>
            ) : (
              <ul className="commits">
                {branchCommits(data).map((c) => (
                  <li key={c.oid}>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <code>{c.oid.slice(0, 7)}</code>
                    </a>{' '}
                    {c.messageHeadline}
                    <div className="muted">
                      {c.author?.user?.login ?? c.author?.name ?? '—'} · {fmtDate(c.committedDate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {statusCheck(data) && (
              <p className="muted">
                CI status: <strong>{statusCheck(data)}</strong>
              </p>
            )}
          </Section>

          <Section title={`PRs abiertos (${data.pullRequests.totalCount})`}>
            {data.pullRequests.nodes.length === 0 ? (
              <p className="muted">No open PRs.</p>
            ) : (
              <ul className="items">
                {data.pullRequests.nodes.map((pr) => (
                  <li key={pr.number}>
                    <a href={pr.url} target="_blank" rel="noreferrer">
                      #{pr.number} {pr.title}
                    </a>
                    {pr.isDraft && <span className="badge">draft</span>}
                    <div className="muted">
                      {pr.author?.login ?? '—'} · actualizado {fmtDate(pr.updatedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Issues abiertos (${data.issues.totalCount})`}>
            {data.issues.nodes.length === 0 ? (
              <p className="muted">No open issues.</p>
            ) : (
              <ul className="items">
                {data.issues.nodes.map((it) => (
                  <li key={it.number}>
                    <a href={it.url} target="_blank" rel="noreferrer">
                      #{it.number} {it.title}
                    </a>
                    <div className="labels">
                      {it.labels.nodes.map((l) => (
                        <span
                          key={l.name}
                          className="label"
                          style={{ background: `#${l.color}33`, borderColor: `#${l.color}` }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                    <div className="muted">
                      {it.author?.login ?? '—'} · actualizado {fmtDate(it.updatedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Releases (${data.releases.totalCount})`}>
            {data.releases.nodes.length === 0 ? (
              <p className="muted">No releases.</p>
            ) : (
              <ul className="items">
                {data.releases.nodes.map((r) => (
                  <li key={r.tagName}>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.name ?? r.tagName}
                    </a>
                    {r.isPrerelease && <span className="badge">pre</span>}
                    <div className="muted">{r.publishedAt ? fmtDate(r.publishedAt) : 'sin publicar'}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Personas">
            <KV k="Mentionable users" v={data.mentionableUsers.totalCount} />
          </Section>

          <Section title="Datos crudos (debug)">
            <button onClick={() => setShowRaw((s) => !s)}>{showRaw ? 'Ocultar' : 'Ver'} JSON completo</button>
            {showRaw && <pre className="raw">{JSON.stringify(data, null, 2)}</pre>}
          </Section>
        </div>
      )}
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  )
}

function branchCommits(d: RepoDetailT) {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'history' in t) {
    return (t as { history: { nodes: { oid: string; messageHeadline: string; committedDate: string; url: string; author: { name: string | null; user: { login: string; avatarUrl: string } | null } | null }[] } }).history.nodes
  }
  return []
}

function branchCommitsTotal(d: RepoDetailT): number | null {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'history' in t) {
    return (t as { history: { totalCount: number } }).history.totalCount
  }
  return null
}

function statusCheck(d: RepoDetailT): string | null {
  const t = d.defaultBranchRef?.target
  if (t && '__typename' in t && t.__typename === 'Commit' && 'statusCheckRollup' in t) {
    return (t as { statusCheckRollup: { state: string } | null }).statusCheckRollup?.state ?? null
  }
  return null
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString()
}
