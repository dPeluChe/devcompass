# TASK TODO - labs-ghviewer

## Completed Features

### UI/UX

- [x] React Router and TanStack Query integration.
- [x] Skeleton loaders and loading states.
- [x] Framer Motion animations.
- [x] Login page redesign.
- [x] English UI copy.
- [x] Dev server port set to 8099.
- [x] Compact repo toolbar with scope chips, search, activity, sort, archived, and fork filters.
- [x] Stable org chip widths while searching.
- [x] All, Pinned, personal, and organization chips in the main filter row.
- [x] Pinned repositories section above the repo grid.
- [x] Repo card badge icons for language, private, fork, archived, branch, and PR signals.
- [x] Config tab moved into primary navigation.
- [x] Config sections for Orgs, Token, Storage, Pinned, and Org Order.

### Data Management

- [x] TanStack Query hooks for repos, PRs, rate limit, token info, and orgs.
- [x] Zustand store for app state.
- [x] Dexie IndexedDB cache for repositories and pinned repos.
- [x] Hydrate repositories from IndexedDB before network refresh.
- [x] Sequential organization repo loading with progress.
- [x] Include personal account repositories from `viewer.repositories`.
- [x] Dedupe merged repositories by GitHub id.
- [x] Retry logic for GitHub API 504 errors.

### Components

- [x] Branch Explorer.
- [x] PR Inbox.
- [x] PR Detail with sanitized markdown.
- [x] Repo Detail.
- [x] Org Manager.
- [x] Settings / Config tab.
- [x] UI components: Skeleton, Spinner, FadeIn, Pulse.

## Pending Tasks

- [ ] Add a lint script and ESLint config.
- [ ] Add error boundaries for dashboard, PR detail, and repo detail views.
- [ ] Improve mobile and narrow viewport behavior.
- [ ] Split large files into smaller modules.
- [ ] Add explicit refresh actions per source: all repos, personal repos, and individual org.
- [ ] Add repo card density modes for scan vs detail.
- [ ] Add right-click or command menu repo actions.
- [ ] Improve Config density and token guidance.
- [ ] Add tests around repo merge, cache hydration, pinned scope, and org filtering.

## Query Keys

```typescript
const queryKeys = {
  viewer: ['viewer'],
  viewerRepos: ['viewer', 'repos'],
  orgRepos: (login) => ['org', login, 'repos'],
  repo: (owner, name) => ['repo', owner, name],
  repoDetail: (owner, name) => ['repo', owner, name, 'detail'],
  branches: (owner, name) => ['repo', owner, name, 'branches'],
  prSearch: (query) => ['prs', 'search', query],
  pr: (owner, name, number) => ['pr', owner, name, number],
  rateLimit: ['rateLimit'],
  tokenInfo: ['tokenInfo'],
  userOrgs: ['user', 'orgs'],
}
```

<!-- Updated: 2026-05-06 -->
