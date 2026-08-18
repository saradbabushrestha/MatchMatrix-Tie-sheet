import { useEffect } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/controls'
import { Header, useThemeEffect } from './Header'
import { Sidebar } from './Sidebar'
import { CommandMenu } from './CommandMenu'
import { ErrorBoundary } from './ErrorBoundary'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useUIStore } from '@/stores/useUIStore'

/**
 * The application shell: header, sidebar and routed content.
 *
 * Also the single place the theme is applied and the active tournament is
 * tracked, so every route inherits both without repeating itself.
 */
export function AppShell() {
  useThemeEffect()
  const { tournamentId } = useParams()
  const setActive = useTournamentStore((s) => s.setActive)
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    if (tournamentId) setActive(tournamentId)
  }, [tournamentId, setActive])

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <ErrorBoundary label="This page">
              <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">
                <Outlet />
              </div>
            </ErrorBoundary>
          </main>
        </div>
        <CommandMenu />
        <Toaster
          position="bottom-right"
          theme={theme === 'system' ? 'system' : theme}
          richColors
          closeButton
        />
      </div>
    </TooltipProvider>
  )
}

/** Chrome-free shell for the public tournament page. */
export function PublicShell() {
  useThemeEffect()
  const theme = useUIStore((s) => s.theme)

  return (
    <TooltipProvider delayDuration={350}>
      <div className="min-h-screen bg-background">
        <ErrorBoundary label="This tournament page">
          <Outlet />
        </ErrorBoundary>
        <Toaster position="bottom-center" theme={theme === 'system' ? 'system' : theme} richColors />
      </div>
    </TooltipProvider>
  )
}
