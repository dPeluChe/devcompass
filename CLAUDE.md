# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # install deps
npm run dev         # vite dev server on http://localhost:8099 (auto-opens)
npm run build       # tsc -b && vite build  — this is the only typecheck/verification step
npm run preview     # serve the built bundle
```

There is no lint or test runner configured. `npm run build` is the verification gate before merging.

The README also recommends running `spark audit --offline` and `npm audit --audit-level=moderate` before merge.

## High-Level Architecture

devcompass is a single-page React app that talks directly to GitHub from the browser using a user-supplied Personal Access Token. There is no backend. All persistence is local: `localStorage` for the token, IndexedDB (Dexie) for repo/org/pin data, and Zustand `persist` for UI and config state.

### Entry & routing — `src/main.tsx`, `src/App.tsx`

- `main.tsx` wraps the app in `QueryClientProvider` + `BrowserRouter` and defines two top-level route trees: `/login` (token entry) and `/*` (protected — gated by `auth.get()`).
- Nested routes `repos/:owner/:name` and `prs/:owner/:name/:number` render full-page `RepoDetail` / `PRDetail` overlays.
- `App.tsx` is just the token gate around `<Dashboard>`. The `Dashboard` component (`src/components/Dashboard.tsx`, ~1500 LOC) is the main workbench shell that hosts repos, PRs, and config tabs.

### API layers — `src/api/github/`, `src/api/sentry/`, `src/api/vercel/`

All GitHub access lives in `src/api/github/` (a folder of domain modules — `client`, `repos`, `prs`, `issues`, `notifications`, `account` — behind a barrel `index.ts`) — GraphQL via `https://api.github.com/graphql` plus a couple of REST hops for things GraphQL can't expose.

The **Sentry** and **Vercel** connectors live in `src/api/sentry/` and `src/api/vercel/`. They can't be called from the browser (no CORS), so every request is forwarded through the **same-origin relay** (`api/_relay.ts` → exposed as the Vercel edge function `api/proxy.ts` and a Vite dev middleware). The relay is a deliberately strict credential-forwarder: **host allowlist only** (`ALLOWED_HOST_PATTERNS` — add + test one host at a time), https only, forwards just `authorization`/`content-type`/`accept`, strips `set-cookie`, `redirect: 'manual'` (anti-SSRF), 25s timeout, 20MB cap, method allowlist. BYO connector tokens stay in the browser (`store/sentryConfig.ts`, `store/vercelConfig.ts`).

- `gql()` is the shared GraphQL client. It retries 3× with a 2s delay on any failure (network or GraphQL `errors` array). Don't add a separate retry layer on top.
- The repo sync lives in `useViewerData` (`src/hooks/useViewerData.ts`), not the API layer. `loadRepos` there merges viewer + org logins, then fetches each via `fetchViewerReposSimple` / `fetchOrgReposSimple` through a bounded-concurrency pool, dedupes by repo `id`, and reports per-org partial failures instead of throwing. The API layer just exposes the per-source paginating fetchers; orchestration/caching is the hook's job.
- `fetchTokenInfo()` hits REST `/user` specifically to read `X-OAuth-Scopes` and `X-GitHub-SSO` response headers. GraphQL can't expose these, and SSO authorization gaps are the most common reason orgs appear missing.
- The `REPO_FIELDS` GraphQL fragment is shared between viewer and org queries; keep them aligned when adding fields.

### State layers

The codebase splits state by lifetime/scope. When adding state, pick the right layer:

| Layer | File | Purpose |
|---|---|---|
| Auth token | `src/store/auth.ts` | `localStorage` only. `auth.set/get/clear`. Sanitizes to printable ASCII before storing — pasted tokens often pick up NBSP/zero-width chars that break `fetch` headers. |
| Server cache | `src/store/queries.ts` | TanStack Query client + `queryKeys` registry. 5min `staleTime`, 1 retry, refetch on focus/reconnect. Components call `useQuery` directly with these keys; there is no per-resource hook wrapper. |
| Org config | `src/store/orgConfig.ts` | Persisted Zustand store under `devcompass-org-config`. Per-org `enabled` / `syncEnabled` / `lastSyncedAt`. `orgNeedsSync()` triggers a re-sync after 1h. |
| Connectors | `src/store/sentryConfig.ts`, `src/store/vercelConfig.ts` | Persisted Zustand stores (`devcompass-sentry-config`, `devcompass-vercel-config`). BYO token (sanitized at the boundary) + project→repo maps. Consumed by the connectors hub, repo-detail tabs, and the Relationships matrix. |
| Persistent data | `src/store/db.ts` | Dexie/IndexedDB at name `devcompass`, **version 4**. Tables: `repos`, `orgs`, `prefs`, `pinnedRepos`, `snoozedPRs`. (v4 dropped the dead `tokens` table.) `prefs` holds the TTL-bound cache — `CACHE_TTLS` is the single source of truth for prefixes/windows. **Bump the version and write an upgrade in `db.ts` when changing schema.** |

Only `useGlobalShortcuts` lives in `src/hooks/`. Domain hooks (`useNeedsMe`, `useSinceLastVisit`) live next to their feature in `src/components/home/`.

### Local-first hydration pattern

This is the load sequence Dashboard relies on; preserve it when refactoring:

1. Read cached repos from IndexedDB (`getCachedRepos`) → render immediately.
2. In parallel, `useViewerData` calls `fetchViewer` → REST `/user/orgs` via `fetchUserOrgsRest` (to catch orgs GraphQL misses) → merges org lists → `loadRepos` syncs each source.
3. Persist the fresh result back to IndexedDB via `cacheRepos`.
4. `orgConfigStore.setAllOrgs` reconciles new orgs with existing per-org config (preserves `enabled`/`syncEnabled` flags across syncs).

The merge is important: `fetchUserOrgsRest` exists specifically because GraphQL `viewer.organizations` sometimes returns fewer orgs than REST does, depending on token type and SSO state.

### PR markdown rendering

`SanitizedMarkdown.tsx` renders PR `bodyHTML` through DOMPurify. Don't render GitHub-supplied HTML without going through it.

## Token Requirements

GitHub classic PAT with `repo` and `read:org`. SSO orgs need explicit token authorization. The `Config → Token` tab surfaces the SSO header so users can self-diagnose missing orgs.

## Vite specifics

`vite.config.ts` defines manual chunks (`react`, `data`, `motion`, `icons`, `vendor`) — keep heavy deps assigned to a chunk to keep the initial bundle lean.
