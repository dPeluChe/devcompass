import { getPref, savePref } from './prefs'

/**
 * Compact snapshot of the user's "world" the last time they marked the home as
 * seen. Diffing the current repos against this is what powers the Since-last-
 * visit scope. Stored in `prefs` (single row), versioned so we can evolve the
 * shape without colliding with the legacy v1 snapshot from the old home.
 */
export type VisitSnapshot = {
  takenAt: number
  repos: Record<string, VisitSnapshotRepo>
}
export type VisitSnapshotRepo = {
  pushedAt: string
  /** Keyed by PR id. Captures everything we need to detect transitions. */
  openPRs: Record<string, { id: string; number: number; updatedAt: string; ciState: string | null }>
}

const VISIT_SNAPSHOT_KEY = 'home.visitSnapshot.v2'

export async function getVisitSnapshot(): Promise<VisitSnapshot | null> {
  return getPref<VisitSnapshot | null>(VISIT_SNAPSHOT_KEY, null)
}

export async function saveVisitSnapshot(snapshot: VisitSnapshot): Promise<void> {
  await savePref(VISIT_SNAPSHOT_KEY, snapshot)
}
