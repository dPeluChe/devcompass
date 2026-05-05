import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Repo, type PullRequest } from '../api/github'

type View = 'repos' | 'prs' | 'branches'

interface UIState {
  view: View
  search: string
  sidebarOpen: boolean
  theme: 'dark' | 'light'
}

interface FilterState {
  hideArchived: boolean
  hideForks: boolean
  ownerFilter: string
  activityWindow: number
  hideDrafts: boolean
  showStale: boolean
  roleFilter: 'all' | 'mine' | 'assigned' | 'review'
}

interface AppState {
  token: string | null
  viewer: { login: string; avatarUrl: string } | null
  repos: Repo[]
  prs: PullRequest[]
  orgs: { login: string; avatarUrl: string }[]
  ui: UIState
  filters: FilterState
  savedFilters: { name: string; filters: FilterState }[]
  recentRepos: { owner: string; name: string; accessedAt: number }[]
  recentPRs: { owner: string; name: string; number: number; accessedAt: number }[]
  
  setToken: (token: string | null) => void
  setViewer: (viewer: AppState['viewer']) => void
  setRepos: (repos: Repo[]) => void
  setPRs: (prs: PullRequest[]) => void
  setOrgs: (orgs: AppState['orgs']) => void
  setUI: (ui: Partial<UIState>) => void
  setFilters: (filters: Partial<FilterState>) => void
  saveFilter: (name: string) => void
  loadFilter: (name: string) => void
  addRecentRepo: (owner: string, name: string) => void
  addRecentPR: (owner: string, name: string, number: number) => void
}

export const store = create<AppState>()(
  persist(
    (set, get) => ({
      token: null,
      viewer: null,
      repos: [],
      prs: [],
      orgs: [],
      ui: {
        view: 'repos',
        search: '',
        sidebarOpen: true,
        theme: 'dark'
      },
      filters: {
        hideArchived: true,
        hideForks: false,
        ownerFilter: '',
        activityWindow: 90,
        hideDrafts: false,
        showStale: true,
        roleFilter: 'all'
      },
      savedFilters: [],
      recentRepos: [],
      recentPRs: [],

      setToken: (token) => set({ token }),
      setViewer: (viewer) => set({ viewer }),
      setRepos: (repos) => set({ repos }),
      setPRs: (prs) => set({ prs }),
      setOrgs: (orgs) => set({ orgs }),
      setUI: (ui) => set((state) => ({ ui: { ...state.ui, ...ui } })),
      setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
      
      saveFilter: (name) => {
        const { filters, savedFilters } = get()
        const exists = savedFilters.find(f => f.name === name)
        if (exists) {
          set({ savedFilters: savedFilters.map(f => f.name === name ? { ...f, filters } : f) })
        } else {
          set({ savedFilters: [...savedFilters, { name, filters }] })
        }
      },
      
      loadFilter: (name) => {
        const saved = get().savedFilters.find(f => f.name === name)
        if (saved) set({ filters: saved.filters })
      },
      
      addRecentRepo: (owner, name) => {
        const { recentRepos } = get()
        const filtered = recentRepos.filter(r => !(r.owner === owner && r.name === name))
        set({ recentRepos: [{ owner, name, accessedAt: Date.now() }, ...filtered].slice(0, 10) })
      },
      
      addRecentPR: (owner, name, number) => {
        const { recentPRs } = get()
        const filtered = recentPRs.filter(p => !(p.owner === owner && p.name === name && p.number === number))
        set({ recentPRs: [{ owner, name, number, accessedAt: Date.now() }, ...filtered].slice(0, 10) })
      }
    }),
    {
      name: 'ghviewer-storage',
      partialize: (state) => ({
        ui: state.ui,
        filters: state.filters,
        savedFilters: state.savedFilters,
        recentRepos: state.recentRepos,
        recentPRs: state.recentPRs
      })
    }
  )
)