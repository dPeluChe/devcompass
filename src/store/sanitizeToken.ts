// HTTP headers only allow ASCII (ByteString). Strip anything outside printable
// ASCII to avoid the "character has value > 255" fetch error when copy-pasting
// tokens that pick up stray unicode (arrows, NBSP, smart quotes, zero-width
// chars, etc.). Shared by every BYO-token store (GitHub PAT, Sentry, …).
export function sanitizeToken(token: string): string {
  return token.replace(/[^\x20-\x7e]/g, '').trim()
}
