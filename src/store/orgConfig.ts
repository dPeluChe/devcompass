import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OrgConfig {
  login: string
  avatarUrl: string
  enabled: boolean
  syncEnabled: boolean
  lastSyncedAt: number | null
}

interface OrgConfigState {
  orgs: Record<string, OrgConfig>
  allOrgs: OrgConfig[]
  
  setAllOrgs: (orgs: OrgConfig[]) => void
  toggleOrg: (login: string) => void
  toggleOrgSync: (login: string) => void
  markOrgSynced: (login: string, syncedAt?: number) => void
  getEnabledOrgs: () => string[]
  getSyncingOrgs: () => string[]
  orgNeedsSync: (login: string) => boolean
}

export const orgConfigStore = create<OrgConfigState>()(
  persist(
    (set, get) => ({
      orgs: {},
      allOrgs: [],

      setAllOrgs: (newOrgs) => {
        const existing = get().orgs
        const merged: Record<string, OrgConfig> = {}
        
        for (const org of newOrgs) {
          merged[org.login] = existing[org.login] 
            ? { ...org, ...existing[org.login], avatarUrl: org.avatarUrl }
            : { ...org, enabled: true, syncEnabled: true, lastSyncedAt: null }
        }
        
        set({ 
          orgs: merged, 
          allOrgs: newOrgs.map(o => merged[o.login]) 
        })
      },

      toggleOrg: (login) => {
        const { orgs, allOrgs } = get()
        if (!orgs[login]) return
        
        const updated = {
          ...orgs,
          [login]: { ...orgs[login], enabled: !orgs[login].enabled }
        }
        
        set({ 
          orgs: updated,
          allOrgs: allOrgs.map(o => o.login === login ? updated[login] : o)
        })
      },

      markOrgSynced: (login, syncedAt = Date.now()) => {
        const { orgs, allOrgs } = get()
        if (!orgs[login]) return

        const updated = {
          ...orgs,
          [login]: { ...orgs[login], lastSyncedAt: syncedAt }
        }

        set({
          orgs: updated,
          allOrgs: allOrgs.map(o => o.login === login ? updated[login] : o)
        })
      },

      toggleOrgSync: (login) => {
        const { orgs, allOrgs } = get()
        if (!orgs[login]) return
        
        const updated = {
          ...orgs,
          [login]: { 
            ...orgs[login], 
            syncEnabled: !orgs[login].syncEnabled,
            lastSyncedAt: orgs[login].syncEnabled ? orgs[login].lastSyncedAt : Date.now()
          }
        }
        
        set({ 
          orgs: updated,
          allOrgs: allOrgs.map(o => o.login === login ? updated[login] : o)
        })
      },

      getEnabledOrgs: () => {
        return Object.values(get().orgs)
          .filter(o => o.enabled)
          .map(o => o.login)
      },

      getSyncingOrgs: () => {
        return Object.values(get().orgs)
          .filter(o => o.enabled && o.syncEnabled)
          .map(o => o.login)
      },

      orgNeedsSync: (login) => {
        const org = get().orgs[login]
        if (!org || !org.enabled || !org.syncEnabled) return false
        if (!org.lastSyncedAt) return true
        const hoursSince = (Date.now() - org.lastSyncedAt) / (1000 * 60 * 60)
        return hoursSince > 1
      }
    }),
    {
      name: 'ghviewer-org-config',
      partialize: (state) => ({ orgs: state.orgs })
    }
  )
)
