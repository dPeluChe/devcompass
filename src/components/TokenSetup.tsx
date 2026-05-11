import { useEffect, useRef, useState } from 'react'

type Props = { onSubmit: (token: string) => void }

export function TokenSetup({ onSubmit }: Props) {
  const [token, setToken] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.575-2.79 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </div>
          <h1>GH Viewer</h1>
          <p className="login-subtitle">Your personal dashboard for repos & PRs</p>
          
          <div className="login-instructions">
            <h3>How to get a token</h3>
            <ol>
              <li>Go to <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer">github.com/settings/tokens</a></li>
              <li>Create a classic token with scopes: <code>repo</code> + <code>read:org</code></li>
              <li>Token is stored only in localStorage. Never leaves your machine.</li>
            </ol>
          </div>
          
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (token.trim()) onSubmit(token.trim())
            }}
          >
            <input
              ref={inputRef}
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_... or github_pat_..."
            />
            <button type="submit" disabled={!token.trim()}>
              Connect
            </button>
          </form>
        </div>
        
        <p className="login-footer">Local access only · Your token is never transmitted</p>
      </div>
    </div>
  )
}