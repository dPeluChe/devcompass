import { useMemo, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import { SiSentry } from 'react-icons/si'
import { Header, type ScopeProps } from './common'
import { useUnifiedIssues, type IssueSource, type UnifiedIssue } from '../useUnifiedIssues'
import { SentryIssueModal } from '../../connectors/SentryIssueModal'
import { relativeTime } from '../../../utils/time'
import type { SentryIssue } from '../../../api/sentry'

const UNMAPPED = '(no repo)'

export function IssuesScope({ token, viewer }: ScopeProps) {
  const [filter, setFilter] = useState<'all' | IssueSource>('all')
  const [selectedSentry, setSelectedSentry] = useState<SentryIssue | null>(null)
  const { items, isLoading, error, githubCount, sentryCount } = useUnifiedIssues(token, viewer?.login)

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.source === filter)),
    [items, filter]
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
    return [...m.entries()].sort((a, b) => {
      if (a[0] === UNMAPPED) return 1
      if (b[0] === UNMAPPED) return -1
      return a[0].localeCompare(b[0])
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

      {isLoading && <div className="hs-empty"><strong>Loading…</strong></div>}
      {error && (
        <div className="hs-empty" style={{ color: 'var(--danger)' }}>
          <strong>Failed to load GitHub issues.</strong>{error instanceof Error ? error.message : String(error)}
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div className="hs-empty">
          <strong>No open issues. 🎉</strong>
          GitHub issues assigned to you and unresolved Sentry errors show here.
        </div>
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
            {list.map((it) => <UnifiedRow key={it.id} it={it} onOpenSentry={setSelectedSentry} />)}
          </div>
        </section>
      ))}

      <SentryIssueModal issue={selectedSentry} onClose={() => setSelectedSentry(null)} />
    </main>
  )
}

function UnifiedRow({ it, onOpenSentry }: { it: UnifiedIssue; onOpenSentry: (i: SentryIssue) => void }) {
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
    </>
  )

  if (it.source === 'sentry' && it.sentry) {
    const s = it.sentry
    return (
      <div
        className="hs-issue-row"
        role="button"
        tabIndex={0}
        onClick={() => onOpenSentry(s)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSentry(s) } }}
      >
        {inner}
      </div>
    )
  }
  return (
    <a className="hs-issue-row" href={it.url} target="_blank" rel="noopener noreferrer">{inner}</a>
  )
}
