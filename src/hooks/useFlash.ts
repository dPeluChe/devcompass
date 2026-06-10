import { useEffect, useRef, useState } from 'react'

/**
 * Transient boolean that auto-resets after `ms` — for "✓ Copied"-style
 * confirmations. The timer is cleared on re-trigger and on unmount, so rapid
 * clicks don't stack timers and unmounted components don't set state.
 */
export function useFlash(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function trigger() {
    setOn(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOn(false), ms)
  }
  return [on, trigger]
}
