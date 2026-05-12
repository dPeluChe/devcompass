import { useEffect } from 'react'
import type { Repo } from '../api/github'
import { RepoDetail } from './RepoDetail'

type Props = {
  token: string
  repos: Repo[]
  current: { owner: string; name: string }
  onSelect: (r: Repo) => void
  onClose: () => void
}

/**
 * Repo detail panel with prev/next navigation through the current repo list.
 * Mounted inside HomeShell's main column so the sidebar stays visible while
 * the user is reading a repo.
 */
export function RepoBrowser({ token, repos, current, onSelect, onClose }: Props) {
  const idx = repos.findIndex((r) => r.owner.login === current.owner && r.name === current.name)
  const prev = idx > 0 ? repos[idx - 1] : null
  const next = idx >= 0 && idx < repos.length - 1 ? repos[idx + 1] : null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prev) onSelect(prev)
      else if (e.key === 'ArrowRight' && next) onSelect(next)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next, onClose, onSelect])

  return (
    <main className="hs-main repo-browser">
      <div className="browser-nav">
        <button onClick={onClose} className="link-btn">← Back to list</button>
        <span className="muted nav-pos">
          {idx >= 0 ? `${idx + 1} / ${repos.length}` : ''}
        </span>
        <div className="browser-nav-arrows">
          <button onClick={() => prev && onSelect(prev)} disabled={!prev} title="← prev (left arrow)">
            ← {prev ? prev.name : ''}
          </button>
          <button onClick={() => next && onSelect(next)} disabled={!next} title="next (right arrow) →">
            {next ? next.name : ''} →
          </button>
        </div>
      </div>
      <RepoDetail
        key={`${current.owner}/${current.name}`}
        token={token}
        owner={current.owner}
        name={current.name}
        onClose={onClose}
      />
    </main>
  )
}
