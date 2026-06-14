import { describe, expect, it } from 'vitest'
import { buildOwnerScope, SCOPE_CAP } from './useNeedsMe'

const owner = (login: string) => ({ owner: { login, avatarUrl: '' } })

describe('buildOwnerScope', () => {
  it('uses user: for the viewer and org: for everyone else, deduped', () => {
    const { scope, truncated } = buildOwnerScope(
      [owner('me'), owner('acme'), owner('acme'), owner('globex')],
      'me'
    )
    expect(scope).toBe('user:me org:acme org:globex')
    expect(truncated).toBe(false)
  })

  it('caps the number of scope qualifiers and flags truncation', () => {
    const repos = Array.from({ length: SCOPE_CAP + 5 }, (_, i) => owner(`org${i}`))
    const { scope, truncated } = buildOwnerScope(repos, 'me')
    expect(scope.split(' ')).toHaveLength(SCOPE_CAP)
    expect(truncated).toBe(true)
  })
})
