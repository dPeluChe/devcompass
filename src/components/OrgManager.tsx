import { useMemo, useState } from 'react'
import { type Org } from '../api/github'
import { orgConfigStore, type OrgConfig } from '../store/orgConfig'
import { FadeIn, Button, Badge } from './ui'

type Props = {
  orgs: Org[]
}

export function OrgManager({ orgs }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const { orgs: config, setAllOrgs, toggleOrg, toggleOrgSync, getEnabledOrgs } = orgConfigStore()
  
  useMemo(() => {
    if (orgs.length > 0) {
      setAllOrgs(orgs.map(o => ({
        login: o.login,
        avatarUrl: o.avatarUrl,
        enabled: true,
        syncEnabled: true,
        lastSyncedAt: null
      })))
    }
  }, [orgs, setAllOrgs])

  const enabledCount = getEnabledOrgs().length
  const total = orgs.length

  return (
    <div className="org-manager">
      <button className="org-manager-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span>Orgs</span>
        <Badge>{enabledCount}/{total}</Badge>
        <span className="muted">{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen && (
        <FadeIn>
          <div className="org-manager-dropdown">
            <div className="org-manager-header">
              <span className="muted">Select orgs to sync</span>
              <Button size="sm" variant="ghost" onClick={() => {
                Object.keys(config).forEach(login => {
                  if (!config[login].enabled) toggleOrg(login)
                })
              }}>
                Enable all
              </Button>
            </div>
            
            <div className="org-list">
              {Object.values(config).map((org) => (
                <OrgRow 
                  key={org.login} 
                  org={org} 
                  onToggleEnabled={() => toggleOrg(org.login)}
                  onToggleSync={() => toggleOrgSync(org.login)}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}

function OrgRow({ 
  org, 
  onToggleEnabled, 
  onToggleSync 
}: { 
  org: OrgConfig
  onToggleEnabled: () => void
  onToggleSync: () => void
}) {
  return (
    <div className={`org-row ${!org.enabled ? 'disabled' : ''}`}>
      <label className="org-toggle">
        <input 
          type="checkbox" 
          checked={org.enabled} 
          onChange={onToggleEnabled}
        />
        <img src={org.avatarUrl} alt="" width={20} height={20} />
        <span>{org.login}</span>
      </label>
      
      <label className="org-sync-toggle" title="Sync repos">
        <input 
          type="checkbox" 
          checked={org.syncEnabled} 
          onChange={onToggleSync}
          disabled={!org.enabled}
        />
        <span className="sync-label">{org.syncEnabled ? '↻' : '○'}</span>
      </label>
    </div>
  )
}