import { describe, expect, it } from 'vitest'
import { deploymentState, repoFromProject, matchReleaseToDeploy, prNumberFromDeploy } from './deployments'
import type { VercelDeployment, VercelProject } from './types'

const dep = (sha: string, message = ''): VercelDeployment =>
  ({ uid: 'd', name: 'p', url: 'u', created: 0, meta: { githubCommitSha: sha, githubCommitMessage: message } } as VercelDeployment)

describe('matchReleaseToDeploy', () => {
  const deploys = [dep('a1b2c3d4e5f6'), dep('9988776655')]
  it('matches a full-sha or short-sha release to its deploy', () => {
    expect(matchReleaseToDeploy('a1b2c3d4e5f6', deploys)?.meta?.githubCommitSha).toBe('a1b2c3d4e5f6')
    expect(matchReleaseToDeploy('a1b2c3d', deploys)?.meta?.githubCommitSha).toBe('a1b2c3d4e5f6')
    expect(matchReleaseToDeploy('app@9988776655', deploys)?.meta?.githubCommitSha).toBe('9988776655')
  })
  it('returns null for no release or a non-sha release', () => {
    expect(matchReleaseToDeploy(null, deploys)).toBeNull()
    expect(matchReleaseToDeploy('v2.0.0', deploys)).toBeNull()
    expect(matchReleaseToDeploy('deadbeef', deploys)).toBeNull()
  })
})

describe('prNumberFromDeploy', () => {
  it('extracts the PR number from a merge-commit message', () => {
    expect(prNumberFromDeploy(dep('x', 'Merge pull request #87 from foo/bar'))).toBe(87)
    expect(prNumberFromDeploy(dep('x', 'fix: a normal commit'))).toBeNull()
  })
})

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
