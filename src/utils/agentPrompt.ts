import type { GitHubIssueDetail } from '../api/github'
import type { SentryEventContext, SentryExceptionValue, SentryFrame, SentryIssue, SentrySuspectCommit } from '../api/sentry'

const FRAME_LIMIT = 15

/** "2026-06-13T21:14:58.000Z" → "2026-06-13 21:14 UTC". */
function fmtTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** "12 in 24h · 340 in 14d" from the issue's event time series — is it growing or dead? */
function trendLine(stats: SentryIssue['stats']): string | null {
  const series = stats?.['14d'] ?? (stats ? Object.values(stats)[0] : undefined)
  if (!series || series.length === 0) return null
  const cutoff = Date.now() / 1000 - 24 * 3600
  let last24 = 0, total = 0
  for (const [ts, c] of series) { total += c; if (ts >= cutoff) last24 += c }
  return `${last24} in 24h · ${total} in 14d`
}

/** Crash-first frames: in-app marked, consecutive duplicates collapsed, tail truncated. */
function formatFrames(frames: SentryFrame[]): string[] {
  const ordered = [...frames].reverse()
  const shown = ordered.slice(0, FRAME_LIMIT)
  const out: { text: string; count: number }[] = []
  for (const f of shown) {
    const loc = `${f.filename || f.module || '?'}${f.function ? ` in ${f.function}` : ''}${f.lineNo != null ? `:${f.lineNo}` : ''}`
    const text = `${loc}${f.inApp ? '   ← in-app' : ''}`
    const last = out[out.length - 1]
    if (last && last.text === text) last.count += 1
    else out.push({ text, count: 1 })
  }
  const lines = out.map((e) => (e.count > 1 ? `${e.text}   ×${e.count}` : e.text))
  if (ordered.length > FRAME_LIMIT) lines.push(`… +${ordered.length - FRAME_LIMIT} frames`)
  return lines
}

/**
 * Builds an actionable, paste-ready brief for a dev agent. Triage-feedback
 * format: high-signal fields first (type → message → environment → handled →
 * dates → release), then a fenced crash-first stacktrace, then breadcrumbs.
 * `ctx` carries the per-event context (env/handled/release/client/breadcrumbs)
 * — pass {} when the latest event hasn't loaded yet and it degrades gracefully.
 */
const RAW_JSON_CAP = 8000

export function buildSentryAgentText(
  issue: SentryIssue,
  exceptions: SentryExceptionValue[],
  repo: string | null,
  ctx: Partial<SentryEventContext> = {},
  rawEvent?: unknown,
  suspectCommits: SentrySuspectCommit[] = [],
): string {
  const primary = exceptions[0]
  const headType = primary?.type ?? issue.metadata?.type ?? null
  const headVal = primary?.value ?? issue.metadata?.value ?? issue.title
  const field = (label: string, value: string) => `${(label + ':').padEnd(14)}${value}`

  // Prefer the issue-level isUnhandled, then the per-event mechanism/tag.
  const unhandled = issue.isUnhandled ?? (ctx.handled == null ? null : !ctx.handled)

  const lines: string[] = [
    `Fix this Sentry error${repo ? ` in ${repo}` : ''}:`,
    '',
    `ISSUE: ${headType ? `${headType}: ${headVal}` : headVal}`,
  ]
  if (issue.culprit) lines.push(field('Culprit', issue.culprit))
  if (ctx.transaction) lines.push(field('Transaction', ctx.transaction))
  lines.push(field('Environment', ctx.environment ?? 'unknown'))
  lines.push(field('Handled', unhandled === true ? 'no (unhandled)' : unhandled === false ? 'yes (handled)' : 'unknown'))
  lines.push(field('Level', issue.level))
  if (issue.priority) lines.push(field('Priority', issue.priority))
  if (ctx.release) lines.push(field('Release', ctx.release))
  if (ctx.platform || ctx.runtime) lines.push(field('Platform', [ctx.platform, ctx.runtime].filter(Boolean).join(' · ')))
  lines.push(field('Events', `${issue.count} · Users: ${issue.userCount}`))
  const trend = trendLine(issue.stats)
  if (trend) lines.push(field('Trend', trend))
  const first = fmtTime(issue.firstSeen); const last = fmtTime(issue.lastSeen)
  if (first) lines.push(field('First seen', first))
  if (last) lines.push(field('Last seen', last))
  if (ctx.url) lines.push(field('URL', `${ctx.requestMethod ? `${ctx.requestMethod} ` : ''}${ctx.url}`))
  if (ctx.client) lines.push(field('Client', ctx.client))
  if (ctx.user) lines.push(field('User', ctx.user))
  if (ctx.sdk) lines.push(field('SDK', ctx.sdk))
  lines.push(field('Sentry issue', issue.permalink))
  if (ctx.eventId) {
    const base = issue.permalink.endsWith('/') ? issue.permalink : `${issue.permalink}/`
    lines.push(field('This event', `${base}events/${ctx.eventId}/`))
  }

  // Sentry's blame for the issue — where the agent should start looking.
  if (suspectCommits.length > 0) {
    lines.push('', 'Suspect commits (Sentry blame):')
    for (const c of suspectCommits) {
      const pr = c.prNumber ? ` (PR #${c.prNumber})` : ''
      const by = c.author ? ` — @${c.author}` : ''
      lines.push(`  ${c.shortSha} "${c.message}"${by}${pr}`)
    }
  }

  // Surface Sentry's own processing problems — this is why prod frames are minified.
  if (ctx.processingErrors && ctx.processingErrors.length > 0) {
    lines.push('', '⚠ Sentry could not fully process this event (frames may be minified — upload source maps):')
    for (const e of ctx.processingErrors) lines.push(`  - ${e}`)
  }

  for (const ex of exceptions) {
    const frames = ex.stacktrace?.frames
    if (!frames || frames.length === 0) continue
    lines.push('', `Exception (crash first): ${ex.type ?? 'Exception'}${ex.value ? `: ${ex.value}` : ''}`, '```')
    lines.push(...formatFrames(frames))
    lines.push('```')
  }

  if (ctx.breadcrumbs && ctx.breadcrumbs.length > 0) {
    lines.push('', `Breadcrumbs (last ${ctx.breadcrumbs.length}):`)
    for (const c of ctx.breadcrumbs) {
      lines.push(`  ${c.ts}  ${c.label.padEnd(8)} ${c.message}`.trimEnd())
    }
  }

  // Full raw event last (collapsed) — the readable summary stays on top, but an
  // agent gets the complete payload when it needs a field we didn't surface.
  if (rawEvent) {
    const json = JSON.stringify(rawEvent, null, 2)
    const capped = json.length > RAW_JSON_CAP ? `${json.slice(0, RAW_JSON_CAP)}\n… (truncated — open "This event" for the full payload)` : json
    lines.push('', '<details><summary>Raw event JSON</summary>', '', '```json', capped, '```', '</details>')
  }

  return lines.join('\n')
}

export function buildGithubIssueAgentText(detail: GitHubIssueDetail): string {
  const labels = detail.labels.nodes.map((l) => l.name).join(', ')
  const lines = [
    `Fix this GitHub issue: ${detail.repository.nameWithOwner}#${detail.number}`,
    '',
    `Title: ${detail.title}`,
    labels ? `Labels: ${labels}` : '',
    `URL: ${detail.url}`,
    '',
    'Description:',
    detail.body?.trim() || '(no description provided)',
  ].filter((l) => l !== '')
  return lines.join('\n')
}
