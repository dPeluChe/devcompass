import { useState } from 'react'
import { sentryConfigStore } from '../../store/sentryConfig'
import {
  fetchSentryCodeMappings,
  fetchSentryIssues,
  fetchSentryOrgs,
  fetchSentryProjects,
  type SentryIssue,
  type SentryProject,
} from '../../api/sentry'
import { SentryIssueList } from './SentryIssueList'

type Validation = {
  orgSlugs: string[]
  projects: SentryProject[]
  /** project slug → linked GitHub repo ("owner/repo"), from Sentry code mappings. */
  repoBySlug: Record<string, string>
  mappingError: string | null
}

export function SentryConnector() {
  const cfg = sentryConfigStore()

  const [validating, setValidating] = useState(false)
  const [valError, setValError] = useState<string | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)

  const [issues, setIssues] = useState<SentryIssue[] | null>(null)
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [issuesError, setIssuesError] = useState<string | null>(null)

  async function validate() {
    setValidating(true)
    setValError(null)
    setValidation(null)
    try {
      const auth = cfg.getAuth()
      const org = cfg.orgSlug.trim()
      // token check + projects in parallel (independent calls).
      const [{ data: orgs }, { data: projects }] = await Promise.all([
        fetchSentryOrgs(auth),
        fetchSentryProjects(auth, org),
      ])
      // code mappings may need broader scope — fail independently.
      let repoBySlug: Record<string, string> = {}
      let mappingError: string | null = null
      try {
        const { data: mappings } = await fetchSentryCodeMappings(auth, org)
        for (const m of mappings) if (m.projectSlug && m.repoName) repoBySlug[m.projectSlug] = m.repoName
      } catch (e) {
        mappingError = e instanceof Error ? e.message : String(e)
        repoBySlug = {}
      }
      setValidation({ orgSlugs: orgs.map((o) => o.slug), projects, repoBySlug, mappingError })
      // Seed the homologation map. Read the live map (not the render-time closure)
      // so a concurrent edit isn't clobbered.
      if (Object.keys(repoBySlug).length) {
        const live = sentryConfigStore.getState().projectRepoMap
        sentryConfigStore.getState().update({ projectRepoMap: { ...live, ...repoBySlug } })
      }
    } catch (e) {
      setValError(e instanceof Error ? e.message : String(e))
    } finally {
      setValidating(false)
    }
  }

  async function loadIssues() {
    setLoadingIssues(true)
    setIssuesError(null)
    setIssues(null)
    try {
      const { data } = await fetchSentryIssues(cfg.getAuth(), {
        orgSlug: cfg.orgSlug.trim(),
        environment: cfg.environment.trim(),
        query: 'is:unresolved',
      })
      setIssues(data)
    } catch (e) {
      setIssuesError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingIssues(false)
    }
  }

  return (
    <section className="config-section">
      <div className="config-section-header">
        <h2>Sentry</h2>
        <span className="muted">
          BYO token, stays in your browser. Requests route through the same-origin
          relay (<code>/api/proxy</code>) since Sentry's API blocks direct browser calls.
        </span>
      </div>

      <details className="connector-help">
        <summary>How to get a Sentry auth token</summary>
        <ol>
          <li>
            Open <a href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank" rel="noopener noreferrer">
            sentry.io → User Auth Tokens ↗</a> (or <em>Organization</em> → Settings → Auth Tokens for an org token).
          </li>
          <li>Create a token with scopes <code>org:read</code>, <code>project:read</code>, <code>event:read</code> (read-only).</li>
          <li>Paste it below with your organization slug (the part in your Sentry URL: <code>sentry.io/organizations/<strong>your-org</strong>/</code>).</li>
        </ol>
        <p className="muted">
          You don't need to be an owner/admin — a <strong>member</strong> token can read issues for the
          projects you have access to. Project↔repo mappings may need broader org read; the validation
          below tells you exactly what your token can see.
        </p>
      </details>

      <div className="connector-form">
        <label>
          <span>Auth token</span>
          <input
            type="password"
            placeholder="sntryu_… / sntrys_…"
            value={cfg.token}
            onChange={(e) => cfg.update({ token: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          <span>Organization slug</span>
          <input
            type="text"
            placeholder="my-org"
            value={cfg.orgSlug}
            onChange={(e) => cfg.update({ orgSlug: e.target.value })}
          />
        </label>
        <div className="connector-form-row">
          <label>
            <span>Region</span>
            <select value={cfg.region} onChange={(e) => cfg.update({ region: e.target.value })}>
              <option value="">sentry.io (default)</option>
              <option value="us">us.sentry.io</option>
              <option value="de">de.sentry.io</option>
            </select>
          </label>
          <label>
            <span>Environment</span>
            <input
              type="text"
              placeholder="all"
              value={cfg.environment}
              onChange={(e) => cfg.update({ environment: e.target.value })}
            />
          </label>
        </div>
        <label>
          <span>Proxy endpoint <span className="muted">(self-host override)</span></span>
          <input
            type="text"
            placeholder="/api/proxy"
            value={cfg.proxyBase}
            onChange={(e) => cfg.update({ proxyBase: e.target.value })}
          />
        </label>

        <div className="connector-actions">
          <button className="hs-modal-btn primary" onClick={validate} disabled={validating || !cfg.isConfigured()}>
            {validating ? 'Validating…' : 'Validate connection'}
          </button>
          <button className="hs-modal-btn" onClick={loadIssues} disabled={loadingIssues || !cfg.isConfigured()}>
            {loadingIssues ? 'Loading…' : 'Load unresolved issues'}
          </button>
          {!cfg.isConfigured() && <span className="muted">Token + org slug required.</span>}
        </div>
      </div>

      {valError && <div className="hs-status hs-status-err" style={{ marginTop: 12 }}>Validation failed: {valError}</div>}

      {validation && (
        <div className="connector-results" style={{ marginTop: 12 }}>
          <div className="hs-status hs-status-ok" style={{ marginBottom: 10 }}>
            ✓ Token valid — {validation.orgSlugs.length} org{validation.orgSlugs.length === 1 ? '' : 's'} visible
            {validation.orgSlugs.length > 0 ? `: ${validation.orgSlugs.join(', ')}` : ''}
          </div>
          <div className="muted" style={{ marginBottom: 6 }}>
            {validation.projects.length} project{validation.projects.length === 1 ? '' : 's'} in @{cfg.orgSlug.trim()} · linked GitHub repo (Sentry code mappings):
          </div>
          {validation.mappingError && (
            <div className="muted" style={{ marginBottom: 6 }}>
              ⚠ Couldn't read code mappings ({validation.mappingError}). You can still map projects → repos manually later.
            </div>
          )}
          <ul className="connector-map-list">
            {validation.projects.map((p) => {
              const repo = validation.repoBySlug[p.slug]
              return (
                <li key={p.id} className="connector-map-row">
                  <span className="connector-map-project">{p.slug}</span>
                  <span className="connector-map-arrow">→</span>
                  {repo ? (
                    <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="connector-map-repo">
                      {repo}
                    </a>
                  ) : (
                    <span className="muted">no code mapping</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {issuesError && <div className="hs-status hs-status-err" style={{ marginTop: 12 }}>Failed: {issuesError}</div>}

      {issues && (
        <div className="connector-results" style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            {issues.length} issue{issues.length === 1 ? '' : 's'}
            {cfg.environment.trim() ? ` in @${cfg.environment.trim()}` : ' (all environments)'}
          </div>
          {issues.length === 0 ? (
            <span className="muted">No unresolved issues for this filter. 🎉</span>
          ) : (
            <SentryIssueList issues={issues} />
          )}
        </div>
      )}
    </section>
  )
}
