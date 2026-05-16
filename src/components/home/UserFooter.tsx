import type { Viewer } from '../../api/github'

type Props = {
  viewer: Viewer | undefined
  collapsed: boolean
  onLogout: () => void
}

export function UserFooter({ viewer, collapsed, onLogout }: Props) {
  return (
    <div className="hs-sidebar-footer">
      {!collapsed && (
        <div className="hs-about">
          <a
            href="https://github.com/dPeluChe/devcompass/issues/new?template=bug.md"
            target="_blank"
            rel="noreferrer"
            className="hs-about-link"
          >
            Report a bug ↗
          </a>
          <a
            href="https://github.com/dPeluChe/devcompass"
            target="_blank"
            rel="noreferrer"
            className="hs-about-link"
          >
            GitHub ↗
          </a>
          <span className="hs-about-version">v0.5.0 · MIT</span>
        </div>
      )}
      <button
        className="hs-user-btn"
        title={viewer ? `@${viewer.login} — click to log out` : 'Not signed in'}
        onClick={onLogout}
      >
        {viewer?.avatarUrl ? (
          <img className="hs-user-avatar" src={viewer.avatarUrl} alt="" width={26} height={26} />
        ) : (
          <span className="hs-user-avatar hs-user-avatar-fallback">·</span>
        )}
        {!collapsed && (
          <>
            <span className="hs-user-name">@{viewer?.login ?? '...'}</span>
            <span className="hs-user-caret">▾</span>
          </>
        )}
      </button>
    </div>
  )
}
