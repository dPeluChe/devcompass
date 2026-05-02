import { useState } from 'react'
import { TokenSetup } from './components/TokenSetup'
import { Dashboard } from './components/Dashboard'
import { auth } from './store/auth'

export function App() {
  const [token, setToken] = useState<string | null>(() => auth.get())

  if (!token) {
    return (
      <TokenSetup
        onSubmit={(t) => {
          auth.set(t)
          setToken(t)
        }}
      />
    )
  }

  return (
    <Dashboard
      token={token}
      onLogout={() => {
        auth.clear()
        setToken(null)
      }}
    />
  )
}
