import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Crown,
  Link2,
  MapPin,
  Phone,
  Trophy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, ScrollTabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/controls'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from '@/components/ui/table'
import { ParticipantAvatar, ParticipantChip } from '@/components/shared/ParticipantChip'
import { MatchStatusBadge } from '@/components/shared/StatusBadge'
import { ScoreDisplay } from '@/components/shared/ScoreDisplay'
import { StandingsCards, StandingsTable } from '@/components/standings/StandingsTable'
import { BracketCanvas } from '@/components/bracket/BracketCanvas'
import { hasBracketRounds } from '@/components/bracket/layout'
import { ThemeToggle, useThemeEffect } from '@/components/layout/Header'
import { useTournamentBySlug } from '@/stores/useTournamentStore'
import { useTournamentData, useStandings, useTournamentStats } from '@/hooks/useTournamentData'
import { getFormat } from '@/config/formats'
import { entrantLabel } from '@/engine/validation'
import { formatDateLong, formatTime, friendlyDay } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { Tournament } from '@/types'

/** The shareable, read-only tournament page. */
export function PublicTournamentPage() {
  useThemeEffect()
  const { slug } = useParams()
  const tournament = useTournamentBySlug(slug)

  if (!tournament) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <EmptyState
          icon={<Trophy />}
          title="Tournament not found"
          description="This link may be out of date, or the tournament was created in a different browser."
        />
      </div>
    )
  }

  if (!tournament.publicVisible) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <EmptyState
          icon={<Trophy />}
          title="This tournament is private"
          description="The organizer has not published it yet. Check back later, or ask them for access."
        />
      </div>
    )
  }

  return <PublicView tournament={tournament} />
}

function PublicView({ tournament }: { tournament: Tournament }) {
  const data = useTournamentData(tournament)
  const standings = useStandings(data)
  const stats = useTournamentStats(data)
  const [copied, setCopied] = useState(false)

  const { sport, participants, teams, players, matches, rounds, venues } = data
  const format = getFormat(tournament.formatType)
  const label = entrantLabel(sport)

  const playable = matches.filter((m) => !m.isBye && m.status !== 'cancelled')
  const results = playable
    .filter((m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result')
    .slice()
    .reverse()
  const fixtures = playable.filter((m) => m.status === 'pending' || m.status === 'scheduled' || m.status === 'live')

  const nextHome = stats.nextMatch?.homeId ? data.participantMap.get(stats.nextMatch.homeId) : null
  const nextAway = stats.nextMatch?.awayId ? data.participantMap.get(stats.nextMatch.awayId) : null
  const nextVenue = venues.find((v) => v.id === stats.nextMatch?.venueId)

  const byRound = useMemo(
    () =>
      rounds
        .map((round) => ({
          round,
          matches: matches
            .filter((m) => m.roundId === round.id && !m.isBye)
            .sort((a, b) => a.position - b.position),
        }))
        .filter((g) => g.matches.length > 0),
    [rounds, matches],
  )

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: tournament.name, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      toast.success('Link copied')
    } catch {
      // The user dismissed the share sheet — nothing to report.
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              {tournament.logoUrl ? (
                <img
                  src={tournament.logoUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-xl object-cover sm:size-16"
                />
              ) : (
                <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-3xl sm:size-16">
                  {sport.icon}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-3xl">
                  {tournament.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sport.name} · {format.name}
                </p>
                {tournament.organizer && (
                  <p className="text-xs text-muted-foreground">
                    Organized by {tournament.organizer}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <Button variant="outline" size="icon" onClick={share} aria-label="Share this page">
                <Link2 />
              </Button>
            </div>
          </div>

          {tournament.description && (
            <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{tournament.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {tournament.startDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {formatDateLong(tournament.startDate)}
                {tournament.endDate &&
                  tournament.endDate !== tournament.startDate &&
                  ` – ${formatDateLong(tournament.endDate)}`}
              </span>
            )}
            {tournament.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {tournament.venue}
                {tournament.location && `, ${tournament.location}`}
              </span>
            )}
            {tournament.contactPhone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {tournament.contactPhone}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {participants.length} {label.toLowerCase()}
            </span>
          </div>

          {playable.length > 0 && (
            <div className="mt-5 max-w-md space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {stats.completed} of {playable.length} matches played
                </span>
                <span className="font-semibold tnum">{Math.round(stats.progress * 100)}%</span>
              </div>
              <Progress value={stats.progress * 100} className="h-1.5" />
            </div>
          )}
        </div>
      </header>

      {/* Champion / next match banner */}
      {stats.podium.champion ? (
        <div className="border-b border-warning/30 bg-warning/8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
            <Trophy className="size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Champion
              </p>
              <p className="text-lg font-bold">
                {data.participantMap.get(stats.podium.champion)?.name}
              </p>
            </div>
            {stats.podium.runnerUp && (
              <div className="min-w-0 border-l border-warning/30 pl-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Runner-up
                </p>
                <p className="font-medium">
                  {data.participantMap.get(stats.podium.runnerUp)?.name}
                </p>
              </div>
            )}
            {stats.podium.third && (
              <div className="min-w-0 border-l border-warning/30 pl-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Third
                </p>
                <p className="font-medium">{data.participantMap.get(stats.podium.third)?.name}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        stats.nextMatch && (
          <div className="border-b border-border bg-primary/5">
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Next match
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <ParticipantChip participant={nextHome} bold placeholder="TBD" />
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">vs</span>
                  <ParticipantChip participant={nextAway} bold placeholder="TBD" />
                </div>
                <div className="shrink-0 text-sm">
                  {stats.nextMatch.date ? (
                    <span className="font-semibold">
                      {friendlyDay(stats.nextMatch.date)}
                      {stats.nextMatch.time && ` · ${formatTime(stats.nextMatch.time)}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not scheduled</span>
                  )}
                  {nextVenue && (
                    <span className="block text-xs text-muted-foreground">{nextVenue.name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Tabs defaultValue="overview">
          <ScrollTabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {format.hasBracket && hasBracketRounds(rounds) && (
              <TabsTrigger value="bracket">Tie Sheet</TabsTrigger>
            )}
            <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            {standings.length > 0 && <TabsTrigger value="standings">Standings</TabsTrigger>}
            <TabsTrigger value="teams">{label}</TabsTrigger>
            {players.length > 0 && sport.participantType === 'team' && (
              <TabsTrigger value="players">Players</TabsTrigger>
            )}
          </ScrollTabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PublicStat label={label} value={participants.length} />
              <PublicStat label="Matches" value={playable.length} />
              <PublicStat label="Played" value={stats.completed} />
              <PublicStat
                label="Stage"
                value={stats.currentRound?.shortName ?? '—'}
                text={stats.currentRound?.name}
              />
            </div>

            {results.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Latest results
                </h2>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {results.slice(0, 6).map((match) => (
                    <PublicMatchRow key={match.id} match={match} data={data} />
                  ))}
                </div>
              </section>
            )}

            {fixtures.filter((m) => m.date).length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Coming up
                </h2>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {fixtures
                    .filter((m) => m.date)
                    .slice(0, 6)
                    .map((match) => (
                      <PublicMatchRow key={match.id} match={match} data={data} />
                    ))}
                </div>
              </section>
            )}

            {standings.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {standings.length > 1 ? 'Group standings' : 'Standings'}
                </h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {standings.map((table) => (
                    <div key={table.groupId ?? 'league'}>
                      <div className="hidden sm:block">
                        <StandingsTable table={table} sport={sport} showForm={false} />
                      </div>
                      <div className="sm:hidden">
                        <StandingsCards table={table} sport={sport} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>

          {/* Bracket */}
          {format.hasBracket && hasBracketRounds(rounds) && (
            <TabsContent value="bracket">
              <div className="h-[calc(100vh-320px)] min-h-[420px] overflow-hidden rounded-lg border border-border">
                <BracketCanvas
                  data={data}
                  onOpenMatch={() => {
                    /* Read-only: the public page does not edit results. */
                  }}
                  readOnly
                  showMiniMap={false}
                />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Drag to pan, pinch or scroll to zoom.
              </p>
            </TabsContent>
          )}

          {/* Fixtures */}
          <TabsContent value="fixtures">
            {fixtures.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarDays />}
                title="No fixtures left"
                description="Every match has been played."
              />
            ) : (
              <div className="space-y-5">
                {byRound
                  .map((g) => ({
                    ...g,
                    matches: g.matches.filter((m) => fixtures.some((f) => f.id === m.id)),
                  }))
                  .filter((g) => g.matches.length > 0)
                  .map(({ round, matches: roundMatches }) => (
                    <section key={round.id} className="space-y-2">
                      <h2 className="text-sm font-semibold">{round.name}</h2>
                      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                        {roundMatches.map((match) => (
                          <PublicMatchRow key={match.id} match={match} data={data} />
                        ))}
                      </div>
                    </section>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* Results */}
          <TabsContent value="results">
            {results.length === 0 ? (
              <EmptyState
                compact
                icon={<Clock />}
                title="No results yet"
                description="Results appear here as matches are played."
              />
            ) : (
              <div className="space-y-5">
                {byRound
                  .map((g) => ({
                    ...g,
                    matches: g.matches.filter((m) => results.some((r) => r.id === m.id)),
                  }))
                  .filter((g) => g.matches.length > 0)
                  .map(({ round, matches: roundMatches }) => (
                    <section key={round.id} className="space-y-2">
                      <h2 className="text-sm font-semibold">{round.name}</h2>
                      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                        {roundMatches.map((match) => (
                          <PublicMatchRow key={match.id} match={match} data={data} />
                        ))}
                      </div>
                    </section>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* Standings */}
          {standings.length > 0 && (
            <TabsContent value="standings" className="space-y-4">
              {standings.map((table) => (
                <div key={table.groupId ?? 'league'}>
                  <div className="hidden sm:block">
                    <StandingsTable table={table} sport={sport} />
                  </div>
                  <div className="sm:hidden">
                    <StandingsCards table={table} sport={sport} />
                  </div>
                </div>
              ))}
            </TabsContent>
          )}

          {/* Teams / entrants */}
          <TabsContent value="teams">
            {participants.length === 0 ? (
              <EmptyState compact icon={<Users />} title={`No ${label.toLowerCase()} yet`} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {participants.map((participant) => {
                  const squad = players.filter((p) => p.teamId === participant.id)
                  const captain = squad.find((p) => p.isCaptain)
                  return (
                    <Card key={participant.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <ParticipantAvatar participant={participant} size="lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold leading-tight">{participant.name}</p>
                          {captain && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <Crown className="size-3 shrink-0 text-warning" />
                              {captain.name}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {participant.seed != null && (
                              <Badge variant="secondary">Seed {participant.seed}</Badge>
                            )}
                            {squad.length > 0 && (
                              <Badge variant="muted">{squad.length} players</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {squad.length > 0 && (
                        <ul className="mt-3 space-y-1 border-t border-border pt-3">
                          {squad
                            .slice()
                            .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999))
                            .map((player) => (
                              <li
                                key={player.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="w-5 shrink-0 text-right font-semibold text-muted-foreground tnum">
                                  {player.jerseyNumber ?? '–'}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{player.name}</span>
                                {player.position && (
                                  <span className="shrink-0 text-muted-foreground">
                                    {player.position}
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* All players */}
          {players.length > 0 && sport.participantType === 'team' && (
            <TabsContent value="players">
              <div className="overflow-hidden rounded-lg border border-border">
                <TableScroller>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No.</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="w-24">Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players
                        .filter((p) => p.teamId)
                        .sort((a, b) => {
                          const ta = teams.find((t) => t.id === a.teamId)?.name ?? ''
                          const tb = teams.find((t) => t.id === b.teamId)?.name ?? ''
                          return (
                            ta.localeCompare(tb) ||
                            (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)
                          )
                        })
                        .map((player) => (
                          <TableRow key={player.id}>
                            <TableCell className="text-muted-foreground tnum">
                              {player.jerseyNumber ?? '—'}
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1.5">
                                {player.name}
                                {player.isCaptain && <Crown className="size-3 text-warning" />}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {teams.find((t) => t.id === player.teamId)?.name ?? '—'}
                            </TableCell>
                            <TableCell>
                              {player.position ? (
                                <Badge variant="muted">{player.position}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableScroller>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="mt-8 border-t border-border py-6">
        <div className="mx-auto max-w-6xl space-y-1 px-4 text-center text-xs text-muted-foreground sm:px-6">
          {tournament.contactName && (
            <p>
              Contact {tournament.contactName}
              {tournament.contactPhone && ` · ${tournament.contactPhone}`}
              {tournament.contactEmail && ` · ${tournament.contactEmail}`}
            </p>
          )}
          <p>
            {copied ? 'Link copied to your clipboard' : 'Tie sheet built with TieSheet'}
          </p>
        </div>
      </footer>
    </div>
  )
}

function PublicStat({
  label,
  value,
  text,
}: {
  label: string
  value: string | number
  text?: string
}) {
  return (
    <Card className="p-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tnum leading-none">{value}</p>
      {text && <p className="mt-0.5 truncate text-xs text-muted-foreground">{text}</p>}
    </Card>
  )
}

function PublicMatchRow({
  match,
  data,
}: {
  match: Parameters<typeof ScoreDisplay>[0]['match']
  data: ReturnType<typeof useTournamentData>
}) {
  const home = match.homeId ? data.participantMap.get(match.homeId) : null
  const away = match.awayId ? data.participantMap.get(match.awayId) : null
  const venue = data.venues.find((v) => v.id === match.venueId)

  const homeWon = match.outcome === 'home' || match.walkoverWinner === 'home'
  const awayWon = match.outcome === 'away' || match.walkoverWinner === 'away'

  return (
    <div className="flex items-center gap-3 p-3">
      <span className="w-7 shrink-0 text-xs font-semibold text-muted-foreground tnum">
        #{match.number}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <ParticipantChip
          participant={home}
          size="sm"
          bold={homeWon}
          muted={awayWon}
          placeholder="TBD"
        />
        <ParticipantChip
          participant={away}
          size="sm"
          bold={awayWon}
          muted={homeWon}
          placeholder="TBD"
        />
      </div>

      <div className={cn('shrink-0 text-right')}>
        <ScoreDisplay match={match} sport={data.sport} size="md" />
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {match.status === 'pending' || match.status === 'scheduled' ? (
            match.date ? (
              <>
                {friendlyDay(match.date)}
                {match.time && ` · ${formatTime(match.time)}`}
              </>
            ) : (
              <MatchStatusBadge status={match.status} compact />
            )
          ) : (
            venue?.name
          )}
        </div>
      </div>
    </div>
  )
}
