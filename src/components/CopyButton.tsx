import { useEffect, useRef, useState } from 'react'

/**
 * Copies the text returned by getText() to the clipboard with a brief "Copied"
 * confirmation. getText is lazy so the payload is built only on click.
 */
export function CopyButton({ getText, label = 'Copy for agent', className = 'hs-modal-btn' }: {
  getText: () => string
  label?: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText())
      setState('ok')
    } catch {
      setState('err')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button className={className} onClick={copy} type="button">
      {state === 'ok' ? '✓ Copied' : state === 'err' ? 'Copy failed' : `⧉ ${label}`}
    </button>
  )
}
