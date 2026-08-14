import { useMemo } from 'react'
import { FaGithub } from 'react-icons/fa'
import { SiSentry, SiVercel } from 'react-icons/si'
import { MdHub } from 'react-icons/md'
import { sentryConfigStore } from '../store/sentryConfig'
import { vercelConfigStore } from '../store/vercelConfig'
import { auth } from '../store/auth'
import { DEMO_TOKEN, DEMO_SENTRY_REPO_MAP, DEMO_VERCEL_PROJECTS } from '../api/demo-data'
import { repoFromProject, prodUrlForProject, repoFromDeployment } from '../api/vercel'
import { useFailedDeploys } from './home/FailedDeploys'
import { EmptyState } from './home/EmptyState'

type Vercel = { name: string; url: string }
type Row = { repo: string; sentry: string | null; vercel: Vercel | null }

/**
 * The cross-connector homologation: each repo and which Sentry project + Vercel
 * project map to it. Repos with both are the "full chain" — where a deploy can
 * be correlated to the errors it shipped (release-health, next).
 */
export function RelationshipsView({ onGoNeeds }: { onGoNeeds?: () => void }) {
  const sentryMap = sentryConfigStore((s) => s.projectRepoMap)
  const vercelMap = vercelConfigStore((s) => s.projectRepoMap)
  const vercelNames = vercelConfigStore((s) => s.projectNames)
  const vercelUrls = vercelConfigStore((s) => s.projectUrls)

  // Per-repo alerts: a failing production deploy (lives in Needs me).
  const failedData = useFailedDeploys(auth.get() ?? '').data
  const failingRepos = useMemo(
    () => new Set((failedData ?? []).map((d) => repoFromDeployment(d)?.toLowerCase()).filter(Boolean) as string[]),
    [failedData]
  )

  const rows = useMemo<Row[]>(() => {
    const isDemo = auth.get() === DEMO_TOKEN
    const m = new Map<string, Row>()
    const get = (repo: string) => {
      const k = repo.toLowerCase()
      const r = m.get(k) ?? { repo, sentry: null, vercel: null }
      r.repo = repo
      m.set(k, r)
      return r
    }

    const sentryEntries = isDemo && Object.keys(sentryMap).length === 0
      ? Object.entries(DEMO_SENTRY_REPO_MAP)
      : Object.entries(sentryMap)
    for (const [proj, repo] of sentryEntries) get(repo).sentry = proj

    if (isDemo && Object.keys(vercelMap).length === 0) {
      for (const p of DEMO_VERCEL_PROJECTS) {
        const repo = repoFromProject(p)
        if (repo) get(repo).vercel = { name: p.name, url: prodUrlForProject(p) }
      }
    } else {
      for (const [id, repo] of Object.entries(vercelMap)) {
        get(repo).vercel = { name: vercelNames[id] ?? id, url: vercelUrls[id] ?? `https://${vercelNames[id] ?? id}.vercel.app` }
      }
    }
    return [...m.values()].sort((a, b) => a.repo.localeCompare(b.repo))
  }, [sentryMap, vercelMap, vercelNames, vercelUrls])

  const both = rows.filter((r) => r.sentry && r.vercel).length

  return (
    <section className="config-section">
      <div className="config-section-header">
        <h2>Relationships</h2>
        <span className="muted">
          How your repos line up across connectors. GitHub ↔ Vercel is auto-derived from each project's
          git link (fix it in Vercel, not here); only Sentry mappings are editable, in Connectors → Sentry.
          This is the basis for correlating a deploy with the errors it shipped.
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<MdHub size={48} />}
          title="No links yet."
          description="Connect Sentry and/or Vercel in Connectors — devcompass auto-maps their projects to your GitHub repos."
        />
      ) : (
        <>
          <p className="muted rel-summary">
            {rows.length} repo{rows.length === 1 ? '' : 's'} linked · <strong className="rel-full-count">{both}</strong> with both Sentry + Vercel (full chain).
          </p>
          <div className="rel-table-wrap">
          <table className="rel-table">
            <thead>
              <tr>
                <th><FaGithub /> Repo</th>
                <th><SiSentry /> Sentry</th>
                <th><SiVercel /> Vercel</th>
                <th>Alerts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const failing = failingRepos.has(r.repo.toLowerCase())
                return (
                  <tr key={r.repo} className={r.sentry && r.vercel ? 'full' : ''}>
                    <td><a href={`https://github.com/${r.repo}`} target="_blank" rel="noopener noreferrer">{r.repo}</a></td>
                    <td>{r.sentry ?? <span className="muted">—</span>}</td>
                    <td>
                      {r.vercel
                        ? <a href={r.vercel.url} target="_blank" rel="noopener noreferrer" title={r.vercel.url}>{r.vercel.name} <span className="rel-ext">↗</span></a>
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {failing
                        ? <button className="rel-alert" onClick={onGoNeeds} title="Failed production deploy — open Needs me">⚠ deploy</button>
                        : <span className="muted">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  )
}
