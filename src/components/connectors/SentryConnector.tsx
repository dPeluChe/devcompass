import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sentryConfigStore } from '../../store/sentryConfig'
import {
  fetchSentryCodeMappings,
  fetchSentryIssues,
  fetchSentryOrgs,
  fetchSentryProjects,
  type SentryIssue,
} from '../../api/sentry'
import { queryKeys } from '../../store/queries'
import { FaGithub } from 'react-icons/fa'
import { SiSentry } from 'react-icons/si'
import { SentryIssueList } from './SentryIssueList'
import { RepoPicker } from './RepoPicker'
import type { Repo } from '../../api/github'

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

export function SentryConnector({ repos }: { repos: Repo[] }) {
  const cfg = sentryConfigStore()
  const queryClient = useQueryClient()
  const configured = cfg.isConfigured()
  const repoOptions = useMemo(() => repos.map((r) => r.nameWithOwner), [repos])

  const [editingCreds, setEditingCreds] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [orgChoices, setOrgChoices] = useState<string[]>([])
  const [iss, setIss] = useState<Async<SentryIssue[]>>(idle)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const savedTimer = useRef<number | null>(null)

  const showSetup = !configured || editingCreds

  // When connected, the project list loads itself (cached) so the mapping editor
  // is always there — no manual re-validate to assign/correct a repo.
  const projectsQuery = useQuery({
    queryKey: queryKeys.sentryProjects(cfg.orgSlug.trim()),
    queryFn: async () => (await fetchSentryProjects(cfg.getAuth(), cfg.orgSlug.trim())).data,
    enabled: configured && !showSetup,
    staleTime: 5 * 60 * 1000,
  })

  // Manual project→repo mapping (homologation). Persisted to the store; RepoDetail
  // reads it reactively, so an edit immediately controls that repo's Sentry tab.
  function setMapping(projectSlug: string, repo: string) {
    const map = { ...sentryConfigStore.getState().projectRepoMap }
    const v = repo.trim()
    if (v) map[projectSlug] = v
    else delete map[projectSlug]
    sentryConfigStore.getState().update({ projectRepoMap: map })
    // Auto-saved to localStorage already — flash a per-row confirmation.
    setSavedSlug(projectSlug)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSavedSlug(null), 1500)
  }

  // Fill EMPTY mapping slots from Sentry's code mappings (so a newly-created
  // project picks up its auto-link) without ever clobbering a manual mapping.
  async function seedCodeMappings(auth: ReturnType<typeof cfg.getAuth>, org: string) {
    try {
      const { data: mappings } = await fetchSentryCodeMappings(auth, org)
      const map = { ...sentryConfigStore.getState().projectRepoMap }
      let changed = false
      for (const m of mappings) {
        if (m.projectSlug && m.repoName && !map[m.projectSlug]) { map[m.projectSlug] = m.repoName; changed = true }
      }
      if (changed) sentryConfigStore.getState().update({ projectRepoMap: map })
    } catch { /* code mappings optional */ }
  }

  // Re-pull the project list (e.g. after creating a project in Sentry) + seed
  // any new auto-mappings. Existing mappings/edits are preserved.
  async function refresh() {
    await seedCodeMappings(cfg.getAuth(), cfg.orgSlug.trim())
    projectsQuery.refetch()
  }

  async function connect() {
    setConnecting(true)
    setConnectError(null)
    try {
      const auth = cfg.getAuth()
      const org = cfg.orgSlug.trim()
      // Validate by fetching projects (works with user + org tokens).
      const { data: projects } = await fetchSentryProjects(auth, org)
      // Best-effort org list for the slug autocomplete.
      try {
        const { data: orgs } = await fetchSentryOrgs(auth)
        setOrgChoices(orgs.map((o) => o.slug))
      } catch { /* org-scoped token can't list orgs — fine */ }
      await seedCodeMappings(auth, org)
      sentryConfigStore.getState().update({ enabled: true })
      queryClient.setQueryData(queryKeys.sentryProjects(org), projects)
      queryClient.invalidateQueries({ queryKey: ['sentry'] })
      setEditingCreds(false)
    } catch (e) {
      setConnectError(describeError(e))
    } finally {
      setConnecting(false)
    }
  }

  function disconnect() {
    cfg.reset()
    setEditingCreds(false)
    setOrgChoices([])
    setIss(idle)
    queryClient.removeQueries({ queryKey: ['sentry'] })
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

      {showSetup ? (
        <SetupForm
          connecting={connecting}
          connectError={connectError}
          orgChoices={orgChoices}
          canCancel={configured}
          onCancel={() => setEditingCreds(false)}
          onConnect={connect}
        />
      ) : (
        <>
          <div className="connector-status">
            <span className="hs-status hs-status-ok">
              ✓ Connected · @{cfg.orgSlug} · {cfg.region ? `${cfg.region}.sentry.io` : 'sentry.io'}
              {cfg.environment.trim() ? ` · env @${cfg.environment.trim()}` : ''}
            </span>
            <div className="connector-status-actions">
              <button className="hs-modal-btn" onClick={refresh} disabled={projectsQuery.isFetching}>
                {projectsQuery.isFetching ? 'Refreshing…' : '↻ Refresh'}
              </button>
              <button className="hs-modal-btn" onClick={() => setEditingCreds(true)}>Edit credentials</button>
              <button className="hs-modal-btn" onClick={loadIssues} disabled={iss.loading}>
                {iss.loading ? 'Loading…' : 'Test: load issues'}
              </button>
              <button className="hs-modal-btn danger" onClick={disconnect}>Disconnect</button>
            </div>
          </div>

          {projectsQuery.isLoading && <p className="muted" style={{ marginTop: 12 }}>Loading projects…</p>}
          {projectsQuery.error && (
            <div className="hs-status hs-status-err" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>
              {describeError(projectsQuery.error)}
            </div>
          )}
          {projectsQuery.data && (
            <div className="connector-results" style={{ marginTop: 12 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                {projectsQuery.data.filter((p) => cfg.projectRepoMap[p.slug]).length}/{projectsQuery.data.length} mapped in @{cfg.orgSlug.trim()} — changes save automatically. Mapped projects show a Sentry tab on that repo.
              </div>
              <ul className="connector-map-list">
                {projectsQuery.data.map((p) => {
                  const mapped = cfg.projectRepoMap[p.slug] ?? ''
                  return (
                    <li key={p.id} className="connector-map-row">
                      <span className="connector-map-project" title={p.slug}>
                        <SiSentry className="connector-map-icon sentry" aria-hidden />
                        <span className="connector-map-project-name">{p.slug}</span>
                      </span>
                      <span className="connector-map-arrow">→</span>
                      <FaGithub className="connector-map-icon gh" aria-hidden />
                      <RepoPicker
                        value={mapped}
                        options={repoOptions}
                        onChange={(v) => setMapping(p.slug, v)}
                        placeholder="owner/repo (unmapped)"
                      />
                      <a
                        className="connector-map-repo"
                        href={mapped ? `https://github.com/${mapped}` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={mapped ? 'Open on GitHub' : undefined}
                        style={{ visibility: mapped ? 'visible' : 'hidden' }}
                      >↗</a>
                      <span className="connector-map-saved" style={{ visibility: savedSlug === p.slug ? 'visible' : 'hidden' }}>✓ Saved</span>
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
        </>
      )}
    </section>
  )
}

function SetupForm({
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
          />
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
