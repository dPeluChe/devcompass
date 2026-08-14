/** Minimal markdown→HTML for inline previews (composer, tooltips).
 *  Covers the common cases: bold, italic, inline code, links, lists,
 *  headers, blockquote. Output must go through SanitizedMarkdown before
 *  rendering — this does NOT sanitize on its own. */
export function miniMarkdown(src: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = esc(src).split('\n')
  const out: string[] = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue }
    if (line.startsWith('&gt; ')) { closeList(); out.push(`<blockquote>${inline(line.slice(5))}</blockquote>`); continue }
    const li = line.match(/^[-*]\s+(.*)$/)
    if (li) { if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(li[1])}</li>`); continue }
    closeList()
    out.push(line.trim() ? `<p>${inline(line)}</p>` : '<br/>')
  }
  closeList()
  return out.join('\n')
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>')
}
