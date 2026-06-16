import { useMemo } from 'react'
import { FaGithub } from 'react-icons/fa'
import { SiSentry, SiVercel } from 'react-icons/si'
import { sentryConfigStore } from '../store/sentryConfig'
import { vercelConfigStore } from '../store/vercelConfig'
import { auth } from '../store/auth'
import { DEMO_TOKEN, DEMO_SENTRY_REPO_MAP, DEMO_VERCEL_PROJECTS } from '../api/demo-data'
import { repoFromProject } from '../api/vercel'

type Row = { repo: string; sentry: string | null; vercel: string | null }

/**
 * The cross-connector homologation: each repo and which Sentry project + Vercel
 * project map to it. Repos with both are the "full chain" — where a deploy can
 * be correlated to the errors it shipped (release-health, next).
 */
export function RelationshipsView() {
  const sentryMap = sentryConfigStore((s) => s.projectRepoMap)
  const vercelMap = vercelConfigStore((s) => s.projectRepoMap)
  const vercelNames = vercelConfigStore((s) => s.projectNames)

  const rows = useMemo<Row[]>(() => {
    const isDemo = auth.get() === DEMO_TOKEN
    const m = new Map<string, Row>()
    const add = (repo: string, key: 'sentry' | 'vercel', val: string) => {
      const k = repo.toLowerCase()
      const r = m.get(k) ?? { repo, sentry: null, vercel: null }
      r[key] = val
      r.repo = repo
      m.set(k, r)
    }

    const sentryEntries = isDemo && Object.keys(sentryMap).length === 0
      ? Object.entries(DEMO_SENTRY_REPO_MAP)
      : Object.entries(sentryMap)
    for (const [proj, repo] of sentryEntries) add(repo, 'sentry', proj)

    if (isDemo && Object.keys(vercelMap).length === 0) {
      for (const p of DEMO_VERCEL_PROJECTS) { const repo = repoFromProject(p); if (repo) add(repo, 'vercel', p.name) }
    } else {
      for (const [id, repo] of Object.entries(vercelMap)) add(repo, 'vercel', vercelNames[id] ?? id)
    }
    return [...m.values()].sort((a, b) => a.repo.localeCompare(b.repo))
  }, [sentryMap, vercelMap, vercelNames])

  const both = rows.filter((r) => r.sentry && r.vercel).length

  return (
    <section className="config-section">
      <div className="config-section-header">
        <h2>Relationships</h2>
        <span className="muted">
          How your repos line up across connectors. Auto-derived — Sentry from its code mappings,
          Vercel from each project's git link. The basis for correlating a deploy with the errors it shipped.
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="hs-empty">
          <strong>No links yet.</strong>
          Connect Sentry and/or Vercel in <em>Connectors</em> — devcompass auto-maps their projects to your GitHub repos.
        </div>
      ) : (
        <>
          <p className="muted rel-summary">
            {rows.length} repo{rows.length === 1 ? '' : 's'} linked · <strong className="rel-full-count">{both}</strong> with both Sentry + Vercel (full chain).
          </p>
          <table className="rel-table">
            <thead>
              <tr>
                <th><FaGithub /> Repo</th>
                <th><SiSentry /> Sentry</th>
                <th><SiVercel /> Vercel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.repo} className={r.sentry && r.vercel ? 'full' : ''}>
                  <td><a href={`https://github.com/${r.repo}`} target="_blank" rel="noopener noreferrer">{r.repo}</a></td>
                  <td>{r.sentry ?? <span className="muted">—</span>}</td>
                  <td>{r.vercel ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
