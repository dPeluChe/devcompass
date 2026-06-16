import { useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import {
  SiSentry, SiVercel, SiLinear, SiJira, SiGitlab, SiBitbucket, SiNetlify,
  SiCloudflare, SiRailway, SiRender, SiFlydotio, SiDatadog, SiGrafana, SiRollbar,
  SiNewrelic, SiCircleci, SiAsana, SiNotion, SiTrello, SiClickup, SiShortcut,
  SiSlack, SiPagerduty, SiOpsgenie, SiDiscord,
} from 'react-icons/si'
import type { Org, Repo, TokenInfo } from '../../api/github'
import { sentryConfigStore } from '../../store/sentryConfig'
import { vercelConfigStore } from '../../store/vercelConfig'
import { SentryConnector } from './SentryConnector'
import { VercelConnector } from './VercelConnector'
import { IntegrationCard, SoonChip } from './IntegrationCard'

// Roadmap grouped by panorama layer, tagged with how each one connects (all via
// the same allowlisted relay — REST/GraphQL with a BYO token, OAuth where needed).
const ROADMAP: { layer: string; items: { icon: React.ReactNode; name: string; type: string }[] }[] = [
  { layer: 'Source', items: [
    { icon: <SiGitlab />, name: 'GitLab', type: 'REST' },
    { icon: <SiBitbucket />, name: 'Bitbucket', type: 'REST' },
  ] },
  { layer: 'Deploy', items: [
    { icon: <SiNetlify />, name: 'Netlify', type: 'REST' },
    { icon: <SiCloudflare />, name: 'Cloudflare', type: 'REST' },
    { icon: <SiRailway />, name: 'Railway', type: 'GraphQL' },
    { icon: <SiRender />, name: 'Render', type: 'REST' },
    { icon: <SiFlydotio />, name: 'Fly.io', type: 'REST' },
  ] },
  { layer: 'Monitoring', items: [
    { icon: <SiDatadog />, name: 'Datadog', type: 'REST' },
    { icon: <SiGrafana />, name: 'Grafana', type: 'REST' },
    { icon: <SiRollbar />, name: 'Rollbar', type: 'REST' },
    { icon: <SiNewrelic />, name: 'New Relic', type: 'GraphQL' },
  ] },
  { layer: 'CI / CD', items: [
    { icon: <SiCircleci />, name: 'CircleCI', type: 'REST' },
  ] },
  { layer: 'Project tracking', items: [
    { icon: <SiLinear />, name: 'Linear', type: 'GraphQL' },
    { icon: <SiJira />, name: 'Jira', type: 'REST' },
    { icon: <SiAsana />, name: 'Asana', type: 'REST' },
    { icon: <SiNotion />, name: 'Notion', type: 'REST' },
    { icon: <SiTrello />, name: 'Trello', type: 'REST' },
    { icon: <SiClickup />, name: 'ClickUp', type: 'REST' },
    { icon: <SiShortcut />, name: 'Shortcut', type: 'REST' },
  ] },
  { layer: 'Alerts & comms', items: [
    { icon: <SiSlack />, name: 'Slack', type: 'OAuth' },
    { icon: <SiPagerduty />, name: 'PagerDuty', type: 'REST' },
    { icon: <SiOpsgenie />, name: 'Opsgenie', type: 'REST' },
    { icon: <SiDiscord />, name: 'Discord', type: 'OAuth' },
  ] },
]

/**
 * One hub for every integration. GitHub is the core/primary card (the auth gate);
 * Sentry/Vercel are optional BYOK connectors; the rest are placeholders. Replaces
 * the separate Tokens / GitHub-access / Connectors tabs.
 */
export function ConnectorsHub({ tokenInfo, orgs, repos, errors }: {
  tokenInfo: TokenInfo | undefined
  orgs: Org[]
  repos: Repo[]
  errors: { source: string; message: string }[]
}) {
  const sentry = sentryConfigStore()
  const vercel = vercelConfigStore()
  const vercelCount = Object.keys(vercel.projectRepoMap).length

  const ghSub = tokenInfo
    ? `${tokenInfo.type} · ${tokenInfo.scopes.length} scopes${tokenInfo.ssoRequired ? ' · ⚠ SSO' : ''}`
    : 'loading…'

  return (
    <section className="config-section">
      <div className="config-section-header">
        <h2>Connectors</h2>
        <span className="muted">Every integration in one place — bring your own key, stored only in your browser.</span>
      </div>

      <div className="int-cards">
        <IntegrationCard
          icon={<FaGithub />}
          name="GitHub"
          sub={ghSub}
          status={{ tone: tokenInfo?.ssoRequired ? 'warn' : 'ok', label: 'active' }}
          defaultOpen
        >
          {tokenInfo ? <TokenAccessPanel tokenInfo={tokenInfo} orgs={orgs} /> : <p className="muted">Loading token info…</p>}
          {errors.length > 0 && (
            <details className="partial-errors" open>
              <summary>{errors.length} sync errors</summary>
              <ul>{errors.map((e) => <li key={e.source}><strong>{e.source}:</strong> {e.message}</li>)}</ul>
            </details>
          )}
          <p className="connector-intro muted">
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">Create / manage on GitHub ↗</a>
            {' '}· needs <code>repo</code> + <code>read:org</code> · sign out (sidebar) to clear it.
          </p>
        </IntegrationCard>

        <IntegrationCard
          icon={<SiSentry />}
          name="Sentry"
          sub={sentry.isConfigured() ? `@${sentry.orgSlug.trim()}` : 'unified issues + errors'}
          status={sentry.isConfigured() ? { tone: 'ok', label: 'connected' } : { tone: 'muted', label: 'not connected' }}
        >
          <SentryConnector repos={repos} />
        </IntegrationCard>

        <IntegrationCard
          icon={<SiVercel />}
          name="Vercel"
          sub={vercel.isConfigured() ? `${vercelCount} linked project${vercelCount === 1 ? '' : 's'}` : 'deployments per repo'}
          status={vercel.isConfigured() ? { tone: 'ok', label: 'connected' } : { tone: 'muted', label: 'not connected' }}
        >
          <VercelConnector />
        </IntegrationCard>

      </div>

      <RoadmapSection />
    </section>
  )
}

const ROADMAP_COUNT = ROADMAP.reduce((n, g) => n + g.items.length, 0)
const REQUEST_URL = 'https://github.com/dPeluChe/devcompass/issues/new?labels=connector&title=Connector%20request:%20'

function RoadmapSection() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="int-roadmap-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="int-chevron">{open ? '▾' : '▸'}</span>
        View next integrations <span className="muted">({ROADMAP_COUNT} on the roadmap)</span>
      </button>
      {open && (
        <div className="int-roadmap">
          <p className="int-soon-head muted">All via the same allowlisted relay (BYO token).</p>
          {ROADMAP.map((g) => (
            <div key={g.layer} className="int-roadmap-group">
              <span className="int-roadmap-layer muted">{g.layer}</span>
              <div className="int-soon-grid">
                {g.items.map((s) => <SoonChip key={s.name} icon={s.icon} name={s.name} type={s.type} />)}
              </div>
            </div>
          ))}
          <a className="int-request" href={REQUEST_URL} target="_blank" rel="noopener noreferrer">
            <FaGithub /> Request an integration ↗
          </a>
        </div>
      )}
    </>
  )
}

function TokenAccessPanel({ tokenInfo, orgs }: { tokenInfo: TokenInfo; orgs: Org[] }) {
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
