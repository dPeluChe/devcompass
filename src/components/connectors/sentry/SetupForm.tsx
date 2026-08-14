import { sentryConfigStore, validateSentryTokenFormat } from '../../../store/sentryConfig'

// Auth failures are the common first-run snag — point at the likely causes.
export function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/\b40[13]\b/.test(msg)) {
    return `${msg}\n→ Use a User Auth Token (Account → Auth Tokens), not an Organization token — org tokens are scoped for CI and can't read your projects/orgs. Token needs org:read · project:read · event:read. EU orgs must select the "de" region.`
  }
  return msg
}

export function SetupForm({
  connecting, connectError, orgChoices, canCancel, onCancel, onConnect,
}: {
  connecting: boolean
  connectError: string | null
  orgChoices: string[]
  canCancel: boolean
  onCancel: () => void
  onConnect: () => void
}) {
  const cfg = sentryConfigStore()
  const tokenCheck = validateSentryTokenFormat(cfg.token)
  return (
    <>
      <details className="connector-help">
        <summary>How to get a Sentry auth token</summary>
        <ol>
          <li>
            Open <a href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank" rel="noopener noreferrer">
            sentry.io → User Auth Tokens ↗</a> (<strong>User</strong> settings → Auth Tokens).
          </li>
          <li>Create a token with permissions <code>Project</code>, <code>Issue &amp; Event</code> and <code>Organization</code> set to <strong>Read</strong> (preview must list <code>project:read event:read org:read</code> — not <code>—</code>).</li>
          <li>Paste it below with your organization slug (<code>your-org.sentry.io</code> → <strong>your-org</strong>).</li>
        </ol>
        <p className="muted">
          ⚠ Use a <strong>User</strong> Auth Token, <em>not</em> an <strong>Organization</strong> token —
          org tokens are scoped for CI and 403 here. A regular <strong>member</strong> token works.
          <strong>EU</strong> orgs must pick the <code>de</code> region.
        </p>
      </details>

      <div className="connector-form">
        <label>
          <span>Auth token</span>
          <input
            type="password"
            placeholder="sntryu_…"
            value={cfg.token}
            onChange={(e) => cfg.update({ token: e.target.value })}
            autoComplete="off"
            aria-invalid={tokenCheck.warning ? true : undefined}
          />
          {tokenCheck.warning && <span className="connector-field-hint warn">{tokenCheck.warning}</span>}
        </label>
        <label>
          <span>Organization slug</span>
          <input
            type="text"
            list="devcompass-sentry-orgs"
            placeholder="my-org"
            value={cfg.orgSlug}
            onChange={(e) => cfg.update({ orgSlug: e.target.value })}
          />
          <datalist id="devcompass-sentry-orgs">
            {orgChoices.map((o) => <option key={o} value={o} />)}
          </datalist>
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
            <span>Environment <span className="muted">(leave empty = all)</span></span>
            <input
              type="text"
              placeholder="all environments"
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
          <button
            className="hs-modal-btn primary"
            onClick={onConnect}
            disabled={connecting || !cfg.token.trim() || !cfg.orgSlug.trim()}
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
          {canCancel && <button className="hs-modal-btn" onClick={onCancel}>Cancel</button>}
          {(!cfg.token.trim() || !cfg.orgSlug.trim()) && <span className="muted">Token + org slug required.</span>}
        </div>
      </div>

      {connectError && <div className="hs-status hs-status-err" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>Connection failed: {connectError}</div>}
    </>
  )
}
