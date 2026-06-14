import { useMemo, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import { SiSentry } from 'react-icons/si'
import { Header, ScopeSkeleton, type ScopeProps } from './common'
import { useUnifiedIssues, type IssueSource, type UnifiedIssue } from '../useUnifiedIssues'
import { SentryIssueModal } from '../../connectors/SentryIssueModal'
import { GitHubIssueModal, type GitHubIssueRef } from '../GitHubIssueModal'
import { relativeTime } from '../../../utils/time'
import type { SentryIssue } from '../../../api/sentry'

const UNMAPPED = '(no repo)'

export function IssuesScope({ token, viewer }: ScopeProps) {
  const [filter, setFilter] = useState<'all' | IssueSource>('all')
  const [textFilter, setTextFilter] = useState('')
  const [selectedSentry, setSelectedSentry] = useState<SentryIssue | null>(null)
  const [selectedGithub, setSelectedGithub] = useState<GitHubIssueRef | null>(null)
  const { items, isLoading, error, githubCount, sentryCount, truncated } = useUnifiedIssues(token, viewer?.login)

  const q = textFilter.trim().toLowerCase()
  const filtered = useMemo(
    () => items.filter((i) =>
      (filter === 'all' || i.source === filter) &&
      (!q || i.title.toLowerCase().includes(q) || (i.repo ?? '').toLowerCase().includes(q))
    ),
    [items, filter, q]
  )

  const groups = useMemo(() => {
    const m = new Map<string, UnifiedIssue[]>()
    for (const it of filtered) {
      const k = it.repo ?? UNMAPPED
      const list = m.get(k)
      if (list) list.push(it)
      else m.set(k, [it])
    }
    for (const list of m.values()) {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    // Repos with the most recent activity first (lists are sorted desc, so a
    // group's recency is its first item). Unmapped Sentry issues sink last.
    return [...m.entries()].sort((a, b) => {
      if (a[0] === UNMAPPED) return 1
      if (b[0] === UNMAPPED) return -1
      return new Date(b[1][0].updatedAt).getTime() - new Date(a[1][0].updatedAt).getTime()
    })
  }, [filtered])

  return (
    <main className="hs-main">
      <Header title="Issues" count={filtered.length} meta="GitHub (assigned to you) + Sentry, grouped by repo" />

      <div className="hs-issue-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All <span className="muted">{items.length}</span>
        </button>
        <button className={filter === 'github' ? 'active' : ''} onClick={() => setFilter('github')}>
          GitHub <span className="muted">{githubCount}</span>
        </button>
        <button className={filter === 'sentry' ? 'active' : ''} onClick={() => setFilter('sentry')}>
          Sentry <span className="muted">{sentryCount}</span>
        </button>
      </div>

      {(truncated.github || truncated.sentry) && (
        <p className="hs-truncation-note muted">
          Showing the first
          {truncated.github ? ` ${githubCount} GitHub issues` : ''}
          {truncated.github && truncated.sentry ? ' and' : ''}
          {truncated.sentry ? ` ${sentryCount} Sentry issues` : ''}
          {' '}— there may be more on the provider.
        </p>
      )}

      {items.length > 8 && (
        <input
          className="hs-scope-filter"
          placeholder="Filter by title or repo…"
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
        />
      )}

      {isLoading && <ScopeSkeleton />}
      {error && (
        <div className="hs-empty" style={{ color: 'var(--danger)' }}>
          <strong>Failed to load GitHub issues.</strong>{error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <div className="hs-empty">
          <strong>No open issues. 🎉</strong>
          GitHub issues assigned to you and unresolved Sentry errors show here.
        </div>
      )}
      {!isLoading && items.length > 0 && filtered.length === 0 && (
        <div className="hs-empty"><strong>No matches.</strong></div>
      )}

      {groups.map(([repo, list]) => (
        <section key={repo} className="hs-issue-group">
          <h3 className="hs-issue-group-head">
            {repo === UNMAPPED
              ? <span className="muted">{UNMAPPED}</span>
              : <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer">{repo}</a>}
            <span className="muted"> · {list.length}</span>
          </h3>
          <div className="hs-surface">
            {list.map((it) => (
              <UnifiedRow
                key={it.id}
                it={it}
                onOpenSentry={setSelectedSentry}
                onOpenGithub={(ref) => setSelectedGithub({ token, ...ref })}
              />
            ))}
          </div>
        </section>
      ))}

      <SentryIssueModal issue={selectedSentry} onClose={() => setSelectedSentry(null)} />
      <GitHubIssueModal issue={selectedGithub} onClose={() => setSelectedGithub(null)} />
    </main>
  )
}

function UnifiedRow({ it, onOpenSentry, onOpenGithub }: {
  it: UnifiedIssue
  onOpenSentry: (i: SentryIssue) => void
  onOpenGithub: (ref: { owner: string; name: string; number: number }) => void
}) {
  const inner = (
    <>
      <span className={`hs-dot ${it.dot}`} />
      {it.source === 'sentry'
        ? <SiSentry className="hs-issue-src sentry" aria-hidden />
        : <FaGithub className="hs-issue-src gh" aria-hidden />}
      <div className="hs-issue-main">
        <span className="hs-issue-title">{it.title}</span>
        <div className="hs-issue-meta muted">{it.metaLine} · {relativeTime(it.updatedAt)}</div>
      </div>
      <a
        className="hs-issue-ext"
        href={it.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open externally"
        onClick={(e) => e.stopPropagation()}
      >↗</a>
    </>
  )

  const onOpen = it.source === 'sentry' && it.sentry
    ? () => onOpenSentry(it.sentry!)
    : it.source === 'github' && it.github
      ? () => onOpenGithub(it.github!)
      : null

  if (!onOpen) {
    return <a className="hs-issue-row" href={it.url} target="_blank" rel="noopener noreferrer">{inner}</a>
  }
  return (
    <div
      className="hs-issue-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      {inner}
    </div>
  )
}
