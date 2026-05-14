# Task backlog — devcompass

Living list of what is done and what is next. Newest entries up top within each section.

## Recently shipped

- [x] **OSS-ready docs pass** — LICENSE (MIT), README rewrite with privacy section, GitHub issue/PR templates, Pages workflow, screenshot placeholders, rebrand to `devcompass`.
- [x] **Digest scope v1** — operational snapshot from `data.repos` (no extra API calls): stat tiles, most active repos, open-PR contributors, needs-attention rows. Window selector (24h/7d/30d).
- [x] **Contribution heatmap** — viewer.contributionsCollection, 12h IDB cache, GitHub-light palette, today highlight, hs-tip tooltips per cell + legend.
- [x] **Digest as default landing** — sidebar Summary group at top, scope defaults to `digest`.
- [x] **Cache UI rich detail** — Storage + Cache tabs separated; cache chips with TTL groups, token masked, auto-prune of expired rows.
- [x] **TTL-bound IDB cache for hot reads** — viewer / tokenInfo / userOrgs (1h), prDetail / branches (15m), contrib (12h). `pruneExpiredCachePrefs` runs at boot.
- [x] **ConfirmDialog** replaces native `confirm` / `alert` / `prompt` everywhere (Clear cache, Hard refresh, etc).
- [x] **Hard-refresh button** in Settings — invalidates viewer / tokenInfo / userOrgs cache and triggers full sync.
- [x] **Sidebar split: Member vs Collaborator orgs** — two groups with custom tooltip and per-kind icon.
- [x] **All repos collaborator preservation** — switched from per-org `getCachedRepos` to `getAllCachedRepos` so collab repos survive normal reloads.
- [x] **Refactor pass**: DetailModal 1211→623 LOC, RepoDetail 624→67 LOC, ScopeView 511→17 LOC. LazyMotion saves ~43KB raw.
- [x] **Repo detail rich** — Overview / Commits (paginated, with PR branch chips) / PRs (state filter) / Issues / Releases / Checks (copy log button). Sidebar persists in repo view.
- [x] **Home redesign** — list-only home + centered modal, scopes architecture, PRs view removed (replaced by Needs me + Detail modal).
- [x] **Local-first hydration** — paint cached repos instantly while the fresh sync runs in the background.

## Pending — near term

- [ ] **Watching scope (auto-derived)** — PRs you authored awaiting reviewers, PRs you review-requested that went draft, pinned repos with no recent activity.
- [ ] **Since-last-visit polish** — group by day, filter chips by event kind, optional window selector.
- [ ] **Digest v2** — sparkline per repo in Most active, PRs merged in window, avg time-to-merge, top commit-contributors (cached time-bucketed queries).
- [ ] **Layout polish for ultrawide** — responsive heatmap cells (`clamp(14px, 1.2vw, 24px)`), 2-column lists at >1800px, soft cap at ~2200px.
- [ ] **Error boundaries** for Dashboard, repo-detail, PR detail.
- [ ] **Mobile / narrow viewport** improvements beyond current sidebar drawer.

## Pending — longer term

- [ ] **Lint setup** — ESLint + the existing TypeScript strict mode as the floor.
- [ ] **Tests** around repo merge, cache hydration, TTL prune, snooze, since-last-visit diff.
- [ ] **Density modes** for repo cards (scan vs detail).
- [ ] **Command menu** for repo actions (cmd+k extension).
- [ ] **Fine-grained PAT support** — currently classic only because GraphQL `viewer.organizations` is stricter.
- [ ] **Multi-account** — switch between PATs without clearing cache.
- [ ] **GitLab / Bitbucket / Linear adapters** — share the scope model across platforms.

## Query keys (TanStack Query)

```ts
const queryKeys = {
  viewer: ['viewer'],
  viewerRepos: ['viewer', 'repos'],
  orgRepos: (login: string) => ['org', login, 'repos'],
  repo: (owner: string, name: string) => ['repo', owner, name],
  repoDetail: (owner: string, name: string) => ['repo', owner, name, 'detail'],
  branches: (owner: string, name: string) => ['repo', owner, name, 'branches'],
  prSearch: (q: string) => ['prs', 'search', q],
  pr: (owner: string, name: string, number: number) => ['pr', owner, name, number],
  rateLimit: ['rateLimit'],
  tokenInfo: ['tokenInfo'],
  userOrgs: ['user', 'orgs']
}
```

<!-- Updated: 2026-05-13 -->
