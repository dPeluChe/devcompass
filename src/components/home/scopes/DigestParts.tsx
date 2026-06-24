export function DigestStat({ value, label, sub, tone }: { value: number | string; label: string; sub: string; tone?: 'warn' }) {
  return (
    <div className={`digest-stat ${tone ?? ''}`}>
      <span className="digest-stat-num">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="digest-stat-label">{label}</span>
      <span className="digest-stat-sub muted">{sub}</span>
    </div>
  )
}

export type AttnLevel = 'ok' | 'info' | 'warn'
export function DigestAttn({ level, label, action }: { level: AttnLevel; label: string; action?: { label: string; onClick: () => void } }) {
  const icon = level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '·'
  return (
    <li className={`digest-attn digest-attn-${level}`}>
      <span className="digest-attn-icon">{icon}</span>
      <span className="digest-attn-label">{label}</span>
      {action && (
        <button className="digest-attn-btn" onClick={action.onClick}>{action.label}</button>
      )}
    </li>
  )
}

/** Tiny commit-activity bars for a most-active row. Hidden until data lands. */
export function Sparkline({ buckets }: { buckets?: number[] }) {
  if (!buckets) return <span className="digest-spark" aria-hidden />
  const max = Math.max(...buckets, 1)
  const total = buckets.reduce((a, b) => a + b, 0)
  return (
    <span className="digest-spark" title={`${total} commit${total === 1 ? '' : 's'} on the default branch in window`}>
      {buckets.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(8, Math.round((v / max) * 100))}%`, opacity: v === 0 ? 0.25 : 0.9 }} />
      ))}
    </span>
  )
}
