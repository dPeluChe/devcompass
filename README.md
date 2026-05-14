<!-- markdownlint-disable MD033 MD041 -->

<h1 align="center">devcompass</h1>

<p align="center">
  <strong>A local-first command center for your GitHub work.</strong><br>
  See every repo, PR, and signal across all your orgs in one place — without a backend, without trackers, without giving your token to anyone.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="React 19" src="https://img.shields.io/badge/react-19-61dafb.svg">
  <img alt="Vite 6" src="https://img.shields.io/badge/vite-6-646cff.svg">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.7-3178c6.svg">
  <img alt="No backend" src="https://img.shields.io/badge/backend-none-success.svg">
</p>

<!-- TODO: replace with a real screenshot. Recommended: capture the Digest scope landing page on a dark theme, ~1600x1000, save as docs/screenshots/digest.png -->
<p align="center">
  <img src="docs/screenshots/digest.png" alt="devcompass Digest scope — heatmap + operational snapshot" width="900">
</p>

---

## Why devcompass

GitHub is great at one repo at a time. It is **slow** at the questions developers actually ask every morning:

- Which of my repos got activity yesterday?
- Where are PRs waiting on me?
- Which open PRs across all my orgs have failing CI?
- Did my token authorize the org I expected, or did SSO silently block it?
- Can I reload the page without waiting 30 seconds for a full GitHub sync?

devcompass answers those from one dense, fast UI built for people who work across many GitHub orgs and switch context often.

## Highlights

- **Digest scope** — operational snapshot of the last 24h / 7d / 30d. Top stat tiles, GitHub-style contribution heatmap, most active repos, open-PR contributors, "needs attention" rows.
- **Needs me** — every PR where you are a requested reviewer or co-author, with snooze.
- **Since last visit** — diff feed of what changed since you last marked the home as seen.
- **All repos** — every visible repo (yours + member orgs + collaborator orgs), filtered by org chip, language, activity window, search.
- **Repo detail** — Overview / Commits / PRs / Issues / Releases, with branch chips on each commit and merged-PR history.
- **Local-first** — IndexedDB caches repos, PR detail, branches, orgs, viewer info, and the contribution calendar (TTL-bound, auto-pruned). Reloads paint instantly.
- **Privacy by design** — your Personal Access Token lives in `localStorage`, nothing is sent to any server we control. No analytics. No tracking. No cookies.

## Screenshots

<!-- TODO: capture each of these and replace the placeholders below.
     Recommended size: 1600x1000, dark theme, after a fresh sync so counts are populated. -->

| View | Screenshot |
| --- | --- |
| **Digest** — operational snapshot + heatmap | ![Digest](docs/screenshots/digest.png) |
| **All repos** — chip filters + scan grid | ![All repos](docs/screenshots/repos.png) |
| **Repo detail** — tabs + commit branches | ![Repo detail](docs/screenshots/repo-detail.png) |
| **Login** — token entry + scope explainer | ![Login](docs/screenshots/login.png) |
| **Settings → Cache** — TTL-bound IDB inspector | ![Cache panel](docs/screenshots/config-cache.png) |

## Privacy & Security

This is a **single-page app that talks directly to GitHub from your browser**. There is no backend. There is no analytics. There is no telemetry.

| What | Where | Why |
| --- | --- | --- |
| Your GitHub PAT | `localStorage` under `ghviewer.pat` | Needed to call the GitHub API on every reload. Never sent anywhere except `api.github.com`. |
| Cached repos / PR detail / branches | IndexedDB (`ghviewer` database, Dexie) | Lets the UI render instantly on reload before the next sync finishes. TTL-bound, auto-pruned. |
| Per-org visibility flags | `localStorage` (Zustand persist, key `ghviewer-org-config`) | Remembers which orgs you have toggled off in Settings. |
| Snoozed PRs, pinned repos, visit snapshot | IndexedDB | Persist your workbench state between sessions. |

You can wipe all local state from **Settings → Storage → Clear all cache**. The token UI also masks the PAT (`***`) so it never paints to the DOM.

## Token requirements

devcompass needs a **GitHub classic Personal Access Token** with:

- `repo`
- `read:org`

Create one at <https://github.com/settings/tokens>. If an org appears missing after login, check Settings → Token — the panel surfaces `X-OAuth-Scopes` and `X-GitHub-SSO` from the API response so you can see whether SSO authorization is missing for that org.

> Fine-grained tokens work for personal repos but currently miss organization repos due to GraphQL `viewer.organizations` requiring `read:org` (a classic scope). Classic tokens are recommended.

## Quick start

```bash
git clone https://github.com/dPeluChe/devcompass.git
cd devcompass
npm install
npm run dev
```

Open <http://localhost:8099>, paste your token, done.

To build a static bundle you can drop on Netlify / Vercel / GitHub Pages / S3:

```bash
npm run build
# outputs to dist/
```

There is no backend — `dist/` is everything.

## Try the demo

| | URL | What it is |
| --- | --- | --- |
| 🌐 | **<https://dpeluche.github.io/devcompass/>** | Project landing page (what / why / screenshots) |
| 🚀 | **<https://devcompass.vercel.app>** | Live app — paste a PAT and use it |

> First time visiting? The app will ask for a Personal Access Token. The page never sends it anywhere except `api.github.com` — verify in your browser DevTools → Network if you want to confirm.

## Architecture

```text
┌─ React 19 + Vite 6 SPA ──────────────────────────────────────┐
│                                                                │
│  ┌─ TanStack Query ─────┐    ┌─ Zustand (persist) ──────────┐ │
│  │ in-memory cache     │    │ per-org enabled / syncEnabled │ │
│  │ react-renderer key   │    │ stored in localStorage         │ │
│  └──────────────────────┘    └────────────────────────────────┘ │
│                                                                │
│  ┌─ Dexie / IndexedDB (db name: ghviewer) ───────────────────┐ │
│  │ repos · orgs · prefs · tokens · pinnedRepos · snoozedPRs  │ │
│  │ TTL-bound prefs cache with auto-prune                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌─ src/api/github.ts (one file, no SDK) ───────────────────┐ │
│  │ GraphQL + REST against api.github.com                     │ │
│  │ retries 3x on transient failures                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

For a deeper tour of the source tree, see [`docs/README.md`](docs/README.md).

## Tech stack

- **React 19** + **Vite 6** + **TypeScript 5.7** (strict)
- **TanStack Query 5** for server-state caching
- **Dexie** for IndexedDB persistence
- **Zustand** for UI/config state
- **React Router 7** for nested routes
- **DOMPurify** for safe PR markdown
- **Framer Motion** (lazy-loaded) for animations
- **react-icons** + **lucide-react** for iconography

## Roadmap

devcompass started as a GitHub-only workbench, but the scope/digest concepts are designed to grow. On the near horizon:

- **Watching scope** — auto-derived: PRs you authored awaiting reviewers, PRs you review-requested that went draft, pinned repos with no recent activity.
- **Digest v2** — sparklines per repo, PRs merged in window, avg time-to-merge, top commit-contributors.
- **Cross-platform** — once the GitHub story is solid, plug GitLab / Bitbucket / Linear into the same scope model.

The full backlog lives in [`docs/TASK_TODO.md`](docs/TASK_TODO.md). Issues and PRs welcome.

## Contributing

PRs and issues are welcome. Before opening a PR:

1. Run `npm run build` — it is the only verification gate (0 errors, 0 warnings).
2. Follow the commit-message style in recent history (`feat(scope): …`, `fix(scope): …`).
3. Keep PRs focused: one logical change per PR.
4. No backend, no analytics, no telemetry — privacy is a core feature.
5. Use `<ConfirmDialog>` instead of native `confirm()` / `alert()` / `prompt()`.
6. Render any GitHub-supplied HTML through `<SanitizedMarkdown>` (DOMPurify).

## License

[MIT](LICENSE) © 2026 Antonio Martinez Quintero. Use it, fork it, ship it.
