# Task backlog — devcompass

Living list of what is done and what is next. Newest entries up top within each section.
Wave numbering comes from the 2026-06 product audit (architecture + UX + perf/security).

## In progress — Wave 1 "the demo and the truth"

- [x] **Demo data for the new scopes** — DEMO_ISSUES, DEMO_NOTIFICATIONS, demo Sentry issues + project→repo map so Issues/Notifications showcase in demo mode instead of rendering empty.
- [x] **Honest truncation indicators** — Issues / Notifications / Sentry feeds fetch one page (50/50/100) and silently cap; show "showing first N" when the cap is hit. (Full pagination = Wave 3.)
- [x] **Remove dead-end scopes** — 'rate' sidebar item (placeholder pointing at Config) and the unused 'watching'/'rate' ScopeKey members + PlaceholderScope.
- [x] **Login copy refresh** — "GitHub command center" → panorama positioning, matching the landing.

## In progress — Wave 2 "from viewpoint to cockpit" (actions)

- [x] **Notifications: mark as read** — single + mark-all (REST PATCH /notifications/threads/:id), optimistic update.
- [x] **Sentry mutations** — resolve / ignore from the issue modal (PUT /organizations/:org/issues/:id via relay; 403 surfaces an event:write scope hint).
- [x] **GitHub issue actions** — comment / close / reopen from GitHubIssueModal.

## Pending — Wave 3 "seams" (navigation + consistency)

- [ ] **Sentry issue → repo detail in-app** — modal + rows link to the mapped repo (projectRepoMap already knows it).
- [ ] **Notification PR rows → in-app DetailModal** instead of always external GitHub.
- [ ] **QuickSwitcher coverage** — issues, notifications, and the new scopes as jump targets.
- [ ] **IDB cache for needsMe / issues / notifications** — same prefs-TTL pattern as Sentry/PR detail, so reloads paint instantly everywhere.
- [ ] **Feed pagination** — consume Sentry nextCursor + GitHub Link header / search cursors instead of first-page-only.
- [ ] **Skeleton states everywhere** — Issues/Notifications use raw "Loading…" text; NeedsScope-style skeletons.
- [ ] **Text filter for long lists** — Issues / Notifications scopes.

## Pending — Wave 4 "trust before scale" (robustness)

- [ ] **Tests for high-risk modules** — api/_relay allowlist, sentry client (cursor/retry/env-normalize), useUnifiedIssues merge, utils/time boundaries, agentPrompt builders.
- [ ] **Sanitize Sentry token on store** — sentryConfig should run sanitizeToken like the PAT does.
- [ ] **db.tokens stores the token string** — keep only metadata (scopes/expiry).
- [ ] **Relay hardening round 2** — response size cap, HTTP method restriction.
- [ ] **Timer cleanup** — 4 setTimeout without unmount cleanup (SinceScope, DetailModalHeader, Checks, DetailModal status).
- [ ] **API boundary validation** — gql/rest/sentryFetch all cast `as T` with no runtime shape check.

## Pending — longer term

- [ ] **Watching scope (auto-derived)** — PRs you authored awaiting reviewers, review-requested gone draft, pinned repos gone quiet. (Sidebar item removed until this is real.)
- [ ] **Since-last-visit polish** — group by day, filter chips by event kind, optional window selector.
- [ ] **Digest v2** — sparkline per repo, PRs merged in window, avg time-to-merge.
- [ ] **Error boundaries** for Dashboard, repo-detail, PR detail.
- [ ] **Mobile / narrow viewport** — new scopes (issue groups, notifications, connector rows) inherit desktop flex; need responsive passes.
- [ ] **Rate-limit aware fetching** — quota is displayed but never drives backoff/batching.
- [ ] **Density modes** for repo cards (scan vs detail).
- [ ] **Fine-grained PAT support** — currently classic only.
- [ ] **Multi-account** — switch between PATs without clearing cache.
- [ ] **Linear / Jira / GitLab connectors** — same relay + connector pattern as Sentry.
- [ ] **"Send to agent"** — evolve copy-for-agent into a direct handoff (batch triage → tasks).

## Recently shipped

- [x] **Landing at /** — marketing landing lives in the app (lazy, logged-out root); standalone `landing/` + Pages workflow removed; hero with brand mark + two-line headline; local-only storage copy.
- [x] **Notifications scope** — GitHub /notifications as a cross-repo "involves you" inbox, grouped by repo, sidebar badge.
- [x] **Tokens section** — Config → Tokens registry (GitHub + Sentry, masked, status, create/rotate links).
- [x] **Unified Issues feed** — GitHub (assigned) + Sentry by repo with All/GitHub/Sentry filter; in-app detail modals for both; ⧉ Copy-for-agent briefs.
- [x] **Sentry connector** — generic allowlist relay (api/_relay + /api/proxy + vite dev middleware), BYOK config, two-phase setup/connected flow, searchable project→repo mapping editor (auto-seeded from code mappings, per-row autosave), per-project issue counts, repo-detail Sentry tab.
- [x] **Login/UI fixes** — atmospheric bg on /login, placeholder Watching item removed.
- [x] **Rename ghviewer → devcompass** — storage keys, Dexie DB, docs (no migration, pre-launch).
- [x] **Health pass** — ESLint + Vitest + `npm run check` + CI; useViewerData extracted (try/finally, cached-query helper, bounded-concurrency sync); github.ts split into domain modules; DetailModal split; SettingsTab dead code removed; CachePanel extracted.
- [x] **OSS-ready docs pass** — LICENSE (MIT), README rewrite, issue/PR templates.
- [x] **Digest scope v1 + heatmap + default landing.**
- [x] **Cache UI rich detail + TTL-bound IDB cache + hard refresh.**
- [x] **Repo detail rich / Home redesign / local-first hydration.**

## Query keys

Single source of truth: `src/store/queries.ts` (don't duplicate the list here — it drifts).
