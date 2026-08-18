import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  GitFork,
  ListOrdered,
  MapPin,
  Radio,
  Share2,
  Shuffle,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/controls'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SectionTitle, StatCard, StatGrid } from '@/components/shared/StatCard'
import { ParticipantChip } from '@/components/shared/ParticipantChip'
import { TournamentStatusBadge } from '@/components/shared/StatusBadge'
import { ScoreDisplay } from '@/components/shared/ScoreDisplay'
import { StandingsTable } from '@/components/standings/StandingsTable'
import { MatchPanel } from '@/components/matches/MatchPanel'
import { useTournamentPage, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useConflicts, useStandings, useTournamentStats } from '@/hooks/useTournamentData'
import { getFormat } from '@/config/formats'
import { entrantLabel } from '@/engine/validation'
import { formatDateLong, formatDateTime, friendlyDay } from '@/lib/date'
import type { Match } from '@/types'

/** Tournament overview — the organizer's home screen while an event is running. */
export function DashboardPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <DashboardView tournament={page.tournament} data={page.data} />
}

function DashboardView({ tournament, data }: TournamentViewProps) {
  const [openMatch, setOpenMatch] = useState<Match | null>(null)

  const { sport, participants, matches, groups } = data
  const stats = useTournamentStats(data)
  const standings = useStandings(data)
  const conflicts = useConflicts(data)
  const format = getFormat(tournament.formatType)
  const label = entrantLabel(sport)

  const nextHome = stats.nextMatch?.homeId ? data.participantMap.get(stats.nextMatch.homeId) : null
  const nextAway = stats.nextMatch?.awayId ? data.participantMap.get(stats.nextMatch.awayId) : null

  const errors = conflicts.filter((c) => c.severity === 'error')

  return (
    <div className="space-y-6">
      <PageHeader
        title={tournament.name}
        badge={<TournamentStatusBadge status={tournament.status} />}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {sport.icon} {sport.name} · {format.name}
            </span>
            {tournament.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {tournament.venue}
              </span>
            )}
            {tournament.startDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDateLong(tournament.startDate)}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={`/t/${tournament.id}/fixtures`}>
                <ListOrdered />
                Fixtures
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/t/${tournament.id}/share`}>
                <Share2 />
                Share & Export
              </Link>
            </Button>
          </>
        }
      />

      {/* Headline numbers */}
      <StatGrid>
        <StatCard
          label={label}
          value={tournament.participantType === 'team' ? stats.teamCount : participants.length}
          icon={<Users />}
          hint={
            tournament.participantType === 'team' ? `${stats.playerCount} players` : 'Individual draw'
          }
        />
        <StatCard label="Matches" value={stats.matchCount} icon={<ListOrdered />} />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle2 />}
          accent="success"
        />
        <StatCard label="Upcoming" value={stats.upcoming} icon={<Clock />} />
        <StatCard
          label={stats.live > 0 ? 'Live now' : 'Progress'}
          value={stats.live > 0 ? stats.live : `${Math.round(stats.progress * 100)}%`}
          icon={stats.live > 0 ? <Radio /> : <TrendingUp />}
          accent={stats.live > 0 ? 'destructive' : 'default'}
        />
      </StatGrid>

      {matches.length === 0 ? (
        <EmptyState
          icon={<Shuffle />}
          title="No fixtures yet"
          description={
            participants.length === 0
              ? `Add ${label.toLowerCase()} first, then generate the draw.`
              : `You have ${participants.length} ${label.toLowerCase()}. Generate the draw to create the fixtures.`
          }
          action={
            participants.length === 0
              ? {
                  label: `Add ${label}`,
                  onClick: () => window.location.assign(`#/t/${tournament.id}/teams`),
                  icon: <Users />,
                }
              : {
                  label: 'Generate the draw',
                  onClick: () => window.location.assign(`#/t/${tournament.id}/draw`),
                  icon: <Shuffle />,
                }
          }
        />
      ) : (
        <>
          {/* Progress + current stage */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Tournament progress</CardTitle>
                  {stats.currentRound && (
                    <Badge variant="default">{stats.currentRound.name}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {stats.completed} of {stats.matchCount} matches played
                    </span>
                    <span className="font-semibold tnum">
                      {Math.round(stats.progress * 100)}%
                    </span>
                  </div>
                  <Progress value={stats.progress * 100} />
                </div>

                {stats.podium.champion ? (
                  <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/8 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Final placings
                    </p>
                    <div className="space-y-1.5">
                      <PodiumRow
                        place="1st"
                        icon="🥇"
                        participant={data.participantMap.get(stats.podium.champion) ?? null}
                      />
                      {stats.podium.runnerUp && (
                        <PodiumRow
                          place="2nd"
                          icon="🥈"
                          participant={data.participantMap.get(stats.podium.runnerUp) ?? null}
                        />
                      )}
                      {stats.podium.third && (
                        <PodiumRow
                          place="3rd"
                          icon="🥉"
                          participant={data.participantMap.get(stats.podium.third) ?? null}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  stats.nextMatch && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Next match
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenMatch(stats.nextMatch)}
                        className="mt-2 w-full space-y-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <ParticipantChip participant={nextHome} bold placeholder="TBD" />
                          <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            vs
                          </span>
                          <ParticipantChip
                            participant={nextAway}
                            bold
                            placeholder="TBD"
                            className="justify-end"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Match #{stats.nextMatch.number} ·{' '}
                          {stats.nextMatch.date
                            ? `${friendlyDay(stats.nextMatch.date)}${
                                stats.nextMatch.time
                                  ? ` · ${formatDateTime(null, stats.nextMatch.time)}`
                                  : ''
                              }`
                            : 'Not scheduled'}
                          {stats.nextMatch.venueId &&
                            ` · ${data.venues.find((v) => v.id === stats.nextMatch?.venueId)?.name ?? ''}`}
                        </p>
                      </button>
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <QuickAction
                  to={`/t/${tournament.id}/fixtures`}
                  icon={<ListOrdered />}
                  label="Enter results"
                  hint={`${stats.upcoming} still to play`}
                />
                {format.hasBracket && (
                  <QuickAction
                    to={`/t/${tournament.id}/bracket`}
                    icon={<GitFork />}
                    label="View the tie sheet"
                    hint="Interactive bracket"
                  />
                )}
                {format.hasStandings && (
                  <QuickAction
                    to={`/t/${tournament.id}/standings`}
                    icon={<BarChart3 />}
                    label="Standings"
                    hint="Live table"
                  />
                )}
                <QuickAction
                  to={`/t/${tournament.id}/schedule`}
                  icon={<CalendarDays />}
                  label="Schedule matches"
                  hint={
                    errors.length > 0
                      ? `${errors.length} clash${errors.length === 1 ? '' : 'es'} to fix`
                      : 'Dates, times, venues'
                  }
                  warn={errors.length > 0}
                />
                <QuickAction
                  to={`/t/${tournament.id}/teams`}
                  icon={<Users />}
                  label={`Manage ${label.toLowerCase()}`}
                  hint={`${participants.length} entered`}
                />
              </CardContent>
            </Card>
          </div>

          {errors.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    {errors.length} scheduling clash{errors.length === 1 ? '' : 'es'}
                  </p>
                  <p className="text-xs text-muted-foreground">{errors[0].message}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/t/${tournament.id}/schedule`}>Fix</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent + upcoming */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Recent results</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stats.recentMatches.length === 0 ? (
                  <p className="p-5 pt-0 text-sm text-muted-foreground">
                    Nothing played yet. Enter a result and it will appear here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border border-t border-border">
                    {stats.recentMatches.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => setOpenMatch(match)}
                          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50"
                        >
                          <span className="min-w-0 flex-1 space-y-1">
                            <ParticipantChip
                              participant={
                                match.homeId ? data.participantMap.get(match.homeId) : null
                              }
                              size="sm"
                              bold={match.outcome === 'home'}
                              muted={match.outcome === 'away'}
                            />
                            <ParticipantChip
                              participant={
                                match.awayId ? data.participantMap.get(match.awayId) : null
                              }
                              size="sm"
                              bold={match.outcome === 'away'}
                              muted={match.outcome === 'home'}
                            />
                          </span>
                          <ScoreDisplay match={match} sport={sport} size="md" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Coming up</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stats.upcomingMatches.length === 0 ? (
                  <p className="p-5 pt-0 text-sm text-muted-foreground">
                    {stats.upcoming > 0
                      ? 'Matches are waiting on dates — schedule them to see them here.'
                      : 'Every match has been played.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-border border-t border-border">
                    {stats.upcomingMatches.map((match) => (
                      <li key={match.id}>
                        <button
                          type="button"
                          onClick={() => setOpenMatch(match)}
                          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50"
                        >
                          <span className="min-w-0 flex-1 space-y-1">
                            <ParticipantChip
                              participant={
                                match.homeId ? data.participantMap.get(match.homeId) : null
                              }
                              size="sm"
                              placeholder="TBD"
                            />
                            <ParticipantChip
                              participant={
                                match.awayId ? data.participantMap.get(match.awayId) : null
                              }
                              size="sm"
                              placeholder="TBD"
                            />
                          </span>
                          <span className="shrink-0 text-right text-xs text-muted-foreground">
                            <span className="block font-medium">{friendlyDay(match.date)}</span>
                            {match.time && <span>{formatDateTime(null, match.time)}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top performers */}
          {stats.leaders.length > 0 && (
            <div className="space-y-3">
              <SectionTitle>Top performers</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                {stats.leaders.map((leader) => (
                  <Card key={leader.label} className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {leader.label}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <ParticipantChip participant={leader.participant} size="sm" bold />
                      <span className="shrink-0 text-lg font-bold tnum">{leader.value}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Standings preview */}
          {standings.length > 0 && (
            <div className="space-y-3">
              <SectionTitle
                action={
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/t/${tournament.id}/standings`}>View all</Link>
                  </Button>
                }
              >
                {groups.length > 0 ? 'Group standings' : 'Standings'}
              </SectionTitle>
              <div className="grid gap-4 xl:grid-cols-2">
                {standings.slice(0, 2).map((table) => (
                  <StandingsTable
                    key={table.groupId ?? 'league'}
                    table={table}
                    sport={sport}
                    showForm={false}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <MatchPanel
        match={openMatch}
        data={data}
        open={openMatch !== null}
        onOpenChange={(open) => !open && setOpenMatch(null)}
      />
    </div>
  )
}

function QuickAction({
  to,
  icon,
  label,
  hint,
  warn,
}: {
  to: string
  icon: React.ReactNode
  label: string
  hint: string
  warn?: boolean
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md border border-border p-2.5 transition-colors hover:border-primary/50 hover:bg-accent/50"
    >
      <span
        className={
          warn
            ? 'flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/12 text-destructive [&_svg]:size-4'
            : 'flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary [&_svg]:size-4'
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span
          className={
            warn ? 'block truncate text-xs text-destructive' : 'block truncate text-xs text-muted-foreground'
          }
        >
          {hint}
        </span>
      </span>
    </Link>
  )
}

function PodiumRow({
  place,
  icon,
  participant,
}: {
  place: string
  icon: string
  participant: Parameters<typeof ParticipantChip>[0]['participant']
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-center text-base leading-none" aria-label={place}>
        {icon}
      </span>
      <ParticipantChip participant={participant} size="sm" bold className="min-w-0 flex-1" />
      {place === '1st' && <Trophy className="size-3.5 shrink-0 text-warning" />}
    </div>
  )
}
