import { FaGithub } from 'react-icons/fa'
import { SiSentry } from 'react-icons/si'
import { RepoPicker } from '../RepoPicker'
import type { SentryProject } from '../../../api/sentry'

export function ProjectMappingList({
  projects, projectRepoMap, countByProject, repoOptions, savedSlug, onSetMapping,
}: {
  projects: SentryProject[]
  projectRepoMap: Record<string, string>
  countByProject: Map<string, number>
  repoOptions: string[]
  savedSlug: string | null
  onSetMapping: (slug: string, repo: string) => void
}) {
  return (
    <ul className="connector-map-list">
      {projects.map((p) => {
        const mapped = projectRepoMap[p.slug] ?? ''
        const count = countByProject.get(p.slug) ?? 0
        return (
          <li key={p.id} className="connector-map-row">
            <span className="connector-map-project" title={p.slug}>
              <SiSentry className="connector-map-icon sentry" aria-hidden />
              <span className="connector-map-project-name">{p.slug}</span>
            </span>
            <span className="connector-map-count" title="unresolved Sentry issues">{count > 0 ? `⚠ ${count}` : ''}</span>
            <span className="connector-map-arrow">→</span>
            <FaGithub className="connector-map-icon gh" aria-hidden />
            <RepoPicker
              value={mapped}
              options={repoOptions}
              onChange={(v) => onSetMapping(p.slug, v)}
              placeholder="owner/repo (unmapped)"
            />
            <a
              className="connector-map-repo"
              href={mapped ? `https://github.com/${mapped}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={mapped ? 'Open on GitHub' : undefined}
              style={{ visibility: mapped ? 'visible' : 'hidden' }}
            >↗</a>
            <span className="connector-map-saved" style={{ visibility: savedSlug === p.slug ? 'visible' : 'hidden' }}>✓ Saved</span>
          </li>
        )
      })}
    </ul>
  )
}
