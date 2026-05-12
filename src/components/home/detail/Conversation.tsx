import type { PRDetail, Review } from '../../../api/github'
import { SanitizedMarkdown } from '../../SanitizedMarkdown'
import { relativeTime, reviewStateClass, reviewStateLabel } from './utils'

export type ConvItem = {
  kind: 'review' | 'comment'
  state?: Review['state']
  author: { login: string; avatarUrl: string } | null
  bodyHTML: string
  time: string
}

export function buildConversation(detail: PRDetail | undefined): ConvItem[] {
  if (!detail) return []
  const out: ConvItem[] = []
  for (const r of detail.reviews.nodes) {
    if (r.state === 'PENDING' || (!r.bodyHTML && r.state === 'COMMENTED')) continue
    out.push({
      kind: 'review',
      state: r.state,
      author: r.author,
      bodyHTML: r.bodyHTML,
      time: r.submittedAt ?? ''
    })
  }
  for (const c of detail.comments.nodes) {
    out.push({ kind: 'comment', author: c.author, bodyHTML: c.bodyHTML, time: c.createdAt })
  }
  return out.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
}

export function ConversationList({ items }: { items: ConvItem[] }) {
  return (
    <div className="hs-conv-list">
      {items.map((item) => (
        <article className="hs-conv-item" key={`${item.kind}:${item.time}:${item.author?.login ?? '?'}`}>
          {item.author?.avatarUrl ? (
            <img className="hs-conv-avatar" src={item.author.avatarUrl} alt="" />
          ) : (
            <span className="hs-conv-avatar hs-conv-avatar-fallback">·</span>
          )}
          <div className="hs-conv-main">
            <div className="hs-conv-head">
              <strong>@{item.author?.login ?? 'ghost'}</strong>
              {item.kind === 'review' && item.state && (
                <span className={`hs-conv-state ${reviewStateClass(item.state)}`}>{reviewStateLabel(item.state)}</span>
              )}
              {item.kind === 'comment' && <span className="hs-conv-state">commented</span>}
              <span className="hs-conv-time">{relativeTime(item.time)}</span>
            </div>
            {item.bodyHTML ? (
              <div className="hs-description-html"><SanitizedMarkdown html={item.bodyHTML} /></div>
            ) : (
              <span className="hs-muted-text">— no body —</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
