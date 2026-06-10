import { useFlash } from '../hooks/useFlash'
import { useState } from 'react'

/**
 * Copies the text returned by getText() to the clipboard with a brief "Copied"
 * confirmation. getText is lazy so the payload is built only on click.
 */
export function CopyButton({ getText, label = 'Copy for agent', className = 'hs-modal-btn' }: {
  getText: () => string
  label?: string
  className?: string
}) {
  const [flash, trigger] = useFlash(1600)
  const [failed, setFailed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText())
      setFailed(false)
    } catch {
      setFailed(true)
    }
    trigger()
  }

  return (
    <button className={className} onClick={copy} type="button">
      {flash ? (failed ? 'Copy failed' : '✓ Copied') : `⧉ ${label}`}
    </button>
  )
}
