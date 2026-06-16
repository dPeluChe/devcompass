import { describe, expect, it } from 'vitest'
import { validateSentryTokenFormat } from './sentryConfig'
import { validateVercelTokenFormat } from './vercelConfig'

describe('validateVercelTokenFormat', () => {
  it('accepts a plausible token and stays silent while empty', () => {
    expect(validateVercelTokenFormat('a'.repeat(24))).toEqual({ ok: true, warning: null })
    expect(validateVercelTokenFormat('')).toEqual({ ok: false, warning: null })
  })

  it('warns when the token is implausibly short', () => {
    const r = validateVercelTokenFormat('abc123')
    expect(r.ok).toBe(false)
    expect(r.warning).toMatch(/too short/)
  })
})

// Guard that the Sentry validator still behaves (shared sanitizeToken boundary).
describe('sentry token validator still works', () => {
  it('accepts sntryu_ of the right length', () => {
    expect(validateSentryTokenFormat('sntryu_' + 'a'.repeat(64)).ok).toBe(true)
  })
})
