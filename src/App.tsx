import { useState } from 'react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { TokenSetup } from './components/TokenSetup'
import { Dashboard } from './components/Dashboard'
import { auth } from './store/auth'

export function App() {
  const [token, setToken] = useState<string | null>(() => auth.get())

  // LazyMotion + the `m` component in ui.tsx defers the full motion bundle
  // (~30KB) until needed; only the DOM animation features ship up front.
  return (
    <LazyMotion features={domAnimation}>
      {!token ? (
        <TokenSetup
          onSubmit={(t) => {
            auth.set(t)
            setToken(t)
          }}
        />
      ) : (
        <Dashboard
          token={token}
          onLogout={() => {
            auth.clear()
            setToken(null)
          }}
        />
      )}
    </LazyMotion>
  )
}
