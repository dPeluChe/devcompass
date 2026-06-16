import type { Org, TokenInfo } from '../../api/github'

/** GitHub token diagnostics — type, scopes, visible orgs, expiry, and action-needed
 *  hints. Lives inside the GitHub connector card in the Connectors hub. */
export function GitHubAccessPanel({ tokenInfo, orgs }: { tokenInfo: TokenInfo; orgs: Org[] }) {
  const hasReadOrg = tokenInfo.scopes.includes('read:org') || tokenInfo.scopes.includes('admin:org')
  const missingReadOrg = tokenInfo.type === 'classic' && !hasReadOrg
  const noOrgs = orgs.length === 0
  const ssoIssue = !!tokenInfo.ssoRequired
  const hasIssue = missingReadOrg || ssoIssue || (noOrgs && tokenInfo.type === 'fine-grained')
  const ok = !hasIssue

  const expiryDate = tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt) : null
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86_400_000) : null
  const expiryLabel = expiryDate
    ? expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No expiry'
  const expiryWarn = daysLeft !== null && daysLeft <= 14

  return (
    <div className="token-panel">
      <div className="token-summary">
        <div className={`token-status ${ok ? 'ok' : 'warn'}`}>
          <span className="token-status-dot">{ok ? '●' : '⚠'}</span>
          <span>{ok ? 'Ready' : 'Needs review'}</span>
        </div>
        <div><span className="stat-value">{tokenInfo.type}</span><span className="stat-label">Token type</span></div>
        <div><span className="stat-value">{orgs.length}</span><span className="stat-label">Visible orgs</span></div>
        <div><span className="stat-value">{tokenInfo.scopes.length || '0'}</span><span className="stat-label">Scopes</span></div>
        <div title={expiryDate?.toISOString()}>
          <span className={`stat-value ${expiryWarn ? 'text-danger' : ''}`}>{daysLeft !== null ? `${daysLeft}d` : '∞'}</span>
          <span className={`stat-label ${expiryWarn ? 'text-danger' : ''}`}>{expiryDate ? `Expires ${expiryLabel}` : 'No expiry'}</span>
        </div>
      </div>

      <div className="token-block">
        <h3>Scopes</h3>
        {tokenInfo.scopes.length > 0
          ? <div className="diag-row">{tokenInfo.scopes.map((s) => <span key={s} className="diag-pill">{s}</span>)}</div>
          : <p className="muted">No scopes reported by GitHub for this token.</p>}
      </div>

      <div className="token-block">
        <h3>Organizations</h3>
        {orgs.length > 0
          ? <div className="diag-orgs">{orgs.map((o) => (
              <a key={o.login} href={o.url} target="_blank" rel="noreferrer" title={o.login}>
                <img src={o.avatarUrl} alt={o.login} width={20} height={20} /><span>{o.login}</span>
              </a>
            ))}</div>
          : <p className="muted">No organizations are visible with this token.</p>}
      </div>

      {hasIssue && (
        <div className="token-block">
          <h3>Action needed</h3>
          <ul className="diag-issues">
            {missingReadOrg && <li>PAT classic without <code>read:org</code> / <code>admin:org</code>. Edit at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">settings/tokens</a>.</li>}
            {tokenInfo.type === 'fine-grained' && noOrgs && <li>Fine-grained PATs only see approved orgs. Consider a classic with <code>repo</code> + <code>read:org</code>.</li>}
            {ssoIssue && <li>Missing SAML SSO authorization for some orgs. <a href={tokenInfo.ssoRequired!.url} target="_blank" rel="noreferrer">Authorize</a>.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
