# GH Viewer

Your personal GitHub dashboard for managing repositories and pull requests across all your organizations.

## Features

- **Repositories Dashboard**: Browse all your repos across organizations
- **PR Inbox**: View PRs where you're author, assignee, or reviewer
- **Branch Explorer**: Browse branches per repository
- **Rate Limit Display**: See your GitHub API rate limit in real-time

## Tech Stack

- React 19 + Vite
- TanStack Query for data fetching
- React Router for navigation
- Zustand for state management
- Framer Motion for animations

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:8099

### Getting a Token

1. Go to https://github.com/settings/tokens?type=beta
2. Create a classic token with scopes: `repo` + `read:org`
3. Paste the token in the login form

## Architecture

### Query Keys

All TanStack Query keys are centralized in `src/store/queries.ts`:

```typescript
// Viewer & repos
viewer, viewerRepos, orgRepos(login), allRepos, rateLimit

// PRs
prSearch(query), pr(owner, name, number)

// Repo details (cached separately to avoid re-fetching)
repoDetail(owner, name), branches(owner, name)
```

### Loading Strategy

1. **Initial load**: viewer + tokenInfo + userOrgs (parallel, ~3 requests)
2. **Repos**: loaded sequentially per org with progress indicator
3. **Caching**: 5-30min staleTime depending on data type
4. **Retry**: 3 attempts with 2s delay for 504 errors

## File Structure

```
src/
├── api/
│   └── github.ts           # GraphQL queries
├── components/
│   ├── Dashboard.tsx      # Main dashboard
│   ├── PRInbox.tsx        # PR list + detail
│   ├── PRDetail.tsx      # Single PR view
│   ├── RepoDetail.tsx    # Repo details
│   ├── BranchExplorer.tsx
│   ├── TokenSetup.tsx
│   └── ui.tsx             # UI components
├── hooks/
│   ├── useRepos.ts
│   ├── usePRs.ts
│   └── useRepo.ts
├── store/
│   ├── queries.ts         # TanStack Query config
│   ├── app.ts            # Zustand app state
│   └── cache.ts          # Local cache
└── main.tsx              # App entry with routing
```

## Commands

- `npm run dev` - Start dev server (port 8099)
- `npm run build` - Production build

<!-- Generated: 2025-05-05 -->