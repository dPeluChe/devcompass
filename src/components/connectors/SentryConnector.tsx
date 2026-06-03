import { useState } from 'react'
import { sentryConfigStore } from '../../store/sentryConfig'
import { fetchSentryIssues, type SentryIssue, type SentryIssueLevel } from '../../api/sentry'

const LEVEL_COLOR: Record<SentryIssueLevel, string> = {
  fatal: '#f55', error: '#f77', warning: '#e9a23b', info: '#5b9bd5', debug: '#888', sample: '#888',
}

export function SentryConnector() {
  const cfg = sentryConfigStore()
  const [issues, setIssues] = useState<SentryIssue[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadIssues() {
    setLoading(true)
    setError(null)
    setIssues(null)
    try {
      const { data } = await fetchSentryIssues(cfg.getAuth(), {
        orgSlug: cfg.orgSlug.trim(),
        environment: cfg.environment.trim(),
        query: 'is:unresolved',
      })
      setIssues(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
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

      <div className="connector-form">
        <label>
          <span>Auth token</span>
          <input
            type="password"
            placeholder="sntrys_… (Settings → Auth Tokens, scope org:read project:read event:read)"
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
          <button className="hs-modal-btn primary" onClick={loadIssues} disabled={loading || !cfg.isConfigured()}>
            {loading ? 'Loading…' : 'Load unresolved issues'}
          </button>
          {!cfg.isConfigured() && <span className="muted">Token + org slug required.</span>}
        </div>
      </div>

      {error && <div className="hs-status hs-status-err" style={{ marginTop: 12 }}>Failed: {error}</div>}

      {issues && (
        <div className="connector-results" style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 8 }}>
            {issues.length} issue{issues.length === 1 ? '' : 's'}
            {cfg.environment.trim() ? ` in @${cfg.environment.trim()}` : ' (all environments)'}
          </div>
          {issues.length === 0 ? (
            <span className="muted">No unresolved issues for this filter. 🎉</span>
          ) : (
            <ul className="connector-issue-list">
              {issues.map((iss) => (
                <li key={iss.id} className="connector-issue">
                  <span className="connector-issue-level" style={{ background: LEVEL_COLOR[iss.level] ?? '#888' }} title={iss.level}>
                    {iss.level}
                  </span>
                  <div className="connector-issue-main">
                    <a href={iss.permalink} target="_blank" rel="noopener noreferrer" className="connector-issue-title">
                      {iss.title}
                    </a>
                    <div className="connector-issue-meta muted">
                      <code>{iss.shortId}</code> · {iss.project.slug} · {iss.count} events · {iss.userCount} users
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
