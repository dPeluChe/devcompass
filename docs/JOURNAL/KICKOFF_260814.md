# Kickoff — devcompass · 2026-08-14

**One-liner**: Command center local-first para GitHub (repos, PRs, issues, notificaciones) + conectores Sentry/Vercel vía relay same-origin. Sin backend; token y datos viven en el navegador.
**Stack (real)**: React 19 · Vite 6 · TanStack Query 5 · Zustand 5 · Dexie 4 · framer-motion 13 · eslint 10 + vitest 4
**Activity al arranque**: último commit 23-jun-2026 (~7.5 semanas dormido) · PR #43 abierto y mergeable · working tree limpio.
**Status read**: dormido a mitad de ciclo — todo el trabajo de Wave 5 estaba committeado, solo faltaba el merge.

## Sesión de hoy (post-kickoff, todo aplicado en main)

1. **PR #43 mergeado** (merge commit, convención del repo) — Wave 5 UX: 14 commits, +3061/−3396.
2. **npm audit fix** — 8 vulns → 0 (incl. dompurify runtime, la más sensible del app).
3. **Demo data fuera del bundle de producción** — `DEMO_TOKEN` vive en `api/demo/token.ts` (estático, 1 constante); los ~700 LOC de fixtures se cargan con `import()` dinámico solo en la rama demo. Nuevo hook `useDemoData` para los 3 consumidores síncronos (RelationshipsView, RepoDetail, useUnifiedIssues). Barrel `demo-data.ts` eliminado. Verificado en dist: fixtures en chunks lazy, sin preload en index.html.
4. **Splits de archivos >300 LOC** — `demo/github.ts` (421→barrel + repos/prs/account/issues/notifications), `store/db.ts` (380→barrel sobre `store/db/`: core/repos/prefs/pins/storage/snoozes/snapshots), `api/github/repos.ts` (368→repos + repoDetail). Cero cambios para importadores (barrels preservan la superficie).
5. **Limpieza** — parámetro muerto `_pinnedCount` en `computeDigest`; dependencia muerta `dexie-react-hooks` eliminada (cero usos).
6. **Deps** — framer-motion 11→13, @vitejs/plugin-react 4→5.2 (6 exige vite 8; quedará para cuando se suba vite), lucide-react 1.31.
7. **CLAUDE.md** — 2 claims falsos corregidos (sí hay lint/tests: `npm run check`; el shell es HomeShell, no Dashboard de 1500 LOC) + hechos nuevos (repoDetail, store/db/, patrón demo lazy).

## Validación

- `npm run lint` 0/0 · `vitest` 84/84 · `tsc -b` limpio · `vite build` ok.
- Build check: fixtures demo NO en chunk principal (grep de `iteris` en index.js: ausente).

## Pendientes priorizados (no hechos hoy)

1. **OG image** (1200×630) — el SEO ya está cableado esperándolo.
2. **Fine-grained PAT** — GitHub empuja la deprecación de clásicos.
3. **vite 7/8 + plugin-react 6** — major de tooling, mejor solo.
4. Watching scope, mobile pass de scopes nuevos, density modes, multi-account, Linear/Jira/GitLab — backlog largo de TASK_TODO.

**Status: DONE** — kickoff + plan de mejoras ejecutado en su totalidad.
