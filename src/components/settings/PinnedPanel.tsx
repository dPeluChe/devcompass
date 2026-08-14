import type { PinnedRepo } from '../../store/db'

type Props = {
  pinned: PinnedRepo[]
  onUnpin: (repoId: string) => void
}

export function PinnedPanel({ pinned, onUnpin }: Props) {
  return (
    <section>
      <h2>Pinned Repos</h2>
      {pinned.length === 0 ? (
        <p className="muted">No pinned repos yet. Pin repos from the repo list.</p>
      ) : (
        <ul className="pinned-list">
          {pinned.map(p => (
            <li key={p.repoId}>
              <span>{p.nameWithOwner}</span>
              <button onClick={() => onUnpin(p.repoId)}>Unpin</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
