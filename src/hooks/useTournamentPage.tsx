import { useParams } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useTournament } from '@/stores/useTournamentStore'
import { useTournamentData, type TournamentData } from '@/hooks/useTournamentData'
import type { Tournament } from '@/types'

/** Props every tournament view receives, with both values guaranteed. */
export interface TournamentViewProps {
  tournament: Tournament
  data: TournamentData
}

/**
 * Resolves the tournament named in the route.
 *
 * Pages use this in a thin wrapper and hand the result to a view component —
 * that way the "not found" early return never sits above another hook call,
 * which would break hook ordering.
 */
export function useTournamentPage():
  | { ready: true; tournament: Tournament; data: TournamentData }
  | { ready: false; fallback: React.ReactElement } {
  const { tournamentId } = useParams()
  const tournament = useTournament(tournamentId)

  // Hooks must run unconditionally, so gather data against a safe placeholder
  // when the id does not resolve.
  const data = useTournamentData(tournament ?? PLACEHOLDER)

  if (!tournament) {
    return {
      ready: false,
      fallback: (
        <EmptyState
          icon={<Trophy />}
          title="Tournament not found"
          description="It may have been deleted, or the link is out of date."
          className="mt-8"
          action={{ label: 'Back to tournaments', onClick: () => window.location.assign('#/') }}
        />
      ),
    }
  }

  return { ready: true, tournament, data }
}

/** A minimal tournament used only to keep hook order stable; never rendered. */
const PLACEHOLDER: Tournament = {
  id: '',
  slug: '',
  name: '',
  description: '',
  sportId: 'football',
  participantType: 'team',
  logoUrl: null,
  organizer: '',
  venue: '',
  location: '',
  startDate: null,
  endDate: null,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  formatType: 'single_elimination',
  config: {
    thirdPlaceMatch: false,
    seedProtectionRounds: 0,
    grandFinalReset: false,
    doubleRoundRobin: false,
    groupCount: 0,
    advancePerGroup: 0,
    groupDoubleRoundRobin: false,
    bestOf: 1,
    pointsWin: null,
    pointsDraw: null,
    pointsLoss: null,
    drawMethod: 'seeded',
  },
  status: 'setup',
  fixturesGenerated: false,
  publicVisible: false,
  createdAt: '',
  updatedAt: '',
}

/** Shown when a view needs fixtures that have not been generated yet. */
export function NeedsFixtures({
  tournamentId,
  hasEntrants,
  label,
}: {
  tournamentId: string
  hasEntrants: boolean
  label: string
}) {
  return (
    <EmptyState
      icon={<Trophy />}
      title="No fixtures yet"
      description={
        hasEntrants
          ? 'Generate the draw and this view fills in automatically.'
          : `Add ${label.toLowerCase()} first, then generate the draw.`
      }
      className="mt-4"
      action={
        hasEntrants
          ? {
              label: 'Go to Draw & Seeding',
              onClick: () => window.location.assign(`#/t/${tournamentId}/draw`),
            }
          : {
              label: `Add ${label}`,
              onClick: () => window.location.assign(`#/t/${tournamentId}/teams`),
            }
      }
    />
  )
}
