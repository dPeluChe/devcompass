import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiPrefsState {
  fancyBg: boolean
  toggleFancyBg: () => void
}

export const uiPrefsStore = create<UiPrefsState>()(
  persist(
    (set, get) => ({
      fancyBg: true,
      toggleFancyBg: () => set({ fancyBg: !get().fancyBg }),
    }),
    { name: 'ghviewer-ui-prefs' }
  )
)
