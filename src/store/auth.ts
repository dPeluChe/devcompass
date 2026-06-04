import { sanitizeToken } from './sanitizeToken'

const KEY = 'devcompass.pat'

export { sanitizeToken }

export const auth = {
  get(): string | null {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const clean = sanitizeToken(raw)
    return clean || null
  },
  set(token: string): void {
    localStorage.setItem(KEY, sanitizeToken(token))
  },
  clear(): void {
    localStorage.removeItem(KEY)
  }
}
