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

## In progress — Wave 5 "UX review pass" (clarity + honesty)

- [x] **Topbar grouping** — split the overloaded .meta block into .topbar-status (sync + refresh + summary + rate-low) and .topbar-actions (help + logout); rate-limit only renders inline when low, otherwise lives in the sync-indicator tooltip.
- [x] **Phase-2 row actions wired** — Approve (✓) and Request changes (✗) on review-requested rows now open the detail modal with a pendingAction that fires once the PR loads (approve submits; request-changes jumps to composer). "Mark read" on mentioned rows is now an honest snooze with a clear tooltip. No more dead stubs.
- [x] **Snooze undo toast** — snoozing a row shows an inline "Snoozed 18h · Undo" toast for 5s; pointer-events: auto overrides the faded row so the button stays clickable.
- [x] **Sidebar icons → react-icons** — replaced ambiguous unicode glyphs (● ◔ ↻ ◈ ∿ ★ ▴ ⊞) with react-icons/md (MdInbox, MdNotificationsActive, MdRefresh, MdReport, MdDashboard, MdStar, MdTrendingUp, MdFolder). Same weight, conventional meanings.
- [x] **Digest tiered stat cards** — 8 flat cards split into 4 primary (active, open PRs, failing CI, stale PRs) at full size + 4 secondary (total, merged, avg time, pinned) compact and borderless. Responsive 4→2 columns under 720px.
- [x] **RepoCard signal fix** — pinned no longer adds +20 to the signal score; it only lifts a quiet repo to 'active' (not 'attention'), so critical/attention stay reserved for real signals.
- [x] **Composer Write/Preview toggle** — PR comment composer has a Write/Preview tab; preview renders through a minimal inline markdown→HTML converter (no new dep) piped through SanitizedMarkdown.
- [x] **Empty states with CTA** — shared EmptyState component (icon + title + description + optional CTA button) replaces 14 plain `hs-empty` divs across all scopes. Needs me gets "Browse open PRs →", Pinned gets "Browse repos →", error states use tone="danger".
- [x] **Mobile focus trap + responsive pass** — useFocusTrap hook traps Tab/Shift+Tab in the mobile sidebar drawer, focuses first element on open, restores focus on close, Escape closes. Responsive 860px + 480px breakpoints: topbar wraps, rows stack, modal tabs scroll horizontally, relationships table scrolls, sparklines/branch badges/kbd hints hide at 480px.

## In progress — Wave 4 "trust before scale" (robustness)

- [x] **Tests for high-risk modules** — 29 tests across 7 files: relay allowlist/forwarding/size-cap, sentry client (proxy routing, cursor parse, fail-fast 4xx), normEnvironment, relativeTime boundaries (incl. the 0y regression), agentPrompt builders. (useUnifiedIssues merge needs renderHook → future with @testing-library.)
- [x] **Sanitize Sentry token on store** — sentryConfig.update sanitizes at the storage boundary (getAuth already sanitized reads).
- [x] **db.tokens dropped** — the table stored the raw token but had zero readers (saveTokenMeta/getTokenMeta/isTokenExpiringSoon were dead); Dexie v4 removes it; SECURITY.md/Settings copy updated.
- [x] **Relay hardening round 2** — method allowlist (GET/POST/PUT/PATCH/DELETE → 405 otherwise) + 20MB response size cap (declared and actual).
- [x] **Timer cleanup** — shared useFlash hook (clears on re-trigger + unmount) replaces the raw setTimeout in SinceScope, DetailModalHeader, Checks. (DetailModal's status effect already had cleanup.)
- [x] **API boundary guards (cheap)** — gql throws on 200-with-no-data; fetchWorkflowRunJobs null-safe. Full schema validation (zod) stays longer-term.

## Pending — longer term

- [ ] **vite 7/8 + @vitejs/plugin-react 6** — plugin-react 6 requires vite ^8; deferred as a tooling-only major. (This pass landed plugin-react 5.2, which supports vite 4–8.)
- [x] **Health pass (2026-08-14)** — PR #43 merged (Wave 5, 14 commits); npm audit 8→0 (incl. runtime dompurify); demo fixtures (~700 LOC) moved OUT of the prod bundle via dynamic `import()` in the `DEMO_TOKEN` branches (new `api/demo/token.ts` sentinel + `useDemoData` hook for the 3 sync consumers); `demo/github.ts` (421), `store/db.ts` (380) and `api/github/repos.ts` (368) split into domain modules behind barrels (import surface unchanged); dead `_pinnedCount` param + dead `dexie-react-hooks` dep removed; framer-motion 11→13, lucide-react 1.31; CLAUDE.md stale claims fixed. Gate: lint 0/0, 84/84 tests, build ok — demo fixtures confirmed absent from the index chunk.
- [x] **Error boundaries** — app-level + per-view (sidebar survives a scope crash; keyed by view so navigating resets) + the /repos route.
- [x] **Rate-limit aware fetching (v1)** — rateGate captures x-ratelimit-* headers passively from every gql/rest response + the dedicated rateLimit query; when the graphql/core pool drops under 5% (min 100), focus/reconnect refetches pause and the topbar shows ⚠ with a "paused until reset" tooltip. (Search pool ignored — it self-heals per minute.)
- [x] **Since-last-visit polish** — events grouped by calendar day (Today / Yesterday / date) + filter chips by event kind with counts. (Window selector skipped honestly: events derive from the snapshot diff, so the snapshot IS the window.)
- [x] **Digest v2** — commit-activity sparklines on Most active (ONE aliased GraphQL query for all top repos), "PRs merged" + "Avg time to merge" tiles (one search per window, involves:viewer); both IDB-cached 30m so window flips don't re-burn quota; demo-mode data included.
- [ ] **Watching scope (auto-derived)** — PRs you authored awaiting reviewers, review-requested gone draft, pinned repos gone quiet. (Sidebar item removed until this is real.)
- [ ] **Mobile / narrow viewport** — new scopes (issue groups, notifications, connector rows) inherit desktop flex; need responsive passes.
- [ ] **Density modes** for repo cards (scan vs detail).
- [ ] **Fine-grained PAT support** — currently classic only.
- [ ] **Multi-account** — switch between PATs without clearing cache.
- [x] **Vercel — Phase 3 (release health)** — the Sentry issue modal correlates the issue's release sha to a Vercel deploy of the same repo → "▲ Shipped in deploy `<sha>` · `<branch>` · PR #N — likely where this regression came from." (matchReleaseToDeploy + prNumberFromDeploy.)
- [x] **Relationships → alerts column** — ⚠ per repo with a failing production deploy, linking to Needs me (onGoNeeds).
- [x] **Vercel custom-domain fetch** — on connect, fetches `/projects/{id}/domains` (bounded, background) and stores the verified custom domain in projectUrls; the Relationships URL now resolves the real domain.
- [ ] **Linear / Jira / GitLab connectors** — same relay + connector pattern as Sentry/Vercel (24 on the roadmap in the Connectors hub).
- [ ] **"Send to agent"** — evolve copy-for-agent into a direct handoff (batch triage → tasks).
- [ ] **OG social card** — design `public/og-image.png` (1200×630, devcompass branding); the OG/Twitter tags already reference it. Until it exists, shares unfurl text-only.
- [ ] **Vercel primary-domain redirect** *(manual)* — set `devcompass.app` primary so `devcompass.vercel.app` 308-redirects (kills duplicate-content competition; canonical already mitigates).

## Recently shipped

- [x] **Vercel connector (Phases 1-2)** — BYOK (Personal Access Token) via the allowlisted relay; repo-detail **Deployments** tab; **failed prod deploys in Needs me** rendered like PR rows (▲ Vercel badge, branch, time-sorted) → in-app **DeployModal** with build log + copy-for-agent + "Mark as handled" (local). `api/vercel/` (client/deployments), `store/vercelConfig`, demo data.
- [x] **Connectors hub** — unified Config tab: GitHub (core, with the scopes/SSO diagnostics) + Sentry + Vercel as accordion cards with status pills; collapsible roadmap of 24 connectors (REST/GraphQL/OAuth tags) + "Request an integration". Replaced the Tokens / GitHub-access / Connectors tabs.
- [x] **Relationships tab** — repo ↔ Sentry project ↔ Vercel project matrix (full-chain rows marked), each repo links to GitHub + the live Vercel URL.
- [x] **Needs me polish** — PR rows show `⎇ head → base` branch badges; filter chips (All / Review requested / My PRs / Failing / Mentioned); review-pool skeleton.
- [x] **SEO pass** — `index.html` gets canonical (→ devcompass.app), Open Graph + Twitter Card, JSON-LD (SoftwareApplication + WebSite), refreshed title/description (panorama positioning); added `public/robots.txt`, `public/sitemap.xml`, `public/manifest.webmanifest`. OG image asset still pending.

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
