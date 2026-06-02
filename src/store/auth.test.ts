import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auth, sanitizeToken } from './auth'

function createStorage() {
  const map = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { map.set(key, value) }),
    removeItem: vi.fn((key: string) => { map.delete(key) }),
    clear: vi.fn(() => { map.clear() })
  }
}

describe('auth', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
  })

  it('sanitizes copied tokens before storage', () => {
    auth.set('  ghp_valid\u200btoken→  ')

    expect(localStorage.setItem).toHaveBeenCalledWith('ghviewer.pat', 'ghp_validtoken')
    expect(auth.get()).toBe('ghp_validtoken')
  })

  it('returns null for empty sanitized tokens', () => {
    localStorage.setItem('ghviewer.pat', '\u200b')

    expect(auth.get()).toBeNull()
  })

  it('exposes token sanitization as a pure helper', () => {
    expect(sanitizeToken('\u00a0 abc\n')).toBe('abc')
  })
})
