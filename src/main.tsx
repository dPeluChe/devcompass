import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { queryClient } from './store/queries'
import { App } from './App'
import { RepoDetail } from './components/RepoDetail'
import { TokenSetup } from './components/TokenSetup'
import { auth } from './store/auth'
import './styles.css'

function ProtectedRoute({ children }: { children: () => React.ReactNode }) {
  const token = auth.get()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  const Child = children()
  return <>{Child}</>
}

function TokenSetupWrapper() {
  return (
    <TokenSetup
      onSubmit={(token) => {
        auth.set(token)
        window.location.href = '/'
      }}
    />
  )
}

function RepoPage() {
  const token = auth.get()
  const params = useParams()
  if (!token || !params.owner || !params.name) return null
  return <RepoDetail token={token} owner={params.owner} name={params.name} onClose={() => window.history.back()} />
}

/**
 * Legacy `/prs/owner/name/123` deep links — the standalone PR page is gone.
 * Redirect to `/?pr=owner/name/123` so HomeShell pops its DetailModal on mount.
 */
function PRRedirect() {
  const params = useParams()
  if (!params.owner || !params.name || !params.number) return <Navigate to="/" replace />
  return <Navigate to={`/?pr=${params.owner}/${params.name}/${params.number}`} replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<TokenSetupWrapper />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {() => <App />}
              </ProtectedRoute>
            }
          >
            <Route path="repos/:owner/:name" element={<RepoPage />} />
            <Route path="prs/:owner/:name/:number" element={<PRRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)