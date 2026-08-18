import { useMemo, useState } from 'react'
import { Download, Filter, ListOrdered, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/controls'
import { PageHeader } from '@/components/shared/StatCard'
import { MatchPanel, MatchRow } from '@/components/matches/MatchPanel'
import { useTournamentPage, NeedsFixtures, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useMatchesByRound, useStandings } from '@/hooks/useTournamentData'
import { exportCSV } from '@/services/exportService'
import { entrantLabel } from '@/engine/validation'
import type { Match, MatchStatus } from '@/types'

type StatusFilter = 'all' | 'todo' | 'done' | 'live'

/** Fixtures grouped by round, with result entry. */
export function FixturesPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <FixturesView tournament={page.tournament} data={page.data} />
}

function FixturesView({ tournament, data }: TournamentViewProps) {
  const [openMatch, setOpenMatch] = useState<Match | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roundFilter, setRoundFilter] = useState<string>('all')

  const byRound = useMatchesByRound(data)
  const standings = useStandings(data)
  const { sport, matches, participantMap, rounds } = data

  const playable = matches.filter((m) => !m.isBye && m.status !== 'cancelled')
  const completed = playable.filter(
    (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
  )

  const q = query.trim().toLowerCase()

  const matchesFilter = useMemo(() => {
    const inStatus = (status: MatchStatus) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'live') return status === 'live'
      if (statusFilter === 'done')
        return status === 'completed' || status === 'walkover' || status === 'no_result'
      return status === 'pending' || status === 'scheduled'
    }

    const inQuery = (match: Match) => {
      if (!q) return true
      const home = match.homeId ? participantMap.get(match.homeId)?.name ?? '' : ''
      const away = match.awayId ? participantMap.get(match.awayId)?.name ?? '' : ''
      return (
        home.toLowerCase().includes(q) ||
        away.toLowerCase().includes(q) ||
        String(match.number) === q
      )
    }

    return (match: Match) => inStatus(match.status) && inQuery(match)
  }, [statusFilter, q, participantMap])

  const visibleRounds = byRound
    .filter((group) => roundFilter === 'all' || group.round.id === roundFilter)
    .map((group) => ({ ...group, matches: group.matches.filter(matchesFilter) }))
    .filter((group) => group.matches.length > 0)

  const visibleCount = visibleRounds.reduce((sum, g) => sum + g.matches.length, 0)

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fixtures & Results" />
        <NeedsFixtures
          tournamentId={tournament.id}
          hasEntrants={data.participants.length > 0}
          label={entrantLabel(sport)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixtures & Results"
        description={`${completed.length} of ${playable.length} matches played`}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              try {
                exportCSV({ ...data, standings }, 'fixtures')
                toast.success('Fixtures exported')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Export failed')
              }
            }}
          >
            <Download />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />

      <Card className="p-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tournament progress</span>
            <span className="font-semibold tnum">
              {playable.length > 0 ? Math.round((completed.length / playable.length) * 100) : 0}%
            </span>
          </div>
          <Progress
            value={playable.length > 0 ? (completed.length / playable.length) * 100 : 0}
          />
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or match number…"
            className="pl-9"
            aria-label="Search fixtures"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="sm:w-[150px]">
            <Filter className="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All matches</SelectItem>
            <SelectItem value="todo">Still to play</SelectItem>
            <SelectItem value="done">Played</SelectItem>
            <SelectItem value="live">Live</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roundFilter} onValueChange={setRoundFilter}>
          <SelectTrigger className="sm:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rounds</SelectItem>
            {rounds.map((round) => (
              <SelectItem key={round.id} value={round.id}>
                {round.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visibleCount === 0 ? (
        <EmptyState
          compact
          icon={<Search />}
          title="No matches match those filters"
          action={{
            label: 'Clear filters',
            onClick: () => {
              setQuery('')
              setStatusFilter('all')
              setRoundFilter('all')
            },
          }}
        />
      ) : (
        <div className="space-y-5">
          {visibleRounds.map(({ round, matches: roundMatches }) => {
            const done = roundMatches.filter(
              (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
            ).length

            return (
              <section key={round.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{round.name}</h2>
                  <Badge variant="muted">
                    {done}/{roundMatches.length} played
                  </Badge>
                  {round.kind === 'losers' && <Badge variant="warning">Losers bracket</Badge>}
                  {round.kind === 'third_place' && <Badge variant="secondary">Play-off</Badge>}
                  {round.kind === 'grand_final' && <Badge variant="default">Decider</Badge>}
                </div>

                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {roundMatches.map((match) => (
                    <MatchRow key={match.id} match={match} data={data} onOpen={setOpenMatch} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <MatchPanel
        match={openMatch}
        data={data}
        open={openMatch !== null}
        onOpenChange={(open) => !open && setOpenMatch(null)}
      />

      <p className="text-center text-xs text-muted-foreground">
        <ListOrdered className="mr-1 inline size-3" />
        Tap any match to enter a result, set the date or assign an official.
      </p>
    </div>
  )
}
