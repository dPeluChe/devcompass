import { db } from './core'

export async function snoozePr(prId: string, untilTs: number, meta?: { nameWithOwner?: string; number?: number }) {
  await db.snoozedPRs.put({
    prId,
    untilTs,
    createdAt: Date.now(),
    nameWithOwner: meta?.nameWithOwner,
    number: meta?.number
  })
}

export async function unsnoozePr(prId: string) {
  await db.snoozedPRs.delete(prId)
}

/** Returns the set of currently-snoozed PR ids and prunes expired rows along the way. */
export async function getActiveSnoozes(): Promise<Set<string>> {
  const now = Date.now()
  const expired = await db.snoozedPRs.where('untilTs').belowOrEqual(now).primaryKeys()
  if (expired.length > 0) await db.snoozedPRs.bulkDelete(expired)
  const live = await db.snoozedPRs.where('untilTs').above(now).primaryKeys()
  return new Set(live)
}
