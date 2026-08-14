import { describe, expect, it } from 'vitest'
import type { Org, Repo, Viewer } from '../api/github'
import { mergeOrgs, sortRepos } from './loadRepos'

function repo(id: string, pushedAt: string): Repo {
  return {
    id,
    name: id,
    nameWithOwner: `owner/${id}`,
    url: `https://github.com/owner/${id}`,
    description: null,
    isPrivate: false,
    isArchived: false,
    isFork: false,
    stargazerCount: 0,
    pushedAt,
    updatedAt: pushedAt,
    primaryLanguage: null,
    owner: { login: 'owner', avatarUrl: '' },
    defaultBranchRef: null,
    openPRs: { totalCount: 0 },
    openIssues: { totalCount: 0 }
  }
}

function viewer(login: string, orgs: Org[] = []): Viewer {
  return {
    login,
    name: null,
    avatarUrl: `https://avatars/${login}`,
    url: `https://github.com/${login}`,
    organizations: { nodes: orgs }
  }
}

describe('sortRepos', () => {
  it('sorts by pushedAt descending', () => {
    const repos = [
      repo('a', '2024-01-01T00:00:00Z'),
      repo('b', '2024-03-01T00:00:00Z'),
      repo('c', '2024-02-01T00:00:00Z')
    ]
    expect(sortRepos(repos).map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('returns empty array unchanged', () => {
    expect(sortRepos([])).toEqual([])
  })

  it('does not mutate the input', () => {
    const repos = [repo('a', '2024-01-01T00:00:00Z'), repo('b', '2024-03-01T00:00:00Z')]
    const snapshot = repos.map((r) => r.id)
    sortRepos(repos)
    expect(repos.map((r) => r.id)).toEqual(snapshot)
  })
})

describe('mergeOrgs', () => {
  it('places the viewer first, then orgs', () => {
    const v = viewer('me', [
      { login: 'orgA', avatarUrl: 'https://a', url: 'https://github.com/orgA' }
    ])
    const result = mergeOrgs(v, [])
    expect(result.map((o) => o.login)).toEqual(['me', 'orgA'])
  })

  it('merges viewer orgs with REST orgs without duplicates', () => {
    const v = viewer('me', [
      { login: 'orgA', avatarUrl: 'https://a', url: 'https://github.com/orgA' }
    ])
    const restOrgs = [
      { login: 'orgA', avatar_url: 'https://a-rest', url: 'https://github.com/orgA' },
      { login: 'orgB', avatar_url: 'https://b-rest', url: 'https://github.com/orgB' }
    ]
    const result = mergeOrgs(v, restOrgs)
    expect(result.map((o) => o.login)).toEqual(['me', 'orgA', 'orgB'])
  })

  it('keeps the viewer org entry when a duplicate login appears in REST', () => {
    const v = viewer('me', [
      { login: 'orgA', avatarUrl: 'https://a-gql', url: 'https://github.com/orgA' }
    ])
    const restOrgs = [{ login: 'orgA', avatar_url: 'https://a-rest', url: 'https://github.com/orgA' }]
    const result = mergeOrgs(v, restOrgs)
    const orgA = result.find((o) => o.login === 'orgA')
    expect(orgA?.avatarUrl).toBe('https://a-gql')
  })

  it('handles null restOrgs', () => {
    const v = viewer('me', [
      { login: 'orgA', avatarUrl: 'https://a', url: 'https://github.com/orgA' }
    ])
    const result = mergeOrgs(v, null as never)
    expect(result.map((o) => o.login)).toEqual(['me', 'orgA'])
  })
})
