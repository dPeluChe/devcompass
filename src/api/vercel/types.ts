// Vercel REST API shapes (the subset devcompass consumes). Docs:
// https://vercel.com/docs/rest-api

/** Deployment lifecycle state. */
export type VercelDeploymentState =
  | 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | 'CANCELED' | 'INITIALIZING'

export type VercelProject = {
  id: string
  name: string
  /** Git connection, when the project is linked to a repo. */
  link?: {
    type?: string
    /** GitHub: owner login. */
    org?: string
    /** GitHub: repo name. */
    repo?: string
    productionBranch?: string
  } | null
}

export type VercelDeployment = {
  uid: string
  name: string
  /** Deployment URL (no scheme). */
  url: string
  /** Epoch ms. */
  created: number
  state?: VercelDeploymentState
  readyState?: VercelDeploymentState
  /** 'production' for prod deploys; null/undefined for previews. */
  target?: string | null
  creator?: { username?: string } | null
  inspectorUrl?: string | null
  meta?: {
    githubCommitSha?: string
    githubCommitRef?: string
    githubCommitMessage?: string
    githubCommitAuthorName?: string
    githubCommitOrg?: string
    githubCommitRepo?: string
  } | null
}

export type VercelUser = { user?: { username?: string; email?: string } }
