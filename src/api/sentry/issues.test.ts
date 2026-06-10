import { describe, expect, it } from 'vitest'
import { normEnvironment } from './issues'

describe('normEnvironment', () => {
  it('treats empty and the "all" sentinel as no filter', () => {
    expect(normEnvironment(undefined)).toBeUndefined()
    expect(normEnvironment('')).toBeUndefined()
    expect(normEnvironment('  ')).toBeUndefined()
    expect(normEnvironment('all')).toBeUndefined()
    expect(normEnvironment('ALL')).toBeUndefined()
  })

  it('passes real environments through trimmed', () => {
    expect(normEnvironment('production')).toBe('production')
    expect(normEnvironment(' staging ')).toBe('staging')
  })
})
