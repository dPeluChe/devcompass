import { useMemo, useState } from 'react'
import type { Org, Repo, TokenInfo } from '../api/github'
import { auth } from '../store/auth'
import { sentryConfigStore } from '../store/sentryConfig'
import { OrgManager } from './OrgManager'
import { SettingsTab } from './SettingsTab'
import { SentryConnector } from './connectors/SentryConnector'

export function ConfigView({
  tokenInfo,
  orgs,
  repos,
  errors,
  onForceResync
}: {
  tokenInfo: TokenInfo | undefined
  orgs: Org[]
  repos: Repo[]
  errors: { source: string; message: string }[]
  onForceResync: () => void
}) {
  const [section, setSection] = useState<'orgs' | 'tokens' | 'token' | 'connectors' | 'storage' | 'cache' | 'pinned' | 'appearance'>('orgs')

  // Collaborator-only orgs: own at least one repo that arrived via the viewer's
  // COLLABORATOR affiliation but aren't in viewer.organizations / /user/orgs.
  const collaboratorOrgs = useMemo(() => {
    const memberSet = new Set(orgs.map((o) => o.login))
    const counts = new Map<string, { count: number; avatarUrl: string }>()
    for (const r of repos) {
      if (memberSet.has(r.owner.login)) continue
      const cur = counts.get(r.owner.login)
      if (cur) cur.count += 1
      else counts.set(r.owner.login, { count: 1, avatarUrl: r.owner.avatarUrl })
    }
    return Array.from(counts.entries())
      .map(([login, v]) => ({ login, count: v.count, avatarUrl: v.avatarUrl }))
      .toSorted((a, b) => b.count - a.count || a.login.localeCompare(b.login))
  }, [orgs, repos])

  return (
    <main className="hs-main config-view">
      <div className="config-tabs">
        <button className={`config-tab ${section === 'orgs' ? 'active' : ''}`} onClick={() => setSection('orgs')}>
          Orgs
        </button>
        <button className={`config-tab ${section === 'tokens' ? 'active' : ''}`} onClick={() => setSection('tokens')}>
          Tokens
        </button>
        <button className={`config-tab ${section === 'token' ? 'active' : ''}`} onClick={() => setSection('token')}>
          GitHub access
        </button>
        <button className={`config-tab ${section === 'connectors' ? 'active' : ''}`} onClick={() => setSection('connectors')}>
          Connectors
        </button>
        <button className={`config-tab ${section === 'storage' ? 'active' : ''}`} onClick={() => setSection('storage')}>
          Storage
        </button>
        <button className={`config-tab ${section === 'cache' ? 'active' : ''}`} onClick={() => setSection('cache')}>
          Cache
        </button>
        <button className={`config-tab ${section === 'pinned' ? 'active' : ''}`} onClick={() => setSection('pinned')}>
          Pinned
        </button>
        <button className={`config-tab ${section === 'appearance' ? 'active' : ''}`} onClick={() => setSection('appearance')}>
          Appearance
        </button>
      </div>

      <div className="config-panel">
        {section === 'orgs' && (
          <section className="config-section">
            <div className="config-section-header">
              <h2>Organizations</h2>
              <span className="muted">Choose which orgs are available and synced.</span>
            </div>
            <OrgManager orgs={orgs} variant="inline" />

            {collaboratorOrgs.length > 0 && (
              <div className="config-collab-block">
                <div className="config-section-header" style={{ marginTop: 18 }}>
                  <h3>Collaborator orgs</h3>
                  <span className="muted">
                    You have repo access here but aren't a formal member.
                    Their repos sync as part of your own viewer affiliation —
                    no separate toggle.
                  </span>
                </div>
                <ul className="config-collab-list">
                  {collaboratorOrgs.map((c) => (
                    <li key={c.login}>
                      <img src={c.avatarUrl} alt="" />
                      <strong>{c.login}</strong>
                      <span className="muted">{c.count} repo{c.count === 1 ? '' : 's'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {section === 'tokens' && (
          <TokensSection
            tokenInfo={tokenInfo}
            onGoGithubAccess={() => setSection('token')}
            onGoConnectors={() => setSection('connectors')}
          />
        )}

        {section === 'token' && tokenInfo && (
          <section className="config-section">
            <div className="config-section-header">
              <h2>Token access</h2>
              <span className="muted">Scopes, SSO and org visibility.</span>
            </div>
            <TokenAccessPanel tokenInfo={tokenInfo} orgs={orgs} />
            {errors.length > 0 && (
              <details className="partial-errors" open>
                <summary>{errors.length} sync errors</summary>
                <ul>
                  {errors.map((e) => (
                    <li key={e.source}>
                      <strong>{e.source}:</strong> {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {section === 'token' && !tokenInfo && (
          <section className="config-section">
            <p className="muted">Token information is still loading.</p>
          </section>
        )}

        {section === 'connectors' && <SentryConnector repos={repos} />}

        {section === 'storage' && <SettingsTab panel="storage" onForceResync={onForceResync} />}
        {section === 'cache' && <SettingsTab panel="cache" onForceResync={onForceResync} />}
        {section === 'pinned' && <SettingsTab panel="pinned" />}
        {section === 'appearance' && <SettingsTab panel="appearance" />}
      </div>
    </main>
  )
}

function maskToken(t: string): string {
  const v = t.trim()
  if (!v) return '—'
  return v.length > 12 ? `${v.slice(0, 7)}…${v.slice(-4)}` : '••••••'
}

/** Consolidated credentials registry — what devcompass holds + links to create/rotate. */
function TokensSection({ tokenInfo, onGoGithubAccess, onGoConnectors }: {
  tokenInfo: TokenInfo | undefined
  onGoGithubAccess: () => void
  onGoConnectors: () => void
}) {
  const ghToken = auth.get() ?? ''
  const sentry = sentryConfigStore()
  const sentryConnected = sentry.isConfigured()
  const ghExpiry = tokenInfo?.expiresAt
    ? new Date(tokenInfo.expiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'No expiry'

  return (
    <section className="config-section">
      <div className="config-section-header">
        <h2>Tokens</h2>
        <span className="muted">
          The credentials devcompass holds — BYOK, stored only in your browser. GitHub doesn't expose your
          account's token list via API, so create or rotate them on each provider with the links below.
        </span>
      </div>

      <div className="token-cards">
        <div className="token-card">
          <div className="token-card-head">
            <strong>GitHub</strong>
            <span className={`token-card-status ${ghToken ? 'ok' : 'warn'}`}>{ghToken ? 'connected' : 'missing'}</span>
          </div>
          <code className="token-card-value">{maskToken(ghToken)}</code>
          <div className="token-card-meta muted">
            {tokenInfo
              ? <>{tokenInfo.type} · {tokenInfo.scopes.length} scopes · {ghExpiry}{tokenInfo.ssoRequired ? ' · ⚠ SSO authorization needed' : ''}</>
              : 'Loading token info…'}
          </div>
          <div className="token-card-actions">
            <a className="hs-modal-btn link" href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">Create / manage on GitHub ↗</a>
            <button className="hs-modal-btn" onClick={onGoGithubAccess}>Diagnostics</button>
          </div>
          <div className="token-card-hint muted">Needs scopes <code>repo</code> + <code>read:org</code>. Sign out (sidebar footer) to clear it.</div>
        </div>

        <div className="token-card">
          <div className="token-card-head">
            <strong>Sentry</strong>
            <span className={`token-card-status ${sentryConnected ? 'ok' : 'muted'}`}>{sentryConnected ? 'connected' : 'not connected'}</span>
          </div>
          <code className="token-card-value">{maskToken(sentry.token)}</code>
          <div className="token-card-meta muted">
            {sentryConnected
              ? <>@{sentry.orgSlug.trim()} · {sentry.region ? `${sentry.region}.sentry.io` : 'sentry.io'}</>
              : 'Add a token to see Sentry issues in the feed.'}
          </div>
          <div className="token-card-actions">
            <a className="hs-modal-btn link" href="https://sentry.io/settings/account/api/auth-tokens/" target="_blank" rel="noopener noreferrer">Create / manage on Sentry ↗</a>
            <button className="hs-modal-btn" onClick={onGoConnectors}>{sentryConnected ? 'Configure' : 'Add token'}</button>
            {sentryConnected && <button className="hs-modal-btn danger" onClick={() => sentry.reset()}>Disconnect</button>}
          </div>
          <div className="token-card-hint muted">User Auth Token with <code>org:read</code> · <code>project:read</code> · <code>event:read</code>.</div>
        </div>
      </div>
    </section>
  )
}

function TokenAccessPanel({ tokenInfo, orgs }: { tokenInfo: TokenInfo; orgs: Org[] }) {
  if (!tokenInfo) return null

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
        <div>
          <span className="stat-value">{tokenInfo.type}</span>
          <span className="stat-label">Token type</span>
        </div>
        <div>
          <span className="stat-value">{orgs.length}</span>
          <span className="stat-label">Visible orgs</span>
        </div>
        <div>
          <span className="stat-value">{tokenInfo.scopes.length || '0'}</span>
          <span className="stat-label">Scopes</span>
        </div>
        <div title={expiryDate?.toISOString()}>
          <span className={`stat-value ${expiryWarn ? 'text-danger' : ''}`}>
            {daysLeft !== null ? `${daysLeft}d` : '∞'}
          </span>
          <span className={`stat-label ${expiryWarn ? 'text-danger' : ''}`}>
            {expiryWarn ? `Expires ${expiryLabel}` : expiryDate ? `Expires ${expiryLabel}` : 'No expiry'}
          </span>
        </div>
      </div>

      <div className="token-block">
        <h3>Scopes</h3>
        {tokenInfo.scopes.length > 0 ? (
          <div className="diag-row">
            {tokenInfo.scopes.map((s) => (
              <span key={s} className="diag-pill">{s}</span>
            ))}
          </div>
        ) : (
          <p className="muted">No scopes reported by GitHub for this token.</p>
        )}
      </div>

      <div className="token-block">
        <h3>Organizations</h3>
        {orgs.length > 0 ? (
          <div className="diag-orgs">
            {orgs.map((o) => (
              <a key={o.login} href={o.url} target="_blank" rel="noreferrer" title={o.login}>
                <img src={o.avatarUrl} alt={o.login} width={20} height={20} />
                <span>{o.login}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">No organizations are visible with this token.</p>
        )}
      </div>

      {hasIssue && (
        <div className="token-block">
          <h3>Action needed</h3>
          <ul className="diag-issues">
            {missingReadOrg && (
              <li>
                PAT classic without <code>read:org</code> or <code>admin:org</code>. Edit at{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">settings/tokens</a>.
              </li>
            )}
            {tokenInfo.type === 'fine-grained' && noOrgs && (
              <li>
                Fine-grained PATs only see approved orgs. Consider a classic with <code>repo</code> + <code>read:org</code>.
              </li>
            )}
            {ssoIssue && (
              <li>
                Missing SAML SSO authorization for some orgs.{' '}
                <a href={tokenInfo.ssoRequired!.url} target="_blank" rel="noreferrer">Authorize</a>.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
