import type { GitHubIssueDetail } from '../api/github'
import type { SentryEventContext, SentryExceptionValue, SentryFrame, SentryIssue } from '../api/sentry'

const FRAME_LIMIT = 15

/** "2026-06-13T21:14:58.000Z" → "2026-06-13 21:14 UTC". */
function fmtTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
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
export function buildSentryAgentText(
  issue: SentryIssue,
  exceptions: SentryExceptionValue[],
  repo: string | null,
  ctx: Partial<SentryEventContext> = {},
): string {
  const primary = exceptions[0]
  const headType = primary?.type ?? issue.metadata?.type ?? null
  const headVal = primary?.value ?? issue.metadata?.value ?? issue.title
  const field = (label: string, value: string) => `${(label + ':').padEnd(14)}${value}`

  const lines: string[] = [
    `Fix this Sentry error${repo ? ` in ${repo}` : ''}:`,
    '',
    `ISSUE: ${headType ? `${headType}: ${headVal}` : headVal}`,
  ]
  if (issue.culprit) lines.push(field('Culprit', issue.culprit))
  if (ctx.transaction) lines.push(field('Transaction', ctx.transaction))
  lines.push(field('Environment', ctx.environment ?? 'unknown'))
  lines.push(field('Handled', ctx.handled === false ? 'no (unhandled)' : ctx.handled === true ? 'yes (handled)' : 'unknown'))
  lines.push(field('Level', issue.level))
  if (ctx.release) lines.push(field('Release', ctx.release))
  lines.push(field('Events', `${issue.count} · Users: ${issue.userCount}`))
  const first = fmtTime(issue.firstSeen); const last = fmtTime(issue.lastSeen)
  if (first) lines.push(field('First seen', first))
  if (last) lines.push(field('Last seen', last))
  if (ctx.url) lines.push(field('URL', ctx.url))
  if (ctx.client) lines.push(field('Client', ctx.client))
  lines.push(field('Sentry issue', issue.permalink))
  if (ctx.eventId) {
    const base = issue.permalink.endsWith('/') ? issue.permalink : `${issue.permalink}/`
    lines.push(field('This event', `${base}events/${ctx.eventId}/`))
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
