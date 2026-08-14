import type { Viewer, Org, Repo } from '../github'
import { ghAvatar, pr, makeRepo, TS, GO, RS, PY, PG } from './helpers'

// ---------------------------------------------------------------------------
// Orgs
// ---------------------------------------------------------------------------

export const ORGS: Org[] = [
  { login: 'iteris',   avatarUrl: ghAvatar('iteris'),   url: 'https://github.com/iteris'   },
  { login: 'vercel',      avatarUrl: ghAvatar('vercel'),      url: 'https://github.com/vercel'      },
  { login: 'stripe',      avatarUrl: ghAvatar('stripe'),      url: 'https://github.com/stripe'      },
  { login: 'supabase',    avatarUrl: ghAvatar('supabase'),    url: 'https://github.com/supabase'    },
  { login: 'linear',      avatarUrl: ghAvatar('linear'),      url: 'https://github.com/linear'      },
  { login: 'planetscale', avatarUrl: ghAvatar('planetscale'), url: 'https://github.com/planetscale' },
]

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

export const DEMO_VIEWER: Viewer = {
  login: 'dPeluChe',
  name: 'dPeluChe',
  avatarUrl: ghAvatar('dPeluChe'),
  url: 'https://github.com/dPeluChe',
  organizations: { nodes: ORGS },
}

// ---------------------------------------------------------------------------
// Repos
// ---------------------------------------------------------------------------

export const DEMO_REPOS: Repo[] = [
  makeRepo('R000', 'dPeluChe', 'devcompass', 'GitHub command center — local-first, no backend', TS, 0, false, 0, [
    pr('P000a', 18, 'feat(demo): add interactive demo mode with static dataset', 'dPeluChe', 'devcompass', 'dPeluChe', 0, false, 'SUCCESS'),
    pr('P000b', 17, 'feat(landing): SEO pass + llms.txt + JSON-LD schema', 'dPeluChe', 'devcompass', 'dPeluChe', 1, false, 'SUCCESS'),
  ], 4),

  makeRepo('R00A', 'iteris', 'platform-api', 'Core REST API for the Iteris platform', TS, 0, true, 0, [
    pr('P00A1', 87, 'feat(auth): migrate from JWT HS256 to RS256 with key rotation', 'iteris', 'platform-api', 'dPeluChe', 0, false, 'SUCCESS'),
    pr('P00A2', 85, 'fix(rate-limiter): sliding window resets on distributed nodes', 'iteris', 'platform-api', 'carlosm', 2, false, 'FAILURE'),
  ], 11),

  makeRepo('R00B', 'iteris', 'web-app', 'Customer-facing React dashboard', TS, 0, true, 1, [
    pr('P00B1', 214, 'feat(dashboard): real-time metrics panel with WebSocket feed', 'iteris', 'web-app', 'sofiad', 1),
    pr('P00B2', 211, 'chore: upgrade to React 19 + drop legacy context API', 'iteris', 'web-app', 'dPeluChe', 3, true),
  ], 18),

  makeRepo('R00C', 'iteris', 'infra', 'Terraform modules and GitHub Actions workflows', GO, 0, true, 2, [], 6),

  makeRepo('R001', 'vercel', 'next.js', 'The React Framework for the Web', TS, 128_400, false, 0, [
    pr('P001', 4721, 'feat(app-router): support React 19 concurrent features', 'vercel', 'next.js', 'sebmarkbage', 0),
    pr('P002', 4718, 'fix(server-components): hydration mismatch on dynamic imports', 'vercel', 'next.js', 'timneutkens', 1),
    pr('P003', 4715, 'chore: upgrade to webpack 6 alpha', 'vercel', 'next.js', 'devjoe', 2, true),
  ], 1842),

  makeRepo('R002', 'vercel', 'swr', 'React Hooks for Data Fetching', TS, 29_800, false, 1, [
    pr('P010', 2231, 'feat: add optimistic mutation with rollback support', 'vercel', 'swr', 'yixuanchen', 1),
    pr('P011', 2228, 'fix: infinite loop when key returns undefined', 'vercel', 'swr', 'priyak', 3),
  ], 412),

  makeRepo('R003', 'vercel', 'turborepo', 'High-performance monorepo build system for JS/TS', RS, 24_100, false, 2, [
    pr('P020', 1843, 'feat: remote cache authentication via OIDC tokens', 'vercel', 'turborepo', 'nicolo-r', 2),
  ], 289),

  makeRepo('R004', 'vercel', 'ai', 'Build AI-powered streaming UIs with React, Svelte, and Vue', TS, 12_600, false, 0, [
    pr('P030', 432, 'fix: streaming timeout on slow network connections', 'vercel', 'ai', 'dPeluChe', 0, false, 'FAILURE'),
    pr('P031', 428, 'feat: add Google Gemini provider', 'vercel', 'ai', 'mmarchand', 1),
  ], 178),

  makeRepo('R005', 'stripe', 'stripe-js', 'Stripe.js loading utility', TS, 1_840, false, 3, [
    pr('P040', 312, 'fix: race condition in Elements mount on slow connections', 'stripe', 'stripe-js', 'lchavez', 3),
  ], 67),

  makeRepo('R006', 'stripe', 'stripe-node', 'Node.js library for the Stripe API', TS, 8_420, false, 1, [
    pr('P050', 1892, 'feat: add PaymentIntent.incrementalAuthorization support', 'stripe', 'stripe-node', 'dPeluChe', 0),
    pr('P051', 1889, 'fix: retry logic ignores 429 Retry-After header', 'stripe', 'stripe-node', 'dkwan', 2),
  ], 203),

  makeRepo('R007', 'stripe', 'react-stripe-js', 'React components for Stripe.js and Stripe Elements', TS, 2_130, false, 4, [], 54),

  makeRepo('R008', 'supabase', 'supabase', 'The open source Firebase alternative', TS, 62_300, false, 0, [
    pr('P060', 8342, 'fix(realtime): reconnection backoff exceeds 30 s limit', 'supabase', 'supabase', 'sujay-r', 1),
    pr('P061', 8339, 'feat(storage): resumable upload progress events', 'supabase', 'supabase', 'w-mitsuda', 2),
    pr('P062', 8331, 'docs: update self-hosting guide for Docker Compose v2', 'supabase', 'supabase', 'abubakar-m', 5),
  ], 3847),

  makeRepo('R009', 'supabase', 'auth', 'A JWT based API for managing users and issuing JWT tokens', GO, 3_410, false, 2, [
    pr('P070', 891, 'fix: JWT expiry calculation off by one for leap years', 'supabase', 'auth', 'fnando', 1),
  ], 211),

  makeRepo('R010', 'supabase', 'postgres', 'Unmodified Postgres with useful extensions pre-installed', PG, 0, true, 5, [], 18),

  makeRepo('R011', 'linear', 'linear', 'The Linear App', TS, 0, true, 0, [
    pr('P080', 2103, 'refactor(editor): extract BlockEditor to standalone package', 'linear', 'linear', 'emilwidlund', 1),
    pr('P081', 2099, 'feat(triage): keyboard-driven bulk assignment shortcuts', 'linear', 'linear', 'tuomas-v', 2, true),
  ], 94),

  makeRepo('R012', 'linear', 'linear-sdk', 'Linear API SDK for Node.js and the browser', TS, 1_240, false, 6, [], 38),

  makeRepo('R013', 'planetscale', 'cli', 'Your PlanetScale CLI', GO, 2_920, false, 3, [
    pr('P090', 334, 'feat: add backup export format options (csv, parquet)', 'planetscale', 'cli', 'dPeluChe', 45, false, 'SUCCESS'),
  ], 124),

  makeRepo('R014', 'planetscale', 'database-js', 'The PlanetScale serverless driver for JavaScript', TS, 1_530, false, 4, [], 47),

  makeRepo('R015', 'dPeluChe', 'devtools', 'Personal dev tooling and automation scripts', TS, 0, true, 1, [
    pr('P100', 14, 'feat: add git-smart alias for contextual branch names', 'dPeluChe', 'devtools', 'dPeluChe', 1),
  ], 3),

  makeRepo('R016', 'dPeluChe', 'obsidian-plugins', 'A collection of Obsidian plugins for developers', TS, 843, false, 7, [], 22),

  makeRepo('R017', 'vercel', 'serve', 'Static file serving and SPA support', GO, 9_800, false, 12, [], 88, false),

  makeRepo('R018', 'stripe', 'stripe-go', 'Go library for the Stripe API', GO, 2_080, false, 8, [
    pr('P110', 892, 'chore: regenerate from OpenAPI spec 2026-04', 'stripe', 'stripe-go', 'jcollins-s', 5),
  ], 71),

  makeRepo('R019', 'supabase', 'realtime', 'Postgres change-data-capture over WebSockets', PY, 6_240, false, 1, [], 156),

  makeRepo('R020', 'planetscale', 'vitess', 'MySQL-compatible distributed database (fork)', GO, 18_300, false, 0, [], 432, true),
]
