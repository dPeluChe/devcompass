import './home.css'

const SIDEBAR_GROUPS = [
  { title: 'Inbox', items: 3 },
  { title: 'Workbench', items: 3 },
  { title: 'Insights', items: 2 }
]

const MAIN_ROWS = 6

/**
 * Layout twin of `<HomeShell>` rendered while the initial sync is running.
 * Mirrors the sidebar + row grid so the page doesn't jump from a repo-card
 * grid skeleton to the home layout once data lands. Pure structure — no
 * data hooks, no interactivity.
 */
export function HomeSkeleton({ progressMsg }: { progressMsg?: string }) {
  return (
    <div className="hs-shell">
      <aside className="hs-sidebar" aria-hidden="true">
        <div className="hs-sidebar-head">
          <span className="hs-skeleton-bar" style={{ width: 28, height: 18 }} />
        </div>
        <div className="hs-sidebar-scroll">
          {SIDEBAR_GROUPS.map((g) => (
            <div className="hs-sidebar-group" key={g.title}>
              <h4>{g.title}</h4>
              {Array.from({ length: g.items }).map((_, i) => (
                <div className="hs-sidebar-item" key={i} style={{ pointerEvents: 'none' }}>
                  <span className="hs-skeleton-bar" style={{ width: 14, height: 10 }} />
                  <span className="hs-skeleton-bar" style={{ flex: 1, maxWidth: 120 }} />
                  <span className="hs-skeleton-bar" style={{ width: 22, height: 10 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className="hs-main" aria-busy="true" aria-live="polite">
        <div className="hs-skeleton-block">
          <span className="hs-skeleton-bar" style={{ width: 180, height: 14 }} />
          {progressMsg && <span className="muted">{progressMsg}</span>}
        </div>
        {Array.from({ length: MAIN_ROWS }).map((_, i) => (
          <div className="hs-row" key={i} style={{ pointerEvents: 'none' }}>
            <span className="hs-skeleton-bar" style={{ width: 8, height: 8, borderRadius: '50%' }} />
            <div className="hs-row-main">
              <div className="hs-row-title">
                <span className="hs-skeleton-bar" style={{ width: 18, height: 18, borderRadius: '50%' }} />
                <span className="hs-skeleton-bar" style={{ width: 90 }} />
                <span className="hs-skeleton-bar" style={{ width: 140 }} />
              </div>
              <div className="hs-row-meta">
                <span className="hs-skeleton-bar" style={{ width: 72 }} />
                <span className="hs-skeleton-bar" style={{ width: 32 }} />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
