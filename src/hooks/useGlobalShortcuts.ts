import { useEffect, useRef } from 'react'

export type ShortcutHandlers = {
  onQuickSwitcher: () => void
  onHelp: () => void
  onGoHome: () => void
  onGoRepos: () => void
  onGoPRs: () => void
  onGoConfig: () => void
  onFocusSearch: () => void
  onEscape?: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

// Two-key "g h", "g r"... sequences time out after this window (ms).
const G_LEADER_TIMEOUT = 900

export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let gLeaderAt = 0

    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current

      // Cmd+K / Ctrl+K — quick switcher (works even from inputs)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        h.onQuickSwitcher()
        return
      }

      // Escape always passes through
      if (e.key === 'Escape') {
        h.onEscape?.()
        return
      }

      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // "?" → help (shift+/ on US layouts, but `e.key === '?'` is portable)
      if (e.key === '?') {
        e.preventDefault()
        h.onHelp()
        return
      }

      // "/" → focus search
      if (e.key === '/') {
        e.preventDefault()
        h.onFocusSearch()
        return
      }

      // "g" leader, then "h"/"r"/"p"/"c"
      if (e.key === 'g') {
        gLeaderAt = Date.now()
        return
      }
      if (gLeaderAt && Date.now() - gLeaderAt < G_LEADER_TIMEOUT) {
        gLeaderAt = 0
        if (e.key === 'h') { e.preventDefault(); h.onGoHome(); return }
        if (e.key === 'r') { e.preventDefault(); h.onGoRepos(); return }
        if (e.key === 'p') { e.preventDefault(); h.onGoPRs(); return }
        if (e.key === 'c') { e.preventDefault(); h.onGoConfig(); return }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
