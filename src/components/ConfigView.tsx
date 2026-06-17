import { useMemo, useState } from 'react'
import type { Org, Repo, TokenInfo } from '../api/github'
import { OrgManager } from './OrgManager'
import { SettingsTab } from './SettingsTab'
import { ConnectorsHub } from './connectors/ConnectorsHub'
import { RelationshipsView } from './RelationshipsView'

export function ConfigView({
  tokenInfo,
  orgs,
  repos,
  errors,
  onForceResync,
  onGoNeeds
}: {
  tokenInfo: TokenInfo | undefined
  orgs: Org[]
  repos: Repo[]
  errors: { source: string; message: string }[]
  onForceResync: () => void
  onGoNeeds?: () => void
}) {
  const [section, setSection] = useState<'orgs' | 'connectors' | 'relationships' | 'storage' | 'cache' | 'pinned' | 'appearance'>('orgs')

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
        <button className={`config-tab ${section === 'connectors' ? 'active' : ''}`} onClick={() => setSection('connectors')}>
          Connectors
        </button>
        <button className={`config-tab ${section === 'relationships' ? 'active' : ''}`} onClick={() => setSection('relationships')}>
          Relationships
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

        {section === 'connectors' && (
          <ConnectorsHub tokenInfo={tokenInfo} orgs={orgs} repos={repos} errors={errors} />
        )}

        {section === 'relationships' && <RelationshipsView onGoNeeds={onGoNeeds} />}

        {section === 'storage' && <SettingsTab panel="storage" onForceResync={onForceResync} />}
        {section === 'cache' && <SettingsTab panel="cache" onForceResync={onForceResync} />}
        {section === 'pinned' && <SettingsTab panel="pinned" />}
        {section === 'appearance' && <SettingsTab panel="appearance" />}
      </div>
    </main>
  )
}
