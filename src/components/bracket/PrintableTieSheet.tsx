import type { Tournament } from '@/types'
import type { TournamentData } from '@/hooks/useTournamentData'
import { formatScoreline } from '@/engine/scoring'
import { formatDateLong, formatTime } from '@/lib/date'
import { getFormat } from '@/config/formats'

/**
 * Print layout for the tie sheet.
 *
 * A React Flow canvas cannot paginate, so printing gets a proper document: one
 * block per round with every match written out, on A4 or A3, with a signature
 * line. Hidden on screen, shown only by the print stylesheet.
 */
export function PrintableTieSheet({
  tournament,
  data,
}: {
  tournament: Tournament
  data: TournamentData
}) {
  const { rounds, matches, participantMap, sport, venues } = data
  const format = getFormat(tournament.formatType)

  const bracketRounds = rounds.filter(
    (r) =>
      r.kind === 'winners' || r.kind === 'losers' || r.kind === 'grand_final' || r.kind === 'third_place',
  )

  const name = (id: string | null) => (id ? (participantMap.get(id)?.name ?? 'Unknown') : 'TBD')
  const venueName = (id: string | null) => (id ? (venues.find((v) => v.id === id)?.name ?? '') : '')

  return (
    <div className="print-only text-black">
      <header className="mb-4 border-b-2 border-black pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <p className="mt-0.5 text-sm">
              {sport.name} · {format.name}
              {tournament.venue && ` · ${tournament.venue}`}
            </p>
            {tournament.organizer && (
              <p className="text-xs">Organized by {tournament.organizer}</p>
            )}
          </div>
          <div className="text-right text-xs">
            {tournament.startDate && (
              <p>
                {formatDateLong(tournament.startDate)}
                {tournament.endDate &&
                  tournament.endDate !== tournament.startDate &&
                  ` – ${formatDateLong(tournament.endDate)}`}
              </p>
            )}
            {tournament.location && <p>{tournament.location}</p>}
            {tournament.contactPhone && <p>{tournament.contactPhone}</p>}
          </div>
        </div>
        <p className="mt-2 text-lg font-semibold">Official Tie Sheet</p>
      </header>

      {bracketRounds.map((round) => {
        const roundMatches = matches
          .filter((m) => m.roundId === round.id)
          .sort((a, b) => a.position - b.position)
        if (roundMatches.length === 0) return null

        return (
          <section key={round.id} className="print-avoid-break mb-5">
            <h2 className="mb-1.5 border-b border-black pb-1 text-sm font-bold uppercase tracking-wide">
              {round.name}
            </h2>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/40">
                  <th className="w-8 py-1 text-left font-semibold">#</th>
                  <th className="py-1 text-left font-semibold">Home</th>
                  <th className="w-20 py-1 text-center font-semibold">Score</th>
                  <th className="py-1 text-left font-semibold">Away</th>
                  <th className="w-28 py-1 text-left font-semibold">Date / Time</th>
                  <th className="w-28 py-1 text-left font-semibold">Venue</th>
                  <th className="w-24 py-1 text-left font-semibold">Winner</th>
                </tr>
              </thead>
              <tbody>
                {roundMatches.map((match) => {
                  const winner =
                    match.outcome === 'home' || match.walkoverWinner === 'home'
                      ? name(match.homeId)
                      : match.outcome === 'away' || match.walkoverWinner === 'away'
                        ? name(match.awayId)
                        : ''
                  return (
                    <tr key={match.id} className="border-b border-black/15">
                      <td className="py-1 tnum">{match.number}</td>
                      <td className="py-1 font-medium">{name(match.homeId)}</td>
                      <td className="py-1 text-center tnum">
                        {match.score ? formatScoreline(match.score, sport) : '___ – ___'}
                      </td>
                      <td className="py-1 font-medium">{name(match.awayId)}</td>
                      <td className="py-1">
                        {match.date
                          ? `${formatDateLong(match.date)}${match.time ? ` ${formatTime(match.time)}` : ''}`
                          : '—'}
                      </td>
                      <td className="py-1">{venueName(match.venueId) || '—'}</td>
                      <td className="py-1 font-semibold">{winner || '__________'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}

      <footer className="mt-8 flex items-end justify-between border-t border-black pt-3 text-xs">
        <div>
          <div className="mb-1 h-8 w-48 border-b border-black" />
          <p>Organizer signature</p>
        </div>
        <div>
          <div className="mb-1 h-8 w-48 border-b border-black" />
          <p>Date</p>
        </div>
      </footer>
    </div>
  )
}
