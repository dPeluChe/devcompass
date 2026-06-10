// Shared transport for the GitHub API layer. Internal to api/github — the barrel
// does not re-export these, so callers go through the typed domain functions.

const GH_GRAPHQL = 'https://api.github.com/graphql'

export async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const MAX_RETRIES = 3
  const RETRY_DELAY = 2000
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(GH_GRAPHQL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub API ${res.status}: ${text}`)
      }

      const json = await res.json()
      if (json.errors) {
        throw new Error(json.errors.map((e: { message: string }) => e.message).join('; '))
      }
      // Cheap boundary check: a 200 with no data is a malformed/proxy response,
      // not a usable payload — fail loudly instead of letting `undefined as T`
      // propagate into the UI.
      if (json.data == null) throw new Error('GitHub API returned no data')
      return json.data as T
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`GraphQL attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY}ms...`, lastError.message)
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      }
    }
  }
  throw lastError || new Error('Unknown error')
}

/**
 * Calls the GitHub REST API. Throws with the response message on non-2xx so the
 * caller can show it inline. Centralizes auth + content-type + body handling so
 * the action helpers stay one-liners.
 */
export async function rest(token: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body == null ? undefined : JSON.stringify(body)
  })
  if (!res.ok) {
    let detail: string
    try {
      const j = await res.json()
      detail = (j && (j.message ?? j.error)) ? `: ${j.message ?? j.error}` : ''
    } catch {
      detail = `: ${await res.text().catch(() => '')}`
    }
    throw new Error(`GitHub ${res.status}${detail}`)
  }
  if (res.status === 204) return null
  return res.json().catch(() => null)
}
