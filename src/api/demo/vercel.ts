import type { VercelProject, VercelDeployment } from '../vercel'
import { deploy } from './helpers'

// ---------------------------------------------------------------------------
// Vercel connector — demo projects + deployments
// ---------------------------------------------------------------------------

export const DEMO_VERCEL_PROJECTS: VercelProject[] = [
  { id: 'prj_webapp', name: 'web-app', link: { type: 'github', org: 'iteris', repo: 'web-app', productionBranch: 'main' } },
  { id: 'prj_devcompass', name: 'devcompass', link: { type: 'github', org: 'dPeluChe', repo: 'devcompass', productionBranch: 'main' } },
  { id: 'prj_platform', name: 'platform-api', link: { type: 'github', org: 'iteris', repo: 'platform-api', productionBranch: 'main' } },
]

const DEMO_VERCEL_DEPLOYMENTS: Record<string, VercelDeployment[]> = {
  'iteris/web-app': [
    deploy('dpl_w1', 'iteris/web-app', 'ERROR', 'production', 0, 1, 'a1b2c3d', 'main', 'feat(dashboard): real-time metrics panel with WebSocket feed', 'sofiad'),
    deploy('dpl_w2', 'iteris/web-app', 'READY', 'production', 0, 6, 'f4e5d6c', 'main', 'fix(web): debounce the search box to cut re-renders', 'carlosm'),
    deploy('dpl_w3', 'iteris/web-app', 'READY', null, 1, 2, '9a8b7c6', 'feat/csv-export', 'feat(dashboard): export metrics panel as CSV', 'sofiad'),
  ],
  'dPeluChe/devcompass': [
    deploy('dpl_d1', 'dPeluChe/devcompass', 'READY', 'production', 0, 3, '7f70969', 'main', 'feat(digest): v2 — commit sparklines, merged-PR count', 'dPeluChe'),
    deploy('dpl_d2', 'dPeluChe/devcompass', 'BUILDING', null, 0, 0, 'baaca1c', 'feat/vercel', 'feat(needs): review pool', 'dPeluChe'),
  ],
  'iteris/platform-api': [
    deploy('dpl_p2', 'iteris/platform-api', 'ERROR', 'production', 0, 4, 'b7c8d9e', 'main', 'fix(rate-limiter): sliding window resets on distributed nodes', 'carlosm'),
    deploy('dpl_p1', 'iteris/platform-api', 'READY', 'production', 1, 4, 'c3d4e5f', 'main', 'feat(auth): migrate from JWT HS256 to RS256', 'dPeluChe'),
  ],
  'iteris/iteris-landing': [
    deploy('dpl_l1', 'iteris/iteris-landing', 'ERROR', 'production', 1, 8, 'e1f2a3b', 'main', 'feat(landing): hero redesign + pricing section', 'sofiad'),
  ],
}

/** Demo deployments for a repo "owner/name" (or a project id we can map back). */
export function demoVercelDeployments(repoOrId: string): VercelDeployment[] {
  if (DEMO_VERCEL_DEPLOYMENTS[repoOrId]) return DEMO_VERCEL_DEPLOYMENTS[repoOrId]
  const proj = DEMO_VERCEL_PROJECTS.find((p) => p.id === repoOrId)
  if (proj?.link?.org && proj.link.repo) return DEMO_VERCEL_DEPLOYMENTS[`${proj.link.org}/${proj.link.repo}`] ?? []
  return []
}

/** Demo failed production deployments (the Needs-me alert), newest first. */
export function demoFailedDeployments(): VercelDeployment[] {
  return Object.values(DEMO_VERCEL_DEPLOYMENTS)
    .flat()
    .filter((d) => d.state === 'ERROR' && d.target === 'production')
    .sort((a, b) => b.created - a.created)
}

export function demoVercelBuildLog(_id: string): string {
  return [
    '$ npm run build',
    '> web-app@2.0.0 build',
    '> vite build',
    '',
    'vite v6.0.1 building for production...',
    'transforming...',
    'src/routes/dashboard.tsx:142:18 - error TS2339:',
    "  Property 'metrics' does not exist on type 'WebSocketFeed'.",
    '',
    'ERROR: "tsc -b" exited with 2.',
    'Error: Command "npm run build" exited with 1',
  ].join('\n')
}
