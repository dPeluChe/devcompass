import type { GitHubIssueDetail } from '../api/github'
import type { SentryExceptionValue, SentryIssue } from '../api/sentry'

/**
 * Builds an actionable, paste-ready brief for a dev agent from an issue. Plain
 * text/markdown so it drops cleanly into any chat or task tool.
 */
export function buildSentryAgentText(issue: SentryIssue, exceptions: SentryExceptionValue[], repo: string | null): string {
  const lines: string[] = [
    `Fix this Sentry error${repo ? ` in ${repo}` : ''}:`,
    '',
    issue.title,
    `- Project: ${issue.project.slug} · ${issue.shortId}`,
    `- Level: ${issue.level} · ${issue.count} events · ${issue.userCount} users affected`,
    `- Sentry: ${issue.permalink}`,
  ]
  for (const ex of exceptions) {
    lines.push('', `Exception: ${ex.type ?? 'Exception'}${ex.value ? `: ${ex.value}` : ''}`)
    const frames = ex.stacktrace?.frames
    if (frames && frames.length > 0) {
      lines.push('Stacktrace (crash first):')
      ;[...frames].reverse().slice(0, 15).forEach((f, i) => {
        const loc = `${f.filename || f.module || '?'}${f.function ? ` in ${f.function}` : ''}${f.lineNo != null ? `:${f.lineNo}` : ''}`
        lines.push(`${i + 1}. ${loc}`)
      })
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
