import { useEffect, useRef, useState } from 'react'
import { DEMO_TOKEN } from '../api/demo-data'

type Props = { onSubmit: (token: string) => void }

export function TokenSetup({ onSubmit }: Props) {
  const [token, setToken] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-trust login-trust-top">
          <span className="trust-badge green"><span className="trust-dot green" />Local-first</span>
          <span className="trust-badge purple"><span className="trust-dot purple" />Zero analytics</span>
        </div>

        <div className="login-card">

          <div className="login-logo">
            <img src="/favicon.svg" width="52" height="52" alt="devcompass" />
          </div>
          <h1 className="login-title">devcompass</h1>
          <p className="login-subtitle">Your GitHub command center. Local-first.</p>

          <div className="login-instructions">
            <h3>How to get a token</h3>
            <ol>
              <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">github.com/settings/tokens</a></li>
              <li>Create a <strong>classic</strong> token with scopes: <code>repo</code> + <code>read:org</code></li>
              <li>Paste it below — stays in your browser, never leaves your machine</li>
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
            <button type="submit" disabled={!token.trim()} className="btn-connect">
              Connect →
            </button>
          </form>

          <div className="login-demo-row">
            <button
              type="button"
              className="btn-demo"
              onClick={() => onSubmit(DEMO_TOKEN)}
            >
              Try demo
            </button>
          </div>

        </div>

        <div className="login-trust login-trust-bottom">
          <span className="trust-badge blue"><span className="trust-dot blue" />Token in your browser</span>
          <span className="trust-badge yellow"><span className="trust-dot yellow" />No external storage</span>
        </div>
      </div>
    </div>
  )
}
