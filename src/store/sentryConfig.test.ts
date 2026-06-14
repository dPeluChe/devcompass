import { describe, expect, it } from 'vitest'
import { validateSentryTokenFormat } from './sentryConfig'

describe('validateSentryTokenFormat', () => {
  it('accepts a well-formed user auth token (65–75 chars, sntryu_)', () => {
    const ok = 'sntryu_' + 'a'.repeat(64) // 71 chars
    expect(validateSentryTokenFormat(ok)).toEqual({ ok: true, warning: null })
  })

  it('stays silent (no warning) while the field is empty', () => {
    expect(validateSentryTokenFormat('')).toEqual({ ok: false, warning: null })
    expect(validateSentryTokenFormat('   ')).toEqual({ ok: false, warning: null })
  })

  it('flags an organization token (sntrys_)', () => {
    const r = validateSentryTokenFormat('sntrys_' + 'a'.repeat(64))
    expect(r.ok).toBe(false)
    expect(r.warning).toMatch(/Organization token/)
  })

  it('flags a missing prefix and an out-of-range length', () => {
    expect(validateSentryTokenFormat('ghp_whatever').warning).toMatch(/sntryu_/)
    expect(validateSentryTokenFormat('sntryu_short').warning).toMatch(/length/)
    expect(validateSentryTokenFormat('sntryu_' + 'a'.repeat(80)).warning).toMatch(/length/)
  })
})
