import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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

type Async<T> = { loading: boolean; error: string | null; data: T | null }
const idle = { loading: false, error: null, data: null }

// Auth failures are the common first-run snag — point at the likely causes.
function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/\b40[13]\b/.test(msg)) {
    return `${msg}\n→ Use a User Auth Token (Account → Auth Tokens), not an Organization token — org tokens are scoped for CI and can't read your projects/orgs. Token needs org:read · project:read · event:read. EU orgs must select the "de" region.`
  }
  return msg
}

export function SentryConnector() {
  const cfg = sentryConfigStore()
  const queryClient = useQueryClient()

  const [val, setVal] = useState<Async<Validation>>(idle)
  const [iss, setIss] = useState<Async<SentryIssue[]>>(idle)

  async function validate() {
    setVal({ loading: true, error: null, data: null })
    try {
      const auth = cfg.getAuth()
      const org = cfg.orgSlug.trim()
      // Projects is the primary validity check — works with both User and
      // Organization auth tokens (needs project:read / org:read).
      const { data: projects } = await fetchSentryProjects(auth, org)
      // Listing all orgs needs a User token (org tokens are bound to one org),
      // so it's best-effort and never blocks validation.
      let orgSlugs: string[] = [org]
      try {
        const { data: orgs } = await fetchSentryOrgs(auth)
        if (orgs.length) orgSlugs = orgs.map((o) => o.slug)
      } catch { /* org-scoped token can't list orgs — fine */ }
      // code mappings may need broader scope — fail independently.
      const repoBySlug: Record<string, string> = {}
      let mappingError: string | null = null
      try {
        const { data: mappings } = await fetchSentryCodeMappings(auth, org)
        for (const m of mappings) if (m.projectSlug && m.repoName) repoBySlug[m.projectSlug] = m.repoName
      } catch (e) {
        mappingError = e instanceof Error ? e.message : String(e)
      }
      // Seed the homologation map from the live store (not the render closure).
      if (Object.keys(repoBySlug).length) {
        const live = sentryConfigStore.getState().projectRepoMap
        sentryConfigStore.getState().update({ projectRepoMap: { ...live, ...repoBySlug } })
      }
      // Creds just (re)confirmed — drop cached Sentry queries so repo-detail tabs
      // refetch with the current token/region instead of stale data.
      queryClient.invalidateQueries({ queryKey: ['sentry'] })
      setVal({ loading: false, error: null, data: { orgSlugs, projects, repoBySlug, mappingError } })
    } catch (e) {
      setVal({ loading: false, error: describeError(e), data: null })
    }
  }

  async function loadIssues() {
    setIss({ loading: true, error: null, data: null })
    try {
      const { data } = await fetchSentryIssues(cfg.getAuth(), {
        orgSlug: cfg.orgSlug.trim(),
        environment: cfg.environment.trim(),
        query: 'is:unresolved',
      })
      setIss({ loading: false, error: null, data })
    } catch (e) {
      setIss({ loading: false, error: describeError(e), data: null })
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
            sentry.io → User Auth Tokens ↗</a> (<strong>User</strong> settings → Auth Tokens).
          </li>
          <li>Create a token with scopes <code>org:read</code>, <code>project:read</code>, <code>event:read</code> (read-only).</li>
          <li>Paste it below with your organization slug (the part in your Sentry URL: <code>your-org.sentry.io</code> → <strong>your-org</strong>).</li>
        </ol>
        <p className="muted">
          ⚠ Use a <strong>User</strong> Auth Token, <em>not</em> an <strong>Organization</strong> token
          (Developer Settings → Organization Tokens). Org tokens are scoped for CI and can't list your
          orgs or read projects → 403. A regular <strong>member</strong> user token works — no
          owner/admin needed. <strong>EU</strong> orgs must pick the <code>de</code> region.
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
          <button className="hs-modal-btn primary" onClick={validate} disabled={val.loading || !cfg.isConfigured()}>
            {val.loading ? 'Validating…' : 'Validate connection'}
          </button>
          <button className="hs-modal-btn" onClick={loadIssues} disabled={iss.loading || !cfg.isConfigured()}>
            {iss.loading ? 'Loading…' : 'Load unresolved issues'}
          </button>
          {!cfg.isConfigured() && <span className="muted">Token + org slug required.</span>}
        </div>
      </div>

      {val.error && <div className="hs-status hs-status-err" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>Validation failed: {val.error}</div>}

      {val.data && (
        <div className="connector-results" style={{ marginTop: 12 }}>
          <div className="hs-status hs-status-ok" style={{ marginBottom: 10 }}>
            ✓ Token valid — {val.data.orgSlugs.length} org{val.data.orgSlugs.length === 1 ? '' : 's'} visible
            {val.data.orgSlugs.length > 0 ? `: ${val.data.orgSlugs.join(', ')}` : ''}
          </div>
          <div className="muted" style={{ marginBottom: 6 }}>
            {val.data.projects.length} project{val.data.projects.length === 1 ? '' : 's'} in @{cfg.orgSlug.trim()} · linked GitHub repo (Sentry code mappings):
          </div>
          {val.data.mappingError && (
            <div className="muted" style={{ marginBottom: 6 }}>
              ⚠ Couldn't read code mappings ({val.data.mappingError}). You can still map projects → repos manually later.
            </div>
          )}
          <ul className="connector-map-list">
            {val.data.projects.map((p) => {
              const repo = val.data!.repoBySlug[p.slug]
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

      {iss.error && <div className="hs-status hs-status-err" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>Failed: {iss.error}</div>}

      {iss.data && (
        <div className="connector-results" style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            {iss.data.length} issue{iss.data.length === 1 ? '' : 's'}
            {cfg.environment.trim() ? ` in @${cfg.environment.trim()}` : ' (all environments)'}
          </div>
          {iss.data.length === 0 ? (
            <span className="muted">No unresolved issues for this filter. 🎉</span>
          ) : (
            <SentryIssueList issues={iss.data} />
          )}
        </div>
      )}
    </section>
  )
}
