import { useMemo } from 'react'
import { Header, type ScopeProps } from './common'
import { useSentryIssues } from '../useSentryIssues'
import { sentryConfigStore } from '../../../store/sentryConfig'
import { SentryIssueList } from '../../connectors/SentryIssueList'
import type { SentryIssue } from '../../../api/sentry'

/**
 * Home scope: unresolved Sentry issues, homologated to GitHub repos via the
 * project→repo map. Grouped by repo (a repo can carry several Sentry projects);
 * issues from unmapped projects fall into a trailing group.
 */
export function SentryScope(_props: ScopeProps) {
  const cfg = sentryConfigStore()
  const configured = cfg.isConfigured()
  const { data, isLoading, error } = useSentryIssues()

  const { byRepo, unmapped } = useMemo(() => {
    const map = cfg.projectRepoMap
    const grouped = new Map<string, SentryIssue[]>()
    const noRepo: SentryIssue[] = []
    for (const iss of data ?? []) {
      const repo = map[iss.project.slug]
      if (repo) {
        const list = grouped.get(repo)
        if (list) list.push(iss)
        else grouped.set(repo, [iss])
      } else {
        noRepo.push(iss)
      }
    }
    return { byRepo: [...grouped.entries()], unmapped: noRepo }
  }, [data, cfg.projectRepoMap])

  const envLabel = cfg.environment.trim() && cfg.environment.trim().toLowerCase() !== 'all'
    ? ` · env @${cfg.environment.trim()}`
    : ''

  if (!configured) {
    return (
      <main className="hs-main">
        <Header title="Sentry" meta="not connected" />
        <div className="hs-empty">
          <strong>Sentry isn't connected.</strong>
          Add a token in <strong>Config → Connectors</strong> to see unresolved issues here, mapped to their repos.
        </div>
      </main>
    )
  }

  return (
    <main className="hs-main">
      <Header
        title="Sentry"
        count={data?.length}
        meta={`unresolved issues · @${cfg.orgSlug.trim()}${envLabel}`}
      />

      {isLoading && (
        <section className="hs-surface">
          <div className="hs-skeleton-block">
            <div className="hs-skeleton-bar" style={{ width: '70%' }} />
            <div className="hs-skeleton-bar" style={{ width: '50%' }} />
            <div className="hs-skeleton-bar" style={{ width: '85%' }} />
          </div>
        </section>
      )}

      {error && (
        <div className="hs-empty" style={{ color: 'var(--danger)', whiteSpace: 'pre-line' }}>
          <strong>Failed to load.</strong>{error instanceof Error ? error.message : String(error)}
        </div>
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <div className="hs-empty">
          <strong>No unresolved Sentry issues. 🎉</strong>
          Errors in your mapped projects would show here.
        </div>
      )}

      {byRepo.map(([repo, issues]) => (
        <section key={repo} className="hs-sentry-group">
          <h3 className="hs-sentry-group-head">
            <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer">{repo}</a>
            <span className="muted"> · {issues.length}</span>
          </h3>
          <SentryIssueList issues={issues} />
        </section>
      ))}

      {unmapped.length > 0 && (
        <section className="hs-sentry-group">
          <h3 className="hs-sentry-group-head muted">
            Unmapped projects · {unmapped.length}
            <span className="muted" style={{ fontWeight: 400 }}> — map them in Config → Connectors</span>
          </h3>
          <SentryIssueList issues={unmapped} groupByProject />
        </section>
      )}
    </main>
  )
}
