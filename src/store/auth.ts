const KEY = 'ghviewer.pat'

// HTTP headers only allow ASCII (ByteString). Strip anything outside printable ASCII
// to avoid the "character has value > 255" fetch error when copy-pasting tokens that
// pick up stray unicode (arrows, NBSP, smart quotes, zero-width chars, etc.).
function sanitize(token: string): string {
  return token.replace(/[^\x20-\x7e]/g, '').trim()
}

export const auth = {
  get(): string | null {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const clean = sanitize(raw)
    return clean || null
  },
  set(token: string): void {
    localStorage.setItem(KEY, sanitize(token))
  },
  clear(): void {
    localStorage.removeItem(KEY)
  }
}
