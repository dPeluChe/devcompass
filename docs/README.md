# GHDevView Documentation

GHDevView is a local-first GitHub workbench for developers who manage many repositories across personal accounts and organizations.

## Product Scope

The app is optimized for fast repo triage:

- See personal repositories and organization repositories in one dashboard.
- Start on pinned work when pinned repos exist.
- Switch quickly between All, Pinned, and individual org scopes.
- Search repositories without changing org chip layout or counts.
- Detect active repos, open PRs, language stack, private/fork/archived status, branch, and last update.
- Use Config to manage org visibility, token access, local cache, pinned repos, and org ordering.

## Main Views

### Repos

- Compact filter row with scope chips, search, activity window, sort order, archived toggle, and fork toggle.
- Scope chips include All, Pinned, personal account, and each synced org.
- Pinned section highlights selected repos above the normal repo grid.
- Repo cards show owner, description, language icon, branch, PR count, private/fork/archived badges, and relative activity.

### PRs

- Pull request inbox for review and follow-up work.
- PR detail view with sanitized markdown rendering.

### Config

Config is split into sections:

- Orgs: choose which organizations are available and synced.
- Token: show token type, scopes, SSO/org visibility, and rate context.
- Storage: inspect and clear local IndexedDB cache.
- Pinned: review and unpin pinned repositories.

## Data Loading

Initial app data is loaded from GitHub and IndexedDB:

1. Load viewer, token info, org access, and rate limit.
2. Hydrate cached repositories from IndexedDB immediately when available.
3. Fetch fresh or missing repositories from GitHub.
4. Merge personal repositories from `viewer.repositories` with organization repositories.
5. Dedupe repositories by GitHub id.
6. Persist the merged repository list back into IndexedDB.

This keeps refreshes useful even before the network sync finishes.

## Local Storage

Dexie stores local app data in IndexedDB:

- Cached repositories.
- Pinned repository full names.
- Organization visibility/order configuration.

Use `Config -> Storage` to clear all cache or stale cache.

## GitHub Access

Recommended token:

- Type: classic token.
- Scopes: `repo`, `read:org`.

Missing org data usually means one of:

- The token cannot see that org.
- SSO authorization is missing for that org.
- The org is disabled in Config.
- Cache was cleared and the GitHub sync has not completed.

## Architecture

### Query Keys

TanStack Query keys are centralized in `src/store/queries.ts`.

```typescript
viewer
viewerRepos
orgRepos(login)
allRepos
rateLimit
tokenInfo
userOrgs
prSearch(query)
pr(owner, name, number)
repoDetail(owner, name)
branches(owner, name)
```

### Important Modules

```text
src/
  api/
    github.ts           GitHub GraphQL and REST helpers
  components/
    Dashboard.tsx       Repo dashboard and filters
    SettingsTab.tsx     Config view
    OrgManager.tsx      Org visibility controls
    PRInbox.tsx         Pull request inbox
    PRDetail.tsx        Pull request detail
    RepoDetail.tsx      Repo detail
    BranchExplorer.tsx  Branch browser
    SanitizedMarkdown.tsx
    TokenSetup.tsx
    ui.tsx
  hooks/
    useRepos.ts
    usePRs.ts
    useRepo.ts
  store/
    app.ts
    cache.ts
    db.ts
    orgConfig.ts
    queries.ts
  main.tsx
```

## Commands

```bash
npm run dev
npm run build
```

There is no lint command configured in `package.json` yet.

## Verification

Before merging UI or data-loading changes:

```bash
npm run build
spark audit --offline
npm audit --audit-level=moderate
```

## Current UI Direction

Next changes should keep the tool dense and developer-focused:

- Prefer one-row controls where possible.
- Avoid oversized cards for config screens.
- Keep repo filters stable while typing search text.
- Keep org and personal scopes visible.
- Surface actionable repo signals before decorative content.

<!-- Updated: 2026-05-06 -->
