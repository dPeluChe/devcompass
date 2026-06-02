// Public barrel for the GitHub API layer. Splitting the old 1100-line github.ts
// into types/repos/account/prs keeps each concern navigable while every existing
// `import { … } from '../api/github'` site keeps resolving here unchanged.
// gql()/rest() in client.ts stay internal — callers use the typed functions.
export * from './types'
export * from './repos'
export * from './account'
export * from './prs'
