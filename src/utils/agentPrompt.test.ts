import { describe, expect, it } from 'vitest'
import { buildGithubIssueAgentText, buildSentryAgentText } from './agentPrompt'
import type { GitHubIssueDetail } from '../api/github'
import type { SentryIssue } from '../api/sentry'

const ISSUE: SentryIssue = {
  id: '1', shortId: 'API-3K', title: "TypeError: Cannot read 'orgId'",
  culprit: 'auth.ts', level: 'error', status: 'unresolved',
  count: '128', userCount: 37, firstSeen: '2026-05-01T0:0:0Z', lastSeen: '2026-06-01T0:0:0Z',
  permalink: 'https://acme.sentry.io/issues/1/', project: { id: 'p', slug: 'api', name: 'api' },
}

describe('buildSentryAgentText', () => {
  it('puts high-signal fields up top + a fenced crash-first stacktrace', () => {
    const text = buildSentryAgentText(ISSUE, [{
      type: 'TypeError',
      value: "Cannot read 'orgId'",
      mechanism: { handled: false },
      stacktrace: { frames: [
        { filename: 'outer.ts', function: 'outer', lineNo: 1 },
        { filename: 'crash.ts', function: 'resolveSession', lineNo: 42, inApp: true },
      ] },
    }], 'acme/api', {
      environment: 'production', release: 'app@2.0.0', handled: false,
      client: 'Safari 17.4 · iOS 17.4', eventId: 'abc', url: '/x',
      breadcrumbs: [{ ts: '21:14:58', label: 'http', message: 'POST /api → failed' }],
    })
    expect(text).toContain('Fix this Sentry error in acme/api:')
    expect(text).toContain('ISSUE: TypeError: Cannot read \'orgId\'')
    expect(text).toContain('Environment:  production')
    expect(text).toContain('Handled:      no (unhandled)')
    expect(text).toContain('Release:      app@2.0.0')
    expect(text).toContain('Events:       128 · Users: 37')
    expect(text).toContain('```')                                  // fenced stacktrace
    expect(text).toContain('crash.ts in resolveSession:42   ← in-app')
    expect(text.indexOf('crash.ts')).toBeLessThan(text.indexOf('outer.ts'))  // crash first
    expect(text).toContain('This event: ')                         // event-specific link
    expect(text).toContain('acme.sentry.io/issues/1/events/abc/')
    expect(text).toContain('Breadcrumbs (last 1):')
  })

  it('collapses duplicate frames and truncates a long stack', () => {
    const dup = { filename: 'a.js', function: 'f', lineNo: 1 }
    const frames = [dup, dup, dup, ...Array.from({ length: 20 }, (_, i) => ({ filename: `f${i}.js`, lineNo: i }))]
    const text = buildSentryAgentText(ISSUE, [{ type: 'E', stacktrace: { frames } }], null)
    expect(text).toContain('… +')                                   // truncation marker
    // dup frames are at the bottom (reversed → end), collapsed when reached; the
    // long head guarantees truncation fires.
    expect(text.split('\n').length).toBeLessThan(frames.length + 20)
  })

  it('degrades gracefully with no event context (env/handled show unknown)', () => {
    const text = buildSentryAgentText(ISSUE, [], null)
    expect(text).toContain('Fix this Sentry error:')
    expect(text).toContain('Environment:  unknown')
    expect(text).toContain('Handled:      unknown')
    expect(text).not.toContain('```')
  })

  it('adds trend, processing-error block, issue-level unhandled, and raw JSON', () => {
    const now = Date.now() / 1000
    const issue = {
      ...ISSUE,
      isUnhandled: true,
      priority: 'high',
      stats: { '14d': [[now - 36 * 3600, 5], [now - 2 * 3600, 7]] as [number, number][] },
    }
    const text = buildSentryAgentText(issue, [], null, {
      processingErrors: ['Source map missing for x.js'],
      handled: true,  // overridden by issue.isUnhandled
    }, { sample: 'payload' })
    expect(text).toContain('Priority:     high')
    expect(text).toContain('Trend:        7 in 24h · 12 in 14d')
    expect(text).toContain('Handled:      no (unhandled)')                 // issue-level wins
    expect(text).toContain('⚠ Sentry could not fully process this event')
    expect(text).toContain('- Source map missing for x.js')
    expect(text).toContain('<details><summary>Raw event JSON</summary>')
    expect(text).toContain('"sample": "payload"')
  })
})

describe('buildGithubIssueAgentText', () => {
  const DETAIL: GitHubIssueDetail = {
    number: 92, title: 'Login loops', url: 'https://github.com/acme/api/issues/92',
    state: 'OPEN', bodyHTML: '<p>hi</p>', body: 'Steps to reproduce…',
    createdAt: '2026-05-01T0:0:0Z', updatedAt: '2026-06-01T0:0:0Z',
    author: { login: 'ana', avatarUrl: '' },
    repository: { nameWithOwner: 'acme/api' },
    labels: { nodes: [{ name: 'bug', color: 'd73a4a' }] },
    assignees: { nodes: [] },
    comments: { totalCount: 3 },
  }

  it('includes repo#number, labels, url and the raw body', () => {
    const text = buildGithubIssueAgentText(DETAIL)
    expect(text).toContain('Fix this GitHub issue: acme/api#92')
    expect(text).toContain('Labels: bug')
    expect(text).toContain('Steps to reproduce…')
  })

  it('falls back when the body is empty', () => {
    const text = buildGithubIssueAgentText({ ...DETAIL, body: '', labels: { nodes: [] } })
    expect(text).toContain('(no description provided)')
    expect(text).not.toContain('Labels:')
  })
})
