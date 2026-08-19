import { createHashRouter, RouterProvider } from 'react-router-dom'
import { AppShell, PublicShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { LandingPage } from '@/pages/LandingPage'
import { TournamentsListPage } from '@/pages/TournamentsListPage'
import { CreateTournamentPage } from '@/pages/CreateTournamentPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { DrawPage } from '@/pages/DrawPage'
import { FixturesPage } from '@/pages/FixturesPage'
import { BracketPage } from '@/pages/BracketPage'
import { StandingsPage } from '@/pages/StandingsPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { SharePage } from '@/pages/SharePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PublicTournamentPage } from '@/pages/PublicTournamentPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/**
 * Hash routing on purpose.
 *
 * Everything lives in the browser, so the app has to work when opened from a
 * static host or even a local file — and shared public links must survive a
 * hard refresh without any server rewrite rules.
 */
const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/dashboard', element: <TournamentsListPage /> },
      { path: '/new', element: <CreateTournamentPage /> },
      { path: '/t/:tournamentId', element: <DashboardPage /> },
      { path: '/t/:tournamentId/teams', element: <TeamsPage /> },
      { path: '/t/:tournamentId/draw', element: <DrawPage /> },
      { path: '/t/:tournamentId/fixtures', element: <FixturesPage /> },
      { path: '/t/:tournamentId/bracket', element: <BracketPage /> },
      { path: '/t/:tournamentId/standings', element: <StandingsPage /> },
      { path: '/t/:tournamentId/schedule', element: <SchedulePage /> },
      { path: '/t/:tournamentId/share', element: <SharePage /> },
      { path: '/t/:tournamentId/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <PublicShell />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/p/:slug', element: <PublicTournamentPage /> }
    ],
  },
])

export function App() {
  return (
    <ErrorBoundary label="The application">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  )
}
