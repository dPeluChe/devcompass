# TASK TODO - labs-ghviewer

## UI/UX Improvements

### High Priority

- [ ] Agregar skeleton loaders y estados de carga mejores
  - Crear componentes skeleton para listas, cards, detalles
  - Agregar spinner para cargas pequeñas
  - Implementar transición de skeleton → contenido

- [ ] Implementar navegación con react-router
  - Rutas: /, /repos, /repos/:owner/:name, /prs, /prs/:owner/:name/:number
  - Deep links para compartir estados
  - Browser history integration

- [ ] Crear vista de Branch Explorer
  - Listar branches por repo
  - Filtrar por fecha/actividad
  - Mostrar diff stats vs base branch
  - Quick actions (create PR, compare)

### Medium Priority

- [ ] Agregar estado global con Zustand
  - Store para repos, PRs, filters, UI state
  - Persistir preferencias locales

- [ ] Implementar caché con TanStack Query
  - Caching de repos y PRs
  - Refetch on focus
  - Optimistic updates

- [ ] Agregar filtros guardados
  - Guardar filtros frecuentes
  - Quick access toolbar

- [ ] Agregar búsqueda avanzada
  - Búsqueda por múltiples criterios
  - Keyboard shortcuts (/, ?, etc)

- [ ] Agregar responsive design
  - Mobile layout (< 768px)
  - Tablet layout (768-1024px)

### Animations & Polish

- [ ] Agregar Framer Motion transitions
  - Page transitions
  - List item stagger
  - Tab transitions
  - Modal animations

- [ ] Mejorar micro-interactions
  - Hover states
  - Focus states
  - Loading states

## Features

### Core

- [ ] PR Actions desde la app
  - Approve PR
  - Request changes
  - Comment

- [ ] Branch comparison view
  - Compare cualquier par de branches
  - Diff stats resumidos

- [ ] Notificaciones
  - Polling para nuevos PRs
  - Desktop notifications

### Data

- [ ] Exportar datos
  - CSV de PRs/repos
  - Copy to clipboard

- [ ] Dashboard summary
  - PRs needing review
  - My pending PRs
  - Activity chart

## Implementaciones Completadas

- [x] React Router + TanStack Query integrados
- [x] Query hooks: useViewer, usePRSearch, useRepoDetail, useBranches
- [x] Puerto cambiado a 8099

### Pending Tasks

- [ ] Dividir archivos grandes (>400 LOC)

- [ ] Agregar tests
- [ ] Error boundaries
- [ ] Logging/monitoring
- [ ] TypeScript strict
- [ ] ESLint config

<!-- Generated: 2025-05-04 -->