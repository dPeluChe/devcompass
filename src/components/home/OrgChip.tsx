import { useState } from 'react'

const ORG_COLORS: Record<string, string> = {
  Iteristech: '#5e8b65',
  dPeluChe: '#a371f7',
  HoloChat: '#f08c4f',
  'plerk-io': '#58a6ff',
  dedoPoderoso: '#f85149'
}

// Fallback palette keyed by a stable hash of the org login. Same login → same color.
const FALLBACK_PALETTE = ['#58a6ff', '#a371f7', '#3fb950', '#f08c4f', '#f85149', '#d29922', '#5e8b65', '#79b8ff']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function colorForOrg(login: string): string {
  return ORG_COLORS[login] ?? FALLBACK_PALETTE[hash(login) % FALLBACK_PALETTE.length]
}

function initials(login: string): string {
  return login.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2)
}

type Props = {
  login: string
  /** GitHub avatar URL — when present we render the real image, otherwise we fall back to a colored chip with initials. */
  avatarUrl?: string
  title?: string
  onClick?: () => void
  size?: number
}

export function OrgChip({ login, avatarUrl, title, onClick, size = 18 }: Props) {
  // Real avatar can fail to load (network, deleted account, missing scope). Track that
  // and fall back to the initials chip rather than showing a broken image.
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = avatarUrl && !imgFailed
  const label = title ?? `Filter by ${login}`

  const inner = showImage ? (
    <img
      src={avatarUrl}
      alt={login}
      className="org-avatar org-avatar-img"
      style={{ width: size, height: size }}
      onError={() => setImgFailed(true)}
    />
  ) : (
    <span
      className="org-avatar"
      style={{ background: colorForOrg(login), width: size, height: size }}
    >
      {initials(login)}
    </span>
  )

  if (onClick) {
    return (
      <button type="button" className="org-avatar-btn" title={label} aria-label={label} onClick={onClick}>
        {inner}
      </button>
    )
  }
  // Non-interactive: keep tooltip available on the visible element.
  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={login}
        title={label}
        className="org-avatar org-avatar-img"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <span
      className="org-avatar"
      style={{ background: colorForOrg(login), width: size, height: size }}
      title={label}
    >
      {initials(login)}
    </span>
  )
}
