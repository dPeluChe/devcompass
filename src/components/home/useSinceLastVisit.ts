import { useEffect, useState } from 'react'
import type { Repo, RepoOpenPR } from '../../api/github'
import {
  getVisitSnapshot,
  saveVisitSnapshot,
  type VisitSnapshot,
  type VisitSnapshotRepo
} from '../../store/db'
import { ownerAndName, type DotLevel } from './types'

export type SinceEventKind =
  | 'new-pr'
  | 'closed-pr'
  | 'merged-or-closed'
  | 'ci-changed'
  | 'commits'

export type SinceEvent = {
  key: string
  kind: SinceEventKind
  /** Org/repo nameWithOwner. */
  nameWithOwner: string
  org: string
  repo: string
  orgAvatarUrl?: string
  /** Filled for PR-level events. */
  prId?: string
  prNumber?: number
  prTitle?: string
  prUrl?: string
  prCiState?: string | null
  /** Free-form, human-readable summary line. */
  text: string
  dot: DotLevel
  time: string
}

export function buildSnapshot(repos: Repo[]): VisitSnapshot {
  const out: VisitSnapshot = { takenAt: Date.now(), repos: {} }
  for (const r of repos) {
    const openPRs: VisitSnapshotRepo['openPRs'] = {}
    for (const pr of r.openPRs.nodes ?? []) {
      openPRs[pr.id] = {
        id: pr.id,
        number: pr.number,
        updatedAt: pr.updatedAt,
        ciState: pr.ciState ?? null
      }
    }
    out.repos[r.nameWithOwner] = { pushedAt: r.pushedAt, openPRs }
  }
  return out
}

function diff(repos: Repo[], snapshot: VisitSnapshot): SinceEvent[] {
  const events: SinceEvent[] = []

  for (const r of repos) {
    const { org, repo: repoName } = ownerAndName(r.nameWithOwner)
    const orgAvatarUrl = r.owner.avatarUrl
    const prevRepo = snapshot.repos[r.nameWithOwner]
    const currentPRs = r.openPRs.nodes ?? []
    const currentIds = new Set(currentPRs.map((p) => p.id))

    // New repo entirely (not in snapshot) — skip; we don't surface "discovered repo" events.
    if (!prevRepo) continue

    // 1. Default branch advanced — pinned/active repos benefit from this signal.
    //    We only surface it if the gap is non-trivial AND there are no PR events
    //    on the same repo (those are more actionable).
    const prevPushed = new Date(prevRepo.pushedAt).getTime()
    const currPushed = new Date(r.pushedAt).getTime()
    const advanced = currPushed > prevPushed

    // 2. Newly opened PRs.
    for (const pr of currentPRs) {
      if (!prevRepo.openPRs[pr.id]) {
        events.push(prEvent('new-pr', r, pr, org, repoName, orgAvatarUrl,
          `New PR #${pr.number}: ${pr.title}`, 'info'))
      }
    }

    // 3. CI transitions on PRs that exist in both.
    for (const pr of currentPRs) {
      const prev = prevRepo.openPRs[pr.id]
      if (!prev) continue
      const prevCi = prev.ciState ?? null
      const currCi = pr.ciState ?? null
      if (prevCi === currCi) continue
      const passingNow = currCi === 'SUCCESS'
      const failingNow = currCi === 'FAILURE' || currCi === 'ERROR'
      const passingBefore = prevCi === 'SUCCESS'
      const failingBefore = prevCi === 'FAILURE' || prevCi === 'ERROR'
      if (failingNow && (passingBefore || prevCi == null)) {
        events.push(prEvent('ci-changed', r, pr, org, repoName, orgAvatarUrl,
          `CI now failing on #${pr.number}: ${pr.title}`, 'critical'))
      } else if (passingNow && failingBefore) {
        events.push(prEvent('ci-changed', r, pr, org, repoName, orgAvatarUrl,
          `CI recovered on #${pr.number}: ${pr.title}`, 'ok'))
      }
    }

    // 4. PRs that were open in the snapshot but aren't anymore — merged or closed.
    for (const prevPrId of Object.keys(prevRepo.openPRs)) {
      if (currentIds.has(prevPrId)) continue
      const prev = prevRepo.openPRs[prevPrId]
      events.push({
        key: `closed:${prevPrId}`,
        kind: 'merged-or-closed',
        nameWithOwner: r.nameWithOwner,
        org, repo: repoName, orgAvatarUrl,
        prId: prevPrId,
        prNumber: prev.number,
        text: `PR #${prev.number} closed or merged in ${r.nameWithOwner}`,
        dot: 'muted',
        time: r.pushedAt
      })
    }

    // 5. Default-branch advance, only if nothing more actionable already fired
    //    for this repo.
    if (advanced) {
      const alreadyHasRepoEvent = events.some((e) => e.nameWithOwner === r.nameWithOwner)
      if (!alreadyHasRepoEvent) {
        events.push({
          key: `commits:${r.nameWithOwner}`,
          kind: 'commits',
          nameWithOwner: r.nameWithOwner,
          org, repo: repoName, orgAvatarUrl,
          text: `New commits on ${r.defaultBranchRef?.name ?? 'main'} in ${r.nameWithOwner}`,
          dot: 'info',
          time: r.pushedAt
        })
      }
    }
  }

  // Most recent first (PR events sort by updatedAt; commit events sort by pushedAt).
  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}

function prEvent(
  kind: SinceEventKind,
  r: Repo,
  pr: RepoOpenPR,
  org: string,
  repoName: string,
  orgAvatarUrl: string | undefined,
  text: string,
  dot: DotLevel
): SinceEvent {
  return {
    key: `${kind}:${pr.id}`,
    kind,
    nameWithOwner: r.nameWithOwner,
    org, repo: repoName, orgAvatarUrl,
    prId: pr.id,
    prNumber: pr.number,
    prTitle: pr.title,
    prUrl: pr.url,
    prCiState: pr.ciState ?? null,
    text,
    dot,
    time: pr.updatedAt
  }
}

/**
 * Loads the saved snapshot once on mount, recomputes events whenever repos
 * change, and exposes a markSeen() that snapshots the current state and
 * resets the event list locally.
 */
type SnapshotState = { snapshot: VisitSnapshot | null; loaded: boolean }

export function useSinceLastVisit(repos: Repo[]) {
  const [state, setState] = useState<SnapshotState>({ snapshot: null, loaded: false })

  useEffect(() => {
    let alive = true
    getVisitSnapshot()
      .then((s) => { if (alive) setState({ snapshot: s, loaded: true }) })
      .catch(() => { if (alive) setState((prev) => ({ ...prev, loaded: true })) })
    return () => { alive = false }
  }, [])

  const { snapshot, loaded } = state
  const events = !loaded || !snapshot ? [] : diff(repos, snapshot)

  async function markSeen() {
    const next = buildSnapshot(repos)
    await saveVisitSnapshot(next)
    setState((prev) => ({ ...prev, snapshot: next }))
  }

  return {
    /** True once we've finished trying to load the saved snapshot. */
    loaded,
    /** True if no snapshot has ever been saved (first run). */
    isFirstRun: loaded && !snapshot,
    snapshot,
    events,
    markSeen
  }
}
