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
  /** "javascript" | "node" | "python" | … */
  platform?: string
  /** Processing problems Sentry hit (e.g. missing source maps) — explains minified frames. */
  errors?: { type?: string; message?: string; data?: Record<string, unknown> }[]
  /** Structured contexts: runtime / browser / os / device / app / … */
  contexts?: Record<string, Record<string, unknown> | undefined>
  user?: { id?: string; email?: string; username?: string; ip_address?: string } | null
  sdk?: { name?: string; version?: string } | null
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
  /** HTTP method of the request that errored, when present. */
  requestMethod: string | null
  /** "Safari 17.4 · iOS 17.4 · iPhone" from tags. */
  client: string | null
  transaction: string | null
  /** "javascript" / "node" / … */
  platform: string | null
  /** "node v20.11" / "CPython 3.12" from contexts.runtime. */
  runtime: string | null
  /** "sentry.javascript.react@7.119.0". */
  sdk: string | null
  /** "id:123 · ana@x.com" — the affected end-user, when captured. */
  user: string | null
  /** Sentry's own processing errors (missing source maps, etc.). */
  processingErrors: string[]
  breadcrumbs: SentryBreadcrumb[]
}

const EMPTY_CONTEXT: SentryEventContext = {
  eventId: null, dateCreated: null, environment: null, release: null,
  handled: null, url: null, requestMethod: null, client: null, transaction: null,
  platform: null, runtime: null, sdk: null, user: null, processingErrors: [], breadcrumbs: [],
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

  const request = event.entries.find((e) => e.type === 'request')?.data as { url?: string; method?: string } | undefined
  const url = tagValue(event, 'url') ?? request?.url ?? null

  const runtimeCtx = event.contexts?.runtime as { name?: string; version?: string } | undefined
  const runtime = runtimeCtx?.name
    ? `${runtimeCtx.name}${runtimeCtx.version ? ` ${runtimeCtx.version}` : ''}`
    : null

  const u = event.user
  const user = u ? [u.id ? `id:${u.id}` : null, u.email ?? u.username ?? null].filter(Boolean).join(' · ') || null : null

  const processingErrors = (event.errors ?? [])
    .map((e) => e.message ?? (typeof e.data?.name === 'string' ? `${e.type}: ${e.data.name}` : e.type) ?? '')
    .filter(Boolean)
    .slice(0, 6)

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
    requestMethod: request?.method ?? null,
    client,
    transaction: tagValue(event, 'transaction'),
    platform: event.platform ?? null,
    runtime,
    sdk: event.sdk?.name ? `${event.sdk.name}${event.sdk.version ? `@${event.sdk.version}` : ''}` : null,
    user,
    processingErrors,
    breadcrumbs,
  }
}

/** A commit Sentry blames for an issue (its "suspect commits" feature). */
export type SentrySuspectCommit = {
  shortSha: string
  message: string
  author: string | null
  prNumber: number | null
  prUrl: string | null
}

type RawCommitter = {
  author?: { name?: string; email?: string; username?: string } | null
  commits?: {
    id?: string
    message?: string
    pullRequest?: { externalUrl?: string; title?: string } | null
  }[]
}

/**
 * Suspect commits Sentry attributes to an issue — needs the GitHub integration
 * + commit tracking configured on the Sentry side. Returns [] (never throws) so
 * it's silent until that's set up; the endpoint 404s when unconfigured.
 */
export async function fetchSentrySuspectCommits(auth: SentryAuth, issueId: string): Promise<SentrySuspectCommit[]> {
  let committers: RawCommitter[]
  try {
    const { data } = await sentryFetch<{ committers?: RawCommitter[] }>(`/issues/${issueId}/committers/`, auth)
    committers = data.committers ?? []
  } catch {
    return []
  }
  const out: SentrySuspectCommit[] = []
  for (const c of committers) {
    const author = c.author?.username ?? c.author?.name ?? c.author?.email ?? null
    for (const commit of c.commits ?? []) {
      const prUrl = commit.pullRequest?.externalUrl ?? null
      out.push({
        shortSha: (commit.id ?? '').slice(0, 7),
        message: (commit.message ?? '').split('\n')[0].slice(0, 100),
        author,
        prNumber: prUrl ? Number(prUrl.match(/\/pull\/(\d+)/)?.[1]) || null : null,
        prUrl,
      })
      if (out.length >= 3) return out
    }
  }
  return out
}
