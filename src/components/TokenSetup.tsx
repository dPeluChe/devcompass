import { useState } from 'react'

type Props = { onSubmit: (token: string) => void }

export function TokenSetup({ onSubmit }: Props) {
  const [token, setToken] = useState('')

  return (
    <div className="setup">
      <h1>GH Viewer</h1>
      <p>Pega tu Personal Access Token (PAT) para empezar.</p>
      <ol>
        <li>
          Crea uno en{' '}
          <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer">
            github.com/settings/tokens
          </a>
        </li>
        <li>
          Scopes mínimos: <code>repo</code> (para repos privados) + <code>read:org</code>
        </li>
        <li>El token se guarda solo en localStorage de este navegador. No sale de tu máquina.</li>
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (token.trim()) onSubmit(token.trim())
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_... o github_pat_..."
          autoFocus
        />
        <button type="submit" disabled={!token.trim()}>
          Conectar
        </button>
      </form>
    </div>
  )
}
