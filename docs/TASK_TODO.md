# TASK TODO - labs-ghviewer

## Completed Features

### UI/UX
- [x] React Router + TanStack Query integration
- [x] Skeleton loaders and loading states
- [x] Framer Motion animations
- [x] Login page redesign with pattern background
- [x] All text in English
- [x] Port changed to 8099

### Data Management
- [x] TanStack Query hooks for repos, PRs, rate limit
- [x] Zustand store for app state
- [x] Cache store for avoiding re-fetches
- [x] Sequential org repos loading with progress
- [x] Retry logic for GitHub API 504 errors

### Components
- [x] Branch Explorer
- [x] UI components (Skeleton, Spinner, FadeIn, Pulse)

### Query Keys
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

## Pending Tasks

- [ ] Divide large files (>400 LOC)
  - github.ts ~722 lines
  - Dashboard.tsx ~503 lines

- [ ] Add error boundaries
- [ ] Mobile responsive design

<!-- Generated: 2025-05-05 -->