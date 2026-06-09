import './landing.css'

const REPO = 'https://github.com/dPeluChe/devcompass'

function GhMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.17 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.82 1.1.82 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.57 21.79 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function BrandMark({ className }: { className?: string }) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden />
}

const FEATURES = [
  { t: 'Complete panorama', d: 'Every repo you touch — owner, member and collaborator — across all your orgs, in one place.' },
  { t: 'Unified Issues', d: 'GitHub issues assigned to you + Sentry errors, grouped by repo, with in-app detail and copy-for-agent.' },
  { t: 'Notifications', d: 'Cross-repo inbox: mentions, review requests and assignments across every repo — even unsynced ones.' },
  { t: 'Needs me & Digest', d: 'PRs awaiting your review, plus an operational digest with an activity heatmap.' },
  { t: 'Connectors', d: 'Sentry today; the same relay extends to Linear, Jira and more — all BYOK, all in your browser.' },
  { t: 'Local-first', d: 'IndexedDB caches everything; reloads paint instantly. No backend holds your data.' },
]

export default function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="lp">
      <div className="lp-wrap">
        <nav className="lp-nav">
          <a className="lp-brand" href="/"><img src="/favicon.svg" alt="" />devcompass</a>
          <div className="lp-nav-links">
            <a href="#why">Why</a>
            <a href="#features">Features</a>
            <a href="#privacy">Privacy</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub ↗</a>
            <button type="button" className="lp-btn primary" onClick={onGetStarted}>Open the app</button>
          </div>
        </nav>

        <header className="lp-hero">
          <span className="lp-badge">MIT · No backend · BYOK</span>
          <h1 className="lp-h1">
            <span className="soft"><GhMark className="gh-mark" />GitHub is built for one repo at a time.</span>
            <span className="vs" aria-hidden>vs</span>
            <span className="strong"><BrandMark className="brand-mark" />devcompass is built for <span className="grad">all of them.</span></span>
          </h1>
          <p className="lp-lede">Your complete cross-org GitHub panorama — repos, PRs, issues and errors — in one fast, local-first cockpit. Nothing leaves your browser.</p>
          <div className="lp-trust">
            <span><i style={{ background: '#3fb950' }} />Local-first</span>
            <span><i style={{ background: '#58a6ff' }} />Token in your browser</span>
            <span><i style={{ background: '#8d5494' }} />Zero analytics</span>
            <span><i style={{ background: '#e9a23b' }} />No external storage</span>
          </div>
          <div className="lp-cta-row">
            <button type="button" className="lp-btn primary" onClick={onGetStarted}>Get started →</button>
            <a className="lp-btn" href={REPO} target="_blank" rel="noopener noreferrer">Star on GitHub</a>
          </div>
        </header>

        <section id="why" className="lp-section">
          <p className="lp-eyebrow">Why</p>
          <h2>One GitHub tab can't answer your morning's questions.</h2>
          <div className="lp-vs">
            <div className="lp-vs-col">
              <h3><GhMark className="gh-mark" />github.com</h3>
              <ul>
                <li>Per-repo dashboards</li>
                <li>Notifications buried in a separate inbox</li>
                <li>Collaborator repos scattered across orgs</li>
                <li>Search — if you know what to type</li>
              </ul>
            </div>
            <div className="lp-vs-col strong">
              <h3><BrandMark className="vs-mark" />devcompass</h3>
              <ul>
                <li>All your participation, one navigable map</li>
                <li>Unified Issues: GitHub + Sentry, by repo</li>
                <li>Cross-repo notifications inbox</li>
                <li>Copy-for-agent: triage → task in a click</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <p className="lp-eyebrow">30 seconds</p>
          <h2>No signup. No backend account. Bring a PAT.</h2>
          <p className="lp-note">We store <strong>nothing</strong> on a server. Your token, repos and cache live only in your browser's local database (IndexedDB), on your machine — clear your site data and it's gone.</p>
          <ol className="lp-steps">
            <li className="lp-step"><span className="lp-step-num">01</span><h3>Open the app</h3><p>Hosted, or <code>npm run dev</code> on your own machine.</p></li>
            <li className="lp-step"><span className="lp-step-num">02</span><h3>Paste your token</h3><p>Classic PAT with <code>repo</code> + <code>read:org</code>. Stays in your browser.</p></li>
            <li className="lp-step"><span className="lp-step-num">03</span><h3>See everything</h3><p>Your repos, PRs, issues and errors load into one cockpit.</p></li>
          </ol>
        </section>

        <section id="features" className="lp-section">
          <p className="lp-eyebrow">What you get</p>
          <h2>Every signal you track, in one screen.</h2>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.t} className="lp-feature">
                <span className="lp-feature-icon">∿</span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="privacy" className="lp-section">
          <p className="lp-eyebrow">Privacy</p>
          <h2>Your token. Your machine. Our problem to keep it that way.</h2>
          <div className="lp-privacy">
            <div className="lp-pcard"><span className="tag">Token</span><h3>Lives in <code>localStorage</code></h3><p>Sent only to the provider's API (GitHub, Sentry). Never to a server we operate.</p></div>
            <div className="lp-pcard"><span className="tag">Cache</span><h3>IndexedDB on your machine</h3><p>TTL-bound, auto-pruned, fully transparent in the Cache panel.</p></div>
            <div className="lp-pcard"><span className="tag">Analytics</span><h3>None. Zero. Ever.</h3><p>No trackers, no telemetry, no third-party scripts.</p></div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-selfhost-grid">
            <div>
              <p className="lp-eyebrow">Self-host</p>
              <h2>Run it yourself.</h2>
              <p style={{ color: 'var(--muted)' }}>MIT-licensed. Static bundle. No server, no DB, no DevOps.</p>
              <a className="lp-btn" href={`${REPO}#quick-start`} target="_blank" rel="noopener noreferrer">Self-host docs →</a>
            </div>
            <pre className="lp-code"><code><span className="c">$ </span>git clone github.com/dPeluChe/devcompass{'\n'}<span className="c">$ </span>cd devcompass{'\n'}<span className="c">$ </span>npm install{'\n'}<span className="c">$ </span>npm run dev{'\n'}<span className="ok">  → http://localhost:8099</span></code></pre>
          </div>
        </section>

        <section className="lp-section lp-final">
          <h2>Stop tab-hopping. Find your north.</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 22 }}>30 seconds. A classic PAT. Your morning back.</p>
          <div className="lp-cta-row" style={{ justifyContent: 'center' }}>
            <button type="button" className="lp-btn primary" onClick={onGetStarted}>Open the app →</button>
            <a className="lp-btn" href={REPO} target="_blank" rel="noopener noreferrer">View source</a>
          </div>
        </section>

        <footer className="lp-footer">
          <div className="lp-footer-brand">
            <a className="lp-brand" href="/"><img src="/favicon.svg" alt="" />devcompass</a>
            <span className="lp-footer-muted">MIT · built by <a href="https://github.com/dPeluChe" target="_blank" rel="noopener noreferrer">dPeluChe</a></span>
          </div>
          <nav className="lp-footer-links">
            <a href={REPO} target="_blank" rel="noopener noreferrer">Repo</a>
            <a href={`${REPO}/blob/main/docs/README.md`} target="_blank" rel="noopener noreferrer">Docs</a>
            <a href={`${REPO}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer">Security</a>
            <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">Issues</a>
          </nav>
        </footer>
      </div>
    </div>
  )
}
