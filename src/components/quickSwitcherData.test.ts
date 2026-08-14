import { describe, expect, it } from 'vitest'
import type { Repo } from '../api/github'
import {
  SCOPES,
  VIEWS,
  buildItems,
  escapeRegExp,
  matchScore
} from './quickSwitcherData'

function repo(overrides: Partial<Repo> & Pick<Repo, 'id' | 'name'>): Repo {
  return {
    nameWithOwner: `owner/${overrides.name}`,
    url: `https://github.com/owner/${overrides.name}`,
    description: null,
    isPrivate: false,
    isArchived: false,
    isFork: false,
    stargazerCount: 0,
    pushedAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    primaryLanguage: null,
    owner: { login: 'owner', avatarUrl: '' },
    defaultBranchRef: null,
    openPRs: { totalCount: 0, nodes: [] },
    openIssues: { totalCount: 0 },
    ...overrides
  } as Repo
}

describe('matchScore', () => {
  it('returns 1000 for exact match', () => {
    expect(matchScore('next', 'next')).toBe(1000)
  })

  it('returns 800 for prefix match', () => {
    expect(matchScore('nextjs', 'next')).toBe(800)
  })

  it('returns 500 for word-boundary match', () => {
    expect(matchScore('my next app', 'next')).toBe(500)
  })

  it('scales substring score by position', () => {
    expect(matchScore('abnext', 'next')).toBeGreaterThan(0)
    expect(matchScore('abnext', 'next')).toBeLessThan(500)
    // earlier index scores higher
    expect(matchScore('anext', 'next')).toBeGreaterThan(matchScore('xxnext', 'next'))
  })

  it('returns 0 for no match', () => {
    expect(matchScore('hello', 'xyz')).toBe(0)
  })

  it('returns 0 for empty needle', () => {
    expect(matchScore('anything', '')).toBe(0)
  })
})

describe('buildItems', () => {
  it('returns views + scopes + repos for empty query', () => {
    const items = buildItems('', [repo({ id: 'r1', name: 'r1' })])
    const kinds = new Set(items.map((i) => i.action.kind))
    expect(kinds.has('view')).toBe(true)
    expect(kinds.has('scope')).toBe(true)
    expect(kinds.has('repo')).toBe(true)
    expect(items.length).toBe(VIEWS.length + SCOPES.length + 1)
  })

  it("filters to matching repos for query 'next'", () => {
    const repos = [
      repo({ id: 'next', name: 'next' }),
      repo({ id: 'other', name: 'other' })
    ]
    const items = buildItems('next', repos)
    const ids = items.map((i) => i.id)
    expect(ids).toContain('repo:next')
    expect(ids).not.toContain('repo:other')
  })

  it('sorts results by score descending', () => {
    const repos = [
      repo({ id: 'next', name: 'next' }),
      repo({ id: 'nextjs', name: 'nextjs' })
    ]
    const items = buildItems('next', repos)
    for (let i = 1; i < items.length; i++) {
      expect(items[i].score).toBeLessThanOrEqual(items[i - 1].score)
    }
  })

  it('limits results to 60 items', () => {
    const repos = Array.from({ length: 100 }, (_, i) =>
      repo({ id: `r${i}`, name: `r${i}` })
    )
    const items = buildItems('', repos)
    expect(items.length).toBeLessThanOrEqual(60)
  })
})

describe('escapeRegExp', () => {
  it('escapes dots', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b')
  })

  it('escapes brackets', () => {
    expect(escapeRegExp('a[b]c')).toBe('a\\[b\\]c')
  })

  it('escapes backslashes', () => {
    expect(escapeRegExp('a\\b')).toBe('a\\\\b')
  })
})
