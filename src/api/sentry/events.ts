import { sentryFetch, type SentryAuth, type SentryPage } from './client'

export type SentryFrame = {
  filename?: string
  module?: string
  function?: string
  lineNo?: number | null
  inApp?: boolean
}

export type SentryExceptionValue = {
  type?: string
  value?: string
  stacktrace?: { frames?: SentryFrame[] } | null
}

export type SentryEventTag = { key: string; value: string }

export type SentryLatestEvent = {
  id: string
  eventID: string
  title: string
  message: string
  dateCreated: string
  tags: SentryEventTag[]
  entries: { type: string; data: unknown }[]
}

/** The most recent event for an issue — carries the stacktrace + tags. */
export function fetchSentryLatestEvent(auth: SentryAuth, issueId: string): Promise<SentryPage<SentryLatestEvent>> {
  return sentryFetch<SentryLatestEvent>(`/issues/${issueId}/events/latest/`, auth)
}

/** Pull exception values (type/value + frames) out of an event's entries. */
export function extractExceptions(event: SentryLatestEvent | undefined): SentryExceptionValue[] {
  const entry = event?.entries.find((e) => e.type === 'exception')
  if (!entry) return []
  const data = entry.data as { values?: SentryExceptionValue[] } | undefined
  return data?.values ?? []
}
