import { useEffect, useMemo, useState } from 'react'
import type { Repo, TokenInfo, Org } from '../api/github'
import { DEMO_TOKEN } from '../api/demo-data'
import type { ScopeKey } from './home/types'
import { OrgManager } from './OrgManager'
import { SettingsTab } from './SettingsTab'
import { SentryConnector } from './connectors/SentryConnector'
import { QuickSwitcher, type QSAction } from './QuickSwitcher'
import { ShortcutsHelp } from './ShortcutsHelp'
import { HomeShell } from './home/HomeShell'
import { HomeSkeleton } from './home/HomeSkeleton'
import { Pulse } from './ui'
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts'
import { useViewerData } from '../hooks/useViewerData'
import { getPinnedRepos, pinRepo, unpinRepo, type PinnedRepo } from '../store/db'

export { Skeleton, CardSkeleton, FadeIn, Pulse } from './ui'

type Props = { token: string; onLogout: () => void }
type View = 'home' | 'repos' | 'config'

export function Dashboard({ token, onLogout }: Props) {
  const data = useViewerData(token)

  const [view, setView] = useState<View>('home')
  // Sidebar scope lives here (not inside HomeShell) so the topbar tabs can flip
  // it without re-mounting the shell — avoids the effect-as-handler smell from
  // syncing an `initialScope` prop into local state.
  const [scope, setScope] = useState<ScopeKey>('digest')
  const [selected, setSelected] = useState<{ owner: string; name: string } | null>(null)
  const [pinned, setPinned] = useState<PinnedRepo[]>([])
  const [qsOpen, setQsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    getPinnedRepos()
      .then(setPinned)
      .catch((e) => console.warn('Failed to load pinned repos:', e))
  }, [])

  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.repoId)), [pinned])

  async function handleTogglePinned(repo: Repo) {
    if (pinnedIds.has(repo.id)) {
      await unpinRepo(repo.id)
    } else {
      await pinRepo(repo.id, repo.nameWithOwner)
    }
    setPinned(await getPinnedRepos())
  }

  function gotoView(target: View) {
    setView(target)
    setSelected(null)
    if (target === 'home') setScope('needs')
    else if (target === 'repos') setScope('repos')
  }

  // Sidebar item clicks always exit config / detail and land on the chosen scope.
  // Mirrors topbar tab behavior so navigation feels coherent.
  function handleScopeChange(key: ScopeKey) {
    setScope(key)
    setSelected(null)
    setView(key === 'repos' ? 'repos' : 'home')
  }

  function handleQuickPick(action: QSAction) {
    if (action.kind === 'view') {
      gotoView(action.view)
      return
    }
    if (action.kind === 'repo') {
      setSelected({ owner: action.repo.owner.login, name: action.repo.name })
      setView('repos')
      return
    }
    // PR pick — open in Home via the ?pr=owner/name/number deep-link that
    // HomeShell reads on mount to pop the DetailModal. Avoids the dead PRs
    // view we removed.
    const pr = `${action.repo.owner.login}/${action.repo.name}/${action.pr.number}`
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('pr', pr)
      window.history.replaceState({}, '', url.toString())
    } catch { /* ignore */ }
    setSelected(null)
    setView('home')
  }

  useGlobalShortcuts({
    onQuickSwitcher: () => { setHelpOpen(false); setQsOpen(true) },
    onHelp: () => { setQsOpen(false); setHelpOpen((v) => !v) },
    onGoHome: () => gotoView('home'),
    onGoRepos: () => gotoView('repos'),
    onGoConfig: () => gotoView('config'),
    // The repo grid no longer has its own search input — chips replaced it.
    // "/" now opens the QuickSwitcher, which is the cross-app search anyway.
    onFocusSearch: () => { setHelpOpen(false); setQsOpen(true) },
    onEscape: () => {
      if (qsOpen) setQsOpen(false)
      else if (helpOpen) setHelpOpen(false)
    }
  })

  if (data.error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <pre>{data.error instanceof Error ? data.error.message : String(data.error)}</pre>
        <button onClick={onLogout}>Change token</button>
      </div>
    )
  }

  const isSyncing = !!data.progressMsg

  return (
    <div className="dashboard">
      <div className="main-col">
        <header className="topbar topbar-sticky">
          <a className="topbar-brand" href="https://github.com/dPeluChe/devcompass" target="_blank" rel="noreferrer" title="devcompass">
            <img src="/favicon.svg" width="26" height="26" alt="devcompass" />
          </a>
          <div className="user">
            {data.viewer && <img src={data.viewer.avatarUrl} alt="" width={24} height={24} />}
            <strong>@{data.viewer?.login ?? '...'}</strong>
            {token === DEMO_TOKEN && <span className="demo-badge">demo</span>}
          </div>

          <nav className="view-tabs" aria-label="Primary">
            <button className={`view-tab ${view === 'home' ? 'active' : ''}`} onClick={() => gotoView('home')} title="Home (g h)">
              Home
            </button>
            <button className={`view-tab ${view === 'repos' ? 'active' : ''}`} onClick={() => gotoView('repos')} title="Repos (g r)">
              Repos
            </button>
            <button className={`view-tab ${view === 'config' ? 'active' : ''}`} onClick={() => gotoView('config')} title="Config (g c)">
              Config
            </button>
          </nav>

          <div className="meta muted">
            <button
              className="qs-trigger"
              onClick={() => setQsOpen(true)}
              title="Quick switcher (⌘K)"
            >
              <span className="qs-trigger-text">Jump to…</span>
              <span className="qs-trigger-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
            </button>

            <span className="sync-indicator" title={data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'Not synced yet'}>
              {isSyncing ? (
                <Pulse>{data.progressMsg || 'Syncing...'}</Pulse>
              ) : (
                <>
                  <span className={`sync-dot ${data.lastSyncAt ? 'ok' : 'cold'}`} />
                  {data.lastSyncAt ? `Synced ${timeAgoShort(data.lastSyncAt)}` : 'Not synced'}
                </>
              )}
            </span>

            <button
              className="refresh-btn"
              onClick={() => data.refresh()}
              disabled={isSyncing}
              title="Force refresh from GitHub"
            >
              ↻
            </button>

            {!data.isLoading && (
              <span className="meta-summary">
                {data.repos.length} repos · {data.viewer?.organizations.nodes.length ?? 0} orgs
                {data.loadedFromCache && data.isFetching ? ' · cache' : ''}
              </span>
            )}
            {data.rateLimit && (
              <span title={`Rate limit resets ${new Date(data.rateLimit.resetAt).toLocaleTimeString()}`}>
                {data.rateLimit.remaining}/{data.rateLimit.limit}
              </span>
            )}

            <button className="link-btn" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
            </button>
            <button className="link-btn" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {(data.isLoading || data.progressMsg) && !selected && view !== 'config' ? (
          <HomeSkeleton progressMsg={data.progressMsg} />
        ) : (
          <HomeShell
            token={token}
            viewer={data.viewer}
            repos={data.repos}
            pinned={pinned}
            memberOrgs={data.orgs}
            scope={scope}
            onScopeChange={handleScopeChange}
            selectedRepo={selected}
            mainSlot={view === 'config' ? (
              <ConfigView
                tokenInfo={data.tokenInfo}
                orgs={data.orgs}
                repos={data.repos}
                errors={data.errors}
                onForceResync={data.refresh}
              />
            ) : undefined}
            onOpenRepo={(repo) => {
              setSelected({ owner: repo.owner.login, name: repo.name })
              setView('repos')
            }}
            onCloseSelectedRepo={() => setSelected(null)}
            onTogglePinned={handleTogglePinned}
            onLogout={onLogout}
          />
        )}
      </div>

      <QuickSwitcher
        open={qsOpen}
        onClose={() => setQsOpen(false)}
        onPick={handleQuickPick}
        repos={data.repos}
      />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

function timeAgoShort(ms: number): string {
  const diff = Date.now() - ms
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function ConfigView({
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
  const [section, setSection] = useState<'orgs' | 'token' | 'connectors' | 'storage' | 'cache' | 'pinned' | 'appearance'>('orgs')

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
        <button className={`config-tab ${section === 'token' ? 'active' : ''}`} onClick={() => setSection('token')}>
          Token
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

        {section === 'connectors' && <SentryConnector />}

        {section === 'storage' && <SettingsTab panel="storage" onForceResync={onForceResync} />}
        {section === 'cache' && <SettingsTab panel="cache" onForceResync={onForceResync} />}
        {section === 'pinned' && <SettingsTab panel="pinned" />}
        {section === 'appearance' && <SettingsTab panel="appearance" />}
      </div>
    </main>
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

