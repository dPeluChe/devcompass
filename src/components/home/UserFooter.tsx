import type { Viewer } from '../../api/github'

type Props = {
  viewer: Viewer | undefined
  collapsed: boolean
  onLogout: () => void
}

export function UserFooter({ viewer, collapsed, onLogout }: Props) {
  return (
    <div className="hs-sidebar-footer">
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
