/**
 * UI store — theme, navigation chrome and transient panel state.
 *
 * Deliberately separate from the data stores: this is the only store whose
 * contents are purely presentational, and it is the only one safe to reset.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  commandOpen: boolean
  /** Match currently open in the result drawer. */
  activeMatchId: string | null
  /** Whether the seed data has been offered/loaded once. */
  seedLoaded: boolean

  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCommandOpen: (open: boolean) => void
  openMatch: (id: string | null) => void
  markSeedLoaded: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      commandOpen: false,
      activeMatchId: null,
      seedLoaded: false,

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      openMatch: (activeMatchId) => set({ activeMatchId }),
      markSeedLoaded: () => set({ seedLoaded: true }),
    }),
    {
      name: 'tiesheet.ui.v1',
      // Transient bits should not survive a reload.
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        seedLoaded: s.seedLoaded,
      }),
    },
  ),
)

/** Apply the stored theme to <html>, following the OS when set to 'system'. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}
