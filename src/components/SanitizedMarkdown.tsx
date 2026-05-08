import DOMPurify from 'dompurify'
import { Fragment, createElement, useMemo, type ReactNode } from 'react'

type Props = {
  html: string
}

const allowedProtocol = /^(https?:|mailto:|tel:|#|\/)/i
const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
// HTML disallows whitespace text nodes as direct children of these elements.
// React hydration trips on it; the DOM parser inserts spaces from indented
// markdown tables. We strip whitespace-only text children here.
const noTextChildren = new Set([
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'colgroup',
  'select',
])
const booleanAttributes = new Set(['checked', 'disabled', 'selected', 'readonly', 'multiple'])

export function SanitizedMarkdown({ html }: Props) {
  const content = useMemo(() => renderSafeHtml(html), [html])
  return <div className="markdown">{content}</div>
}

function renderSafeHtml(html: string): ReactNode {
  if (typeof window === 'undefined') return null

  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })
  const doc = new DOMParser().parseFromString(clean, 'text/html')

  return Array.from(doc.body.childNodes).map((node, index) => nodeToReact(node, index))
}

function nodeToReact(node: ChildNode, key: number | string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const props: Record<string, unknown> = { key }

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    const value = attr.value

    if (name.startsWith('on')) continue
    if ((name === 'href' || name === 'src') && !allowedProtocol.test(value)) continue
    if (name === 'class') props.className = value
    else if (name === 'for') props.htmlFor = value
    else if (name === 'readonly') props.readOnly = true
    else if (booleanAttributes.has(name)) props[name] = true
    else if (name === 'style') continue
    else props[name] = value
  }

  if (tag === 'a') {
    props.target = '_blank'
    props.rel = 'noreferrer'
  }

  if (tag === 'input' && props.checked !== undefined) props.readOnly = true
  if (voidElements.has(tag)) return createElement(tag, props)

  let children = Array.from(el.childNodes).map((child, index) => nodeToReact(child, index))
  if (noTextChildren.has(tag)) {
    children = children.filter((c) => !(typeof c === 'string' && /^\s*$/.test(c)))
  }
  return createElement(tag || Fragment, props, children)
}
