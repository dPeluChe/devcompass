# devcompass — architecture notes

This is the internal architecture guide for contributors. For the user-facing intro, see the [root README](../README.md).

## High level

devcompass is a single-page app that runs entirely in the browser. There is no backend, no server-side rendering, no analytics. All state — the user's PAT, cached repos, pinned repos, snoozes, the contribution heatmap — lives in `localStorage` and IndexedDB.

The app is structured around the **HomeShell**: a persistent sidebar + main column that hosts every scope (Digest, Needs me, Since last visit, Watching, Pinned, Active 7d, All repos, per-org views, Token & rate). Repo detail and Config also render inside HomeShell so the sidebar is always present.

## Source tree

```text
src/
  api/
    github.ts             GitHub GraphQL + REST, retry, fragments. Single source of API truth.
  components/
    Dashboard.tsx         Top-level workbench shell. Owns view + scope state, drives HomeShell.
    SettingsTab.tsx       Config view: Orgs, Token, Storage, Cache, Pinned, Org order.
    RepoBrowser.tsx       Wrapper around repo-detail when navigating in-app.
    SanitizedMarkdown.tsx DOMPurify wrapper for PR / repo markdown.
    TokenSetup.tsx        Login screen.
    ConfirmDialog.tsx     In-app modal replacing native confirm/alert/prompt.
    OrgManager.tsx        Per-org toggle in Settings.

    home/
      HomeShell.tsx       Persistent layout (sidebar + main + detail modal). Reused by every view.
      Sidebar.tsx         Sidebar groups: Summary, Inbox, Workbench, Orgs (Member / Collaborator), Insights.
      DetailModal.tsx     PR detail overlay opened from any scope.
      ScopeView.tsx       Router that picks the right scope renderer based on scope key.
      home.css            Per-component styles for HomeShell, scopes, sidebar, heatmap.
      useNeedsMe.ts       Needs-me derivation + snooze refresh hook.
      useSinceLastVisit.ts Since-last-visit diff hook + baseline snapshot save.

      scopes/
        common.tsx        Shared ScopeProps + helper components (Header, CompactRow, shortAgo).
        DigestScope.tsx   Operational snapshot (stats, heatmap, most active, contributors, attn).
        ContributionHeatmap.tsx  GitHub-style 53-week heatmap, 12h IDB cache.
        NeedsScope.tsx, SinceScope.tsx, WatchingScope.tsx, PinnedScope.tsx, ActiveScope.tsx,
        ReposScope.tsx, OrgScope.tsx, RateScope.tsx

    repo-detail/
      Header.tsx          Repo title bar with metadata + actions.
      OverviewTab.tsx     Description + languages + recent activity.
      CommitsTab.tsx      Paginated history with associated PR branch chips.
      PRsTab.tsx          PR list with state filters (Open / Merged / Closed).
      IssuesReleases.tsx  Issues + Releases combined tab.
      Checks.tsx          PR checks log with copy button.
      common.tsx, utils.ts

  store/
    auth.ts               Token in localStorage["ghviewer.pat"]. ASCII-sanitized to avoid header bugs.
    queries.ts            TanStack Query client + queryKeys registry.
    orgConfig.ts          Zustand persist store. Per-org enabled / syncEnabled / lastSyncedAt.
    db.ts                 Dexie schema + helpers. TTL-bound prefs cache + auto-prune.

  hooks/
    useGlobalShortcuts.ts Keyboard shortcuts (cmd+k, ? for help, etc).

  main.tsx                Router + QueryClient + auth gate.
  App.tsx                 Auth-gated wrapper around <Dashboard>.
```

## Data flow

The load sequence Dashboard depends on:

1. Read cached repos from IndexedDB (`getAllCachedRepos`) → paint immediately.
2. In parallel: `fetchViewer` → REST `/user/orgs` (orgs GraphQL misses) → merge org lists → `fetchAllRepos`.
3. Persist the fresh result back to IndexedDB via `cacheRepos`.
4. `orgConfigStore.setAllOrgs` reconciles new orgs with existing per-org config.

`getAllCachedRepos` (not the per-org variant) is used because collaborator repos come through `affiliations: COLLABORATOR` but are owned by orgs the user is not a member of. The per-org filter would miss them on cold reload.

## State layers

| Layer | File | Lifetime | Purpose |
| --- | --- | --- | --- |
| Auth token | `store/auth.ts` | localStorage | Bearer token for every API call. Sanitized to printable ASCII. |
| Server cache | `store/queries.ts` | in-memory + IDB | TanStack Query (`5min staleTime`, 1 retry, refetch on focus). |
| Org config | `store/orgConfig.ts` | localStorage (Zustand persist) | Per-org enabled / syncEnabled flags. |
| Persistent data | `store/db.ts` | IndexedDB (Dexie) | Repos, orgs, prefs, tokens, pinnedRepos, snoozedPRs. |

When adding new state, pick the **lowest layer that survives long enough** — most things either belong in TanStack Query (refetchable) or as a prefs key in IDB (cheap to evict, TTL-bound).

## IndexedDB schema

Database name: `ghviewer`. Current version: 3.

```text
repos        id, nameWithOwner, owner.login, pushedAt, cachedAt
orgs         login, order
prefs        key (TTL-bound entries keyed by prefix; see CACHE_TTLS)
tokens       id (only 'current')
pinnedRepos  repoId, pinnedAt
snoozedPRs   prId, untilTs
```

Schema upgrades happen in `store/db.ts`. **Always bump the version + write an upgrade** when changing shape.

## TTL-bound prefs cache

`CACHE_TTLS` in `store/db.ts` is the single source of truth for which prefs prefixes are caches and how long they live. The current map:

| Prefix | TTL | Purpose |
| --- | --- | --- |
| `viewer:` | 1h | Viewer GraphQL query (login + memberships) |
| `tokenInfo:` | 1h | REST `/user` headers (scopes, SSO) |
| `userOrgs:` | 1h | REST `/user/orgs` (catches orgs GraphQL misses) |
| `prDetail:` | 15m | Per-PR detail (lazy, on modal open) |
| `branches:` | 15m | Per-repo branch list |
| `contrib:` | 12h | Viewer contribution calendar (Digest heatmap) |

`pruneExpiredCachePrefs()` runs at boot from `main.tsx` and evicts every expired row. The Cache tab in Settings shows live counts per group and lets users evict individually.

## GitHub API

`src/api/github.ts` is the only file that talks to `api.github.com`. Everything else consumes typed responses from there.

- GraphQL endpoint with the `REPO_FIELDS` fragment shared between viewer and org queries.
- Retries: 3 attempts, 2s delay on any GraphQL or network failure.
- REST helpers for endpoints GraphQL can't expose: `/user` (for response headers), `/user/orgs` (broader org list), Actions runs/jobs/logs.
- `fetchAllRepos` dedupes by repo `id` so a repo accessible via both viewer and org appears once. Returns `{ repos, errors }` so org-level access failures don't kill the whole sync.

## Commands

```bash
npm run dev       # Vite dev server on :8099, auto-opens
npm run build     # tsc -b && vite build — the only verification gate
npm run preview   # serve the built bundle locally
```

There is **no lint command** yet. `npm run build` is what merges go through.

## Hosting split

The repo deploys two surfaces from the same `main`:

| Surface | Source | Host | URL |
| --- | --- | --- | --- |
| Landing page | `landing/` (static HTML/CSS) | GitHub Pages | <https://dpeluche.github.io/devcompass/> |
| Live app | Vite build of `src/` | Vercel | <https://devcompass.vercel.app> |

`.github/workflows/pages.yml` only assembles the landing site (no Node build) and copies the screenshots from `docs/screenshots/`. It runs on push to `main` only when files under `landing/`, `docs/screenshots/`, or the workflow itself change.

Vercel reads `vercel.json` for the SPA rewrite (everything → `/index.html`) and runs `npm run build` on push to `main`. There is no `VITE_BASE` override on Vercel — the app serves from the root.

## Token requirements

Classic PAT with `repo` and `read:org`. SSO orgs need explicit token authorization. The Token tab in Settings surfaces `X-OAuth-Scopes` and `X-GitHub-SSO` so users can self-diagnose missing orgs.

## Markdown safety

`SanitizedMarkdown.tsx` renders any GitHub-supplied `bodyHTML` through DOMPurify. Never inject GitHub HTML directly — always go through this component.
