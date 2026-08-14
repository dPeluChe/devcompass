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
import { useSentryIssues } from '../home/useSentryIssues'
import type { Repo } from '../../api/github'
import { SetupForm, describeError } from './sentry/SetupForm'
import { ProjectMappingList } from './sentry/ProjectMappingList'
import { IssueTestPanel } from './sentry/IssueTestPanel'
import type { Async } from './sentry/types'
import { idle } from './sentry/types'

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

  // Per-project unresolved counts for a health glance on the mapping rows.
  // Shared (cached) with the Home Sentry scope.
  const { data: allIssues } = useSentryIssues()
  const countByProject = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of allIssues ?? []) m.set(i.project.slug, (m.get(i.project.slug) ?? 0) + 1)
    return m
  }, [allIssues])

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
    <div className="connector-body">
      <p className="muted connector-intro">
        BYO token, stays in your browser. Requests route through the same-origin
        relay (<code>/api/proxy</code>) since Sentry's API blocks direct browser calls.
      </p>

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
              {cfg.environment.trim() && cfg.environment.trim().toLowerCase() !== 'all' ? ` · env @${cfg.environment.trim()}` : ''}
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
              <ProjectMappingList
                projects={projectsQuery.data}
                projectRepoMap={cfg.projectRepoMap}
                countByProject={countByProject}
                repoOptions={repoOptions}
                savedSlug={savedSlug}
                onSetMapping={setMapping}
              />
            </div>
          )}

          <IssueTestPanel iss={iss} environment={cfg.environment} />
        </>
      )}
    </div>
  )
}
