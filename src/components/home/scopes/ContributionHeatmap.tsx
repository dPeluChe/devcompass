import { useEffect, useState } from 'react'
import { fetchContributionCalendar, type ContribCalendar, type ContribDay } from '../../../api/github'
import { getCachedPref, savePref } from '../../../store/db'

const CACHE_TTL = 12 * 60 * 60 * 1000 // 12h — matches CACHE_TTLS['contrib:']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const LEGEND_TIPS = [
  'No contributions on that day',
  'Low activity (1–3 contributions)',
  'Moderate activity (4–7 contributions)',
  'High activity (8–15 contributions)',
  'Peak activity (16+ contributions)'
]

type Props = {
  token: string
  viewerLogin: string | undefined
}

/**
 * GitHub-style 53-week contribution calendar for the viewer. One GraphQL
 * query, cached in IDB for 12h — visible change between sessions only every
 * half-day. Falls back to skeleton while loading and an unobtrusive error
 * banner if the call fails (the rest of Digest stays useful).
 */
export function ContributionHeatmap({ token, viewerLogin }: Props) {
  const [data, setData] = useState<ContribCalendar | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const key = `contrib:${viewerLogin ?? 'session'}`
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const cached = await getCachedPref<ContribCalendar>(key, CACHE_TTL)
        if (cached && alive) {
          setData(cached)
          setLoading(false)
          return
        }
        const fresh = await fetchContributionCalendar(token)
        if (!alive) return
        await savePref(key, fresh)
        setData(fresh)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [token, viewerLogin])

  if (loading && !data) {
    return (
      <section className="digest-section">
        <h3 className="digest-section-title">Your contribution heatmap <span className="muted">— last 53 weeks</span></h3>
        <div className="digest-heatmap-skel" aria-hidden />
      </section>
    )
  }

  if (error && !data) {
    return (
      <section className="digest-section">
        <h3 className="digest-section-title">Your contribution heatmap</h3>
        <div className="hs-empty"><strong>Couldn't load calendar.</strong> <span className="muted">{error}</span></div>
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="digest-section">
      <h3 className="digest-section-title">
        Your contribution heatmap
        <span className="muted">— {data.totalContributions.toLocaleString()} contributions in the last 53 weeks (cached 12h)</span>
      </h3>
      <Heatmap data={data} />
    </section>
  )
}

function Heatmap({ data }: { data: ContribCalendar }) {
  const months = monthLabelPositions(data.weeks)
  const todayIso = todayLocalIso()
  return (
    <div className="digest-heatmap" role="img" aria-label="GitHub-style contribution calendar">
      <div className="digest-heatmap-months">
        {months.map((m) => (
          <span key={`${m.label}-${m.col}`} className="digest-heatmap-month" style={{ gridColumn: m.col + 1 }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="digest-heatmap-body">
        <div className="digest-heatmap-days">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="digest-heatmap-day-label">{d}</span>
          ))}
        </div>
        <div className="digest-heatmap-grid">
          {data.weeks.map((week, wi) => (
            <div className="digest-heatmap-col" key={week.firstDay}>
              {Array.from({ length: 7 }).map((_, di) => {
                const day = week.contributionDays.find((d) => d.weekday === di)
                return day ? (
                  <span
                    key={day.date}
                    className={`digest-heatmap-cell hs-tip level-${bucket(day)} ${day.date === todayIso ? 'is-today' : ''}`}
                    style={{ background: day.color }}
                    data-tip={`${day.date === todayIso ? 'Today · ' : ''}${day.contributionCount} contribution${day.contributionCount === 1 ? '' : 's'} · ${formatTipDate(day.date)}`}
                    aria-label={`${day.contributionCount} contributions on ${day.date}${day.date === todayIso ? ' (today)' : ''}`}
                    role="img"
                    tabIndex={0}
                  />
                ) : (
                  <span key={`empty-${wi}-${di}`} className="digest-heatmap-cell digest-heatmap-cell--empty" />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="digest-heatmap-legend">
        <span
          className="muted hs-tip"
          data-tip="Days with the fewest (or zero) contributions"
        >Less</span>
        {[0, 1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className={`digest-heatmap-cell legend hs-tip level-${b}`}
            data-tip={LEGEND_TIPS[b]}
          />
        ))}
        <span
          className="muted hs-tip"
          data-tip="Days with the most contributions"
        >More</span>
      </div>
    </div>
  )
}

/** Pick the first day of each month in the visible window and remember its column. */
function monthLabelPositions(weeks: ContribCalendar['weeks']): { label: string; col: number }[] {
  const out: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((w, col) => {
    const first = w.contributionDays[0] ?? w.contributionDays.find((d) => d.weekday === 0)
    if (!first) return
    const m = new Date(first.date).getMonth()
    if (m !== lastMonth) {
      // GitHub leaves the very first column unlabeled so labels don't crowd —
      // only push a label if there's at least 2 weeks of room before it.
      if (col === 0 || col - (out.at(-1)?.col ?? -10) >= 3) {
        out.push({ label: MONTH_LABELS[m], col })
      }
      lastMonth = m
    }
  })
  return out
}

/** Local-time YYYY-MM-DD (matches GitHub's calendar `date` field). */
function todayLocalIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Pretty date for tooltip — "Mon, May 13, 2026". */
function formatTipDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    })
  } catch {
    return iso
  }
}

/** Map GitHub color (or count fallback) → 0..4 bucket for level classes. */
function bucket(day: ContribDay): number {
  const c = day.color?.toLowerCase()
  if (c === '#ebedf0') return 0
  if (c === '#9be9a8') return 1
  if (c === '#40c463') return 2
  if (c === '#30a14e') return 3
  if (c === '#216e39') return 4
  const n = day.contributionCount
  if (n === 0) return 0
  if (n < 4) return 1
  if (n < 8) return 2
  if (n < 16) return 3
  return 4
}
