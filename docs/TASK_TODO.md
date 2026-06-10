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

## In progress — Wave 3 "seams" (navigation + consistency)

- [x] **Sentry issue → repo detail in-app** — "⊞ View repo" on the modal navigates to /repos/{owner}/{name} via the mapped repo.
- [x] **Notification rows → in-app** — PR subjects open the DetailModal, Issue subjects open the GitHubIssueModal; other types fall back to GitHub. ↗ stays as the external escape.
- [x] **QuickSwitcher coverage** — Digest / Needs me / Issues / Notifications / Since / Pinned as jump targets (kind: 'scope').
- [x] **IDB cache for needsMe / issues / notifications** — prefs-TTL pattern (5m); mark-as-read persists the filtered set so reloads don't resurrect read rows; new prefixes registered in CACHE_TTLS.
- [x] **Feed pagination** — searchIssues cursor-chains to 200, notifications page-chain to 200, Sentry consumes nextCursor to 300; truncation notes now reflect the higher caps.
- [x] **Skeleton states** — shared ScopeSkeleton replaces raw "Loading…" in Issues/Notifications.
- [x] **Text filter for long lists** — title/repo filter input in Issues + Notifications (shown past 8 items).

## In progress — Wave 4 "trust before scale" (robustness)

- [x] **Tests for high-risk modules** — 29 tests across 7 files: relay allowlist/forwarding/size-cap, sentry client (proxy routing, cursor parse, fail-fast 4xx), normEnvironment, relativeTime boundaries (incl. the 0y regression), agentPrompt builders. (useUnifiedIssues merge needs renderHook → future with @testing-library.)
- [x] **Sanitize Sentry token on store** — sentryConfig.update sanitizes at the storage boundary (getAuth already sanitized reads).
- [x] **db.tokens dropped** — the table stored the raw token but had zero readers (saveTokenMeta/getTokenMeta/isTokenExpiringSoon were dead); Dexie v4 removes it; SECURITY.md/Settings copy updated.
- [x] **Relay hardening round 2** — method allowlist (GET/POST/PUT/PATCH/DELETE → 405 otherwise) + 20MB response size cap (declared and actual).
- [x] **Timer cleanup** — shared useFlash hook (clears on re-trigger + unmount) replaces the raw setTimeout in SinceScope, DetailModalHeader, Checks. (DetailModal's status effect already had cleanup.)
- [x] **API boundary guards (cheap)** — gql throws on 200-with-no-data; fetchWorkflowRunJobs null-safe. Full schema validation (zod) stays longer-term.

## Pending — longer term

- [x] **Error boundaries** — app-level + per-view (sidebar survives a scope crash; keyed by view so navigating resets) + the /repos route.
- [x] **Rate-limit aware fetching (v1)** — rateGate captures x-ratelimit-* headers passively from every gql/rest response + the dedicated rateLimit query; when the graphql/core pool drops under 5% (min 100), focus/reconnect refetches pause and the topbar shows ⚠ with a "paused until reset" tooltip. (Search pool ignored — it self-heals per minute.)
- [x] **Since-last-visit polish** — events grouped by calendar day (Today / Yesterday / date) + filter chips by event kind with counts. (Window selector skipped honestly: events derive from the snapshot diff, so the snapshot IS the window.)
- [ ] **Digest v2** *(next up)* — sparkline per repo, PRs merged in window, avg time-to-merge.
- [ ] **Watching scope (auto-derived)** — PRs you authored awaiting reviewers, review-requested gone draft, pinned repos gone quiet. (Sidebar item removed until this is real.)
- [ ] **Mobile / narrow viewport** — new scopes (issue groups, notifications, connector rows) inherit desktop flex; need responsive passes.
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
