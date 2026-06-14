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
  /** Sentry's mechanism — `handled: false` is the unhandled-crash signal. */
  mechanism?: { handled?: boolean | null; type?: string } | null
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

/** Distilled per-event context for the agent brief — the "filter #1" fields. */
export type SentryBreadcrumb = { ts: string; label: string; message: string }
export type SentryEventContext = {
  eventId: string | null
  dateCreated: string | null
  environment: string | null
  release: string | null
  /** true=handled, false=unhandled crash, null=unknown. */
  handled: boolean | null
  url: string | null
  /** "Safari 17.4 · iOS 17.4 · iPhone" from tags. */
  client: string | null
  transaction: string | null
  breadcrumbs: SentryBreadcrumb[]
}

const EMPTY_CONTEXT: SentryEventContext = {
  eventId: null, dateCreated: null, environment: null, release: null,
  handled: null, url: null, client: null, transaction: null, breadcrumbs: [],
}

/** The most recent event for an issue — carries the stacktrace + tags. */
export function fetchSentryLatestEvent(auth: SentryAuth, issueId: string): Promise<SentryPage<SentryLatestEvent>> {
  return sentryFetch<SentryLatestEvent>(`/issues/${issueId}/events/latest/`, auth)
}

/** Pull exception values (type/value + frames + mechanism) out of an event's entries. */
export function extractExceptions(event: SentryLatestEvent | undefined): SentryExceptionValue[] {
  const entry = event?.entries.find((e) => e.type === 'exception')
  if (!entry) return []
  const data = entry.data as { values?: SentryExceptionValue[] } | undefined
  return data?.values ?? []
}

function tagValue(event: SentryLatestEvent, key: string): string | null {
  return event.tags?.find((t) => t.key === key)?.value ?? null
}

function crumbTime(ts: unknown): string {
  if (typeof ts === 'number') return new Date(ts * 1000).toISOString().slice(11, 19)
  if (typeof ts === 'string' && ts.length >= 19) return ts.slice(11, 19)
  return ''
}

/**
 * Distill the high-signal context (environment / handled / release / client /
 * url / breadcrumbs) the triage feedback flagged as missing. `handled` prefers
 * the per-exception mechanism, then the `handled` tag.
 */
export function extractEventContext(
  event: SentryLatestEvent | undefined,
  exceptions: SentryExceptionValue[]
): SentryEventContext {
  if (!event) return EMPTY_CONTEXT

  let handled: boolean | null = null
  for (const ex of exceptions) {
    if (ex.mechanism?.handled != null) { handled = ex.mechanism.handled; break }
  }
  if (handled === null) {
    const h = tagValue(event, 'handled')
    if (h === 'yes' || h === 'true') handled = true
    else if (h === 'no' || h === 'false') handled = false
  }

  const client = [tagValue(event, 'browser'), tagValue(event, 'os'), tagValue(event, 'device')]
    .filter(Boolean).join(' · ') || null

  let url = tagValue(event, 'url')
  if (!url) {
    const req = event.entries.find((e) => e.type === 'request')?.data as { url?: string } | undefined
    url = req?.url ?? null
  }

  const crumbsData = event.entries.find((e) => e.type === 'breadcrumbs')?.data as
    | { values?: Record<string, unknown>[] } | undefined
  const breadcrumbs: SentryBreadcrumb[] = (crumbsData?.values ?? []).slice(-6).map((c) => {
    const cat = (c.category ?? c.type ?? '') as string
    const data = (c.data ?? {}) as Record<string, unknown>
    let message = (c.message ?? '') as string
    if (!message && (cat === 'fetch' || cat === 'xhr' || c.type === 'http')) {
      message = `${data.method ?? ''} ${data.url ?? ''}${data.status_code ? ` → ${data.status_code}` : ''}`.trim()
    }
    if (!message && Object.keys(data).length) message = JSON.stringify(data).slice(0, 80)
    return { ts: crumbTime(c.timestamp), label: cat, message }
  })

  return {
    eventId: event.eventID ?? event.id ?? null,
    dateCreated: event.dateCreated ?? null,
    environment: tagValue(event, 'environment'),
    release: tagValue(event, 'release'),
    handled,
    url,
    client,
    transaction: tagValue(event, 'transaction'),
    breadcrumbs,
  }
}
