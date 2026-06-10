import { StrictMode, Suspense, lazy, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { queryClient } from './store/queries'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RepoDetail } from './components/RepoDetail'
import { TokenSetup } from './components/TokenSetup'
import { auth } from './store/auth'
import { uiPrefsStore } from './store/uiPrefs'
import { pruneExpiredCachePrefs } from './store/db'
import './styles.css'

// Lazy so logged-in users never download the marketing landing.
const Landing = lazy(() => import('./components/landing/Landing'))

// Applies the atmospheric background on EVERY route (login included) — the
// effect used to live in App.tsx, which only mounts on authenticated routes,
// so /login rendered without it.
function FancyBg() {
  const fancyBg = uiPrefsStore((s) => s.fancyBg)
  useEffect(() => { document.body.classList.toggle('fancy-bg', fancyBg) }, [fancyBg])
  return null
}

// Sweep stale TTL-bound cache rows once on boot so the Cache tab and any
// downstream reads start from a clean baseline. Fire-and-forget — the
// promise rejection is swallowed since IDB unavailability isn't fatal.
pruneExpiredCachePrefs().catch(() => {})

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = auth.get()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
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

/** Root: the marketing landing for logged-out visitors, the app once a token exists. */
function RootRoute() {
  const navigate = useNavigate()
  if (auth.get()) return <App />
  return (
    <Suspense fallback={null}>
      <Landing onGetStarted={() => navigate('/login')} />
    </Suspense>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FancyBg />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<TokenSetupWrapper />} />
          <Route path="/repos/:owner/:name" element={<ProtectedRoute><ErrorBoundary label="the repo view"><RepoPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/prs/:owner/:name/:number" element={<ProtectedRoute><PRRedirect /></ProtectedRoute>} />
          <Route path="/*" element={<ErrorBoundary label="the app"><RootRoute /></ErrorBoundary>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)