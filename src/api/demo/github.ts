/**
 * Barrel for the GitHub demo fixtures, split by domain. Imported exclusively
 * via dynamic `import('../demo/github')` from the API layer — the whole graph
 * (helpers included) stays out of the production bundle.
 */
export * from './repos'
export * from './prs'
export * from './account'
export * from './issues'
export * from './notifications'
