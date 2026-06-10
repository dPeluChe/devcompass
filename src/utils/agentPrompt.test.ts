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
  it('includes repo, meta and a crash-first stacktrace', () => {
    const text = buildSentryAgentText(ISSUE, [{
      type: 'TypeError',
      value: "Cannot read 'orgId'",
      stacktrace: { frames: [
        { filename: 'outer.ts', function: 'outer', lineNo: 1 },
        { filename: 'crash.ts', function: 'resolveSession', lineNo: 42 },
      ] },
    }], 'acme/api')
    expect(text).toContain('Fix this Sentry error in acme/api:')
    expect(text).toContain('128 events · 37 users affected')
    expect(text).toContain('Exception: TypeError')
    // frames are reversed so the crash site comes first
    expect(text.indexOf('crash.ts')).toBeLessThan(text.indexOf('outer.ts'))
    expect(text).toContain('crash.ts in resolveSession:42')
  })

  it('survives no repo mapping and no exceptions', () => {
    const text = buildSentryAgentText(ISSUE, [], null)
    expect(text).toContain('Fix this Sentry error:')
    expect(text).not.toContain('Exception:')
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
