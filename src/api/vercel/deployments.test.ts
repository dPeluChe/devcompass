import { describe, expect, it } from 'vitest'
import { deploymentState, repoFromProject } from './deployments'
import type { VercelDeployment, VercelProject } from './types'

describe('repoFromProject', () => {
  it('builds owner/repo from a GitHub link', () => {
    const p: VercelProject = { id: 'p', name: 'web', link: { type: 'github', org: 'iteris', repo: 'web-app' } }
    expect(repoFromProject(p)).toBe('iteris/web-app')
  })

  it('returns null for non-github or unlinked projects', () => {
    expect(repoFromProject({ id: 'p', name: 'x', link: { type: 'gitlab', org: 'o', repo: 'r' } })).toBeNull()
    expect(repoFromProject({ id: 'p', name: 'x', link: null })).toBeNull()
    expect(repoFromProject({ id: 'p', name: 'x' })).toBeNull()
  })
})

describe('deploymentState', () => {
  it('prefers state, falls back to readyState, then QUEUED', () => {
    expect(deploymentState({ state: 'ERROR' } as VercelDeployment)).toBe('ERROR')
    expect(deploymentState({ readyState: 'READY' } as VercelDeployment)).toBe('READY')
    expect(deploymentState({} as VercelDeployment)).toBe('QUEUED')
  })
})
