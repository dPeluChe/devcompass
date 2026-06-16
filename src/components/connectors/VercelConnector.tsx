import { useState } from 'react'
import { SiVercel } from 'react-icons/si'
import { FaGithub } from 'react-icons/fa'
import { vercelConfigStore, validateVercelTokenFormat } from '../../store/vercelConfig'
import { validateVercelToken, repoFromProject } from '../../api/vercel'

// Auth failures are the common first-run snag — point at the likely causes.
function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/\b40[13]\b/.test(msg)) {
    return `${msg}\n→ Create a token at vercel.com → Settings → Tokens. For a Team account, set the Team ID/slug below (personal tokens can't see team projects).`
  }
  return msg
}

export function VercelConnector() {
  const cfg = vercelConfigStore()
  const configured = cfg.isConfigured()
  const [editing, setEditing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenCheck = validateVercelTokenFormat(cfg.token)

  const showSetup = !configured || editing
  const mappings = Object.entries(cfg.projectRepoMap)

  async function connect() {
    setConnecting(true)
    setError(null)
    try {
      const projects = await validateVercelToken(cfg.getAuth())
      // The git link IS the mapping — seed it directly (only github-linked projects).
      const projectRepoMap: Record<string, string> = {}
      const projectNames: Record<string, string> = {}
      for (const p of projects) {
        const repo = repoFromProject(p)
        if (repo) { projectRepoMap[p.id] = repo; projectNames[p.id] = p.name }
      }
      cfg.update({ enabled: true, projectRepoMap, projectNames })
      setEditing(false)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setConnecting(false)
    }
  }

  function disconnect() {
    cfg.reset()
    setEditing(false)
  }

  return (
    <section className="config-section">
      <div className="config-section-header">
        <h2><SiVercel style={{ verticalAlign: '-2px' }} /> Vercel</h2>
        <span className="muted">
          BYO access token, stays in your browser. Surfaces deployments per repo (status,
          commit, target). Routes through the same-origin relay (<code>/api/proxy</code>).
        </span>
      </div>

      {showSetup ? (
        <div className="connector-form">
          <label>
            <span>Access token</span>
            <input
              type="password"
              placeholder="Vercel token…"
              value={cfg.token}
              onChange={(e) => cfg.update({ token: e.target.value })}
              autoComplete="off"
              aria-invalid={tokenCheck.warning ? true : undefined}
            />
            {tokenCheck.warning && <span className="connector-field-hint warn">{tokenCheck.warning}</span>}
          </label>
          <label>
            <span>Team ID / slug <span className="muted">(optional — personal account leaves blank)</span></span>
            <input
              type="text"
              placeholder="team_… or my-team"
              value={cfg.teamId}
              onChange={(e) => cfg.update({ teamId: e.target.value })}
            />
          </label>
          <div className="connector-status-actions">
            <button className="hs-modal-btn primary" onClick={connect} disabled={connecting || !cfg.token.trim()}>
              {connecting ? 'Validating…' : 'Connect'}
            </button>
            {configured && <button className="hs-modal-btn" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
          {error && <div className="hs-status hs-status-err" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
          <details className="connector-help">
            <summary>How to get a Vercel token</summary>
            <ol>
              <li>Open <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer">vercel.com → Settings → Tokens</a>.</li>
              <li>Create a token (scope it to the team if you use one).</li>
              <li>For a Team account, also set the <strong>Team ID/slug</strong> above so team projects are visible.</li>
            </ol>
          </details>
        </div>
      ) : (
        <>
          <div className="connector-status">
            <span className="hs-status hs-status-ok">✓ Connected · {mappings.length} linked project{mappings.length === 1 ? '' : 's'}</span>
            <div className="connector-status-actions">
              <button className="hs-modal-btn" onClick={connect} disabled={connecting}>{connecting ? 'Refreshing…' : '↻ Refresh'}</button>
              <button className="hs-modal-btn" onClick={() => setEditing(true)}>Edit credentials</button>
              <button className="hs-modal-btn danger" onClick={disconnect}>Disconnect</button>
            </div>
          </div>
          {error && <div className="hs-status hs-status-err" style={{ whiteSpace: 'pre-line' }}>{error}</div>}
          {mappings.length === 0 ? (
            <p className="muted">No GitHub-linked Vercel projects found on this account/team.</p>
          ) : (
            <ul className="connector-map-list">
              {mappings.map(([id, repo]) => (
                <li key={id}>
                  <SiVercel className="muted" /> <strong>{cfg.projectNames[id] ?? id}</strong>
                  <span className="muted"> → </span>
                  <FaGithub className="muted" /> {repo}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
