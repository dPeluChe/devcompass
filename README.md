# GHDevView

GHDevView is a developer workbench for GitHub accounts with many repositories across a personal namespace and multiple organizations. It is designed to make the first screen useful for daily engineering work: find the repo you need, see what is active, jump into pull requests, and keep the most important projects pinned without waiting for a full GitHub sync on every refresh.

## Why This Exists

GitHub is excellent for repository detail, but it gets slow when the question is broader:

- Which repos across my orgs are active right now?
- Which projects have open pull requests?
- Which repos do I touch every day?
- Which orgs should I include or hide from my current workspace?
- Did my token actually have access to the orgs I expected?
- Can I refresh the page without losing the current repo list?

GHDevView answers those questions from one compact UI built for developers who switch contexts often.

## What We Built

The current implementation focuses on the repository dashboard and the supporting configuration system.

- A repo dashboard that merges personal repositories and organization repositories.
- A compact filter row with All, Pinned, personal account, organization chips, search, activity window, sort order, archived toggle, and fork toggle.
- A Pinned scope and a dedicated pinned section for active projects.
- Stable organization chips that do not resize or change counts while typing in search.
- Repo cards with useful engineering signals: owner, description, language, private/fork/archived state, default branch, open PR count, and last activity.
- PR inbox and PR detail views for review work.
- A Config tab for org visibility, token access, local cache, pinned repos, and org ordering.
- IndexedDB caching so repositories hydrate locally before fresh GitHub data finishes loading.
- Personal account repositories included through the viewer repository query, not only org repositories.
- Sanitized markdown rendering for PR content.

## Who It Is For

GHDevView is for developers who:

- Work across several GitHub organizations.
- Maintain many repos and need fast scanning.
- Want a local-first dashboard instead of waiting for a full API reload every time.
- Need to validate token access and org visibility quickly.
- Prefer dense, work-focused UI over a marketing-style dashboard.

## Main Workflow

1. Sign in with a GitHub token.
2. GHDevView loads your viewer profile, token info, organizations, rate limit, personal repositories, and org repositories.
3. Cached repositories are shown immediately when available.
4. Fresh GitHub data syncs in the background and updates the local cache.
5. Use chips to switch between All, Pinned, personal repos, and individual orgs.
6. Pin the repos you touch often so the dashboard opens around your active work.
7. Use Config when you need to manage org visibility, token access, or cache state.

## Screens

### Repos

The Repos screen is the main workbench. It is optimized for scanning:

- `All` shows every loaded repo from personal and organization sources.
- `Pinned` shows locally pinned repos and is the preferred starting scope when pins exist.
- Personal and organization chips filter by owner.
- Search filters repositories by name, description, owner, and language without changing the chip layout.
- Activity and sort controls help surface recent work.
- Archived and fork toggles keep noisy repos out of the default scan.

### PRs

The PR area helps review active pull request work. PR details render markdown safely through DOMPurify.

### Config

Config keeps operational controls out of the main dashboard:

- `Orgs`: enable, disable, and inspect synced organizations.
- `Token`: review token type, scopes, SSO/org visibility, and rate context.
- `Storage`: inspect and clear local IndexedDB cache.
- `Pinned`: review and unpin pinned repositories.
- `Org Order`: manage organization display order.

## GitHub Token Requirements

Use a GitHub classic token with:

- `repo`
- `read:org`

Create one at:

```text
https://github.com/settings/tokens
```

If an organization is missing, check:

- The token includes `read:org`.
- The token has SSO authorization for that organization.
- The organization is enabled in Config.
- The repository cache has synced after login.

## Local Cache

GHDevView uses Dexie over IndexedDB for local storage.

Cached data includes:

- Repository lists.
- Pinned repository full names.
- Organization visibility and ordering.

This cache is intentionally local to the browser. It makes reloads faster and keeps the dashboard useful before the next GitHub API sync finishes.

Use `Config -> Storage` to clear stale cache or all cache.

## Tech Stack

- React 19
- Vite
- TypeScript
- TanStack Query
- React Router
- Zustand
- Dexie / IndexedDB
- Framer Motion
- React Icons
- Lucide React
- DOMPurify

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:8099
```

Build for production:

```bash
npm run build
```

## Development Notes

There is no lint script configured yet. Use the production build as the current TypeScript and bundling verification step.

Recommended checks before merging:

```bash
npm run build
spark audit --offline
npm audit --audit-level=moderate
```

## Project Structure

```text
src/
  api/
    github.ts           GitHub GraphQL and REST helpers
  components/
    Dashboard.tsx       Main repo dashboard and filters
    SettingsTab.tsx     Config screen
    OrgManager.tsx      Organization visibility controls
    PRInbox.tsx         Pull request inbox
    PRDetail.tsx        Pull request detail
    RepoDetail.tsx      Repository detail
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

## Internal Documentation

- [Project documentation](docs/README.md)
- [Task tracking](docs/TASK_TODO.md)

## Current Status

The repository dashboard, pinned workflow, Config tab, personal repo loading, and IndexedDB hydration are implemented. The next focus is functionality improvements: richer repo actions, stronger config UX, explicit refresh controls, tests, mobile refinements, and a lint setup.
