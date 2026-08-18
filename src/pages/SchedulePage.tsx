import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  List,
  MapPin,
  Printer,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Confirm } from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader, SectionTitle } from '@/components/shared/StatCard'
import { IssueNote } from '@/components/shared/IssueNote'
import { MatchPanel, MatchRow } from '@/components/matches/MatchPanel'
import {
  useTournamentPage,
  NeedsFixtures,
  type TournamentViewProps,
} from '@/hooks/useTournamentPage'
import { useConflicts, useStandings } from '@/hooks/useTournamentData'
import { useTournamentSettings, useTournamentStore } from '@/stores/useTournamentStore'
import { autoScheduleTournament } from '@/services/tournamentService'
import { matchesByDate } from '@/engine/schedule'
import { exportCSV } from '@/services/exportService'
import { entrantLabel } from '@/engine/validation'
import { formatDateLong, friendlyDay, todayISO } from '@/lib/date'
import type { Match } from '@/types'

/** Scheduling: dates, times, venues, officials, and clash detection. */
export function SchedulePage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <ScheduleView tournament={page.tournament} data={page.data} />
}

function ScheduleView({ tournament, data }: TournamentViewProps) {
  const [openMatch, setOpenMatch] = useState<Match | null>(null)
  const [autoOpen, setAutoOpen] = useState(false)
  const [startDate, setStartDate] = useState(tournament.startDate ?? todayISO())
  const [venueFilter, setVenueFilter] = useState('all')

  const conflicts = useConflicts(data)
  const standings = useStandings(data)
  const settings = useTournamentSettings(tournament.id)
  const updateSettings = useTournamentStore((s) => s.updateSettings)

  const { matches, venues, sport } = data

  const filtered = useMemo(
    () => (venueFilter === 'all' ? matches : matches.filter((m) => m.venueId === venueFilter)),
    [matches, venueFilter],
  )

  const byDate = useMemo(() => matchesByDate(filtered.filter((m) => !m.isBye)), [filtered])
  const byVenue = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const match of filtered) {
      if (match.isBye) continue
      const key = match.venueId ?? 'unassigned'
      const bucket = map.get(key)
      if (bucket) bucket.push(match)
      else map.set(key, [match])
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        `${a.date ?? '9999'} ${a.time ?? ''}`.localeCompare(`${b.date ?? '9999'} ${b.time ?? ''}`),
      )
    }
    return map
  }, [filtered])

  const scheduled = matches.filter((m) => m.date && !m.isBye).length
  const unscheduled = matches.filter((m) => !m.date && !m.isBye && m.status !== 'cancelled').length
  const errors = conflicts.filter((c) => c.severity === 'error')
  const warnings = conflicts.filter((c) => c.severity === 'warning')

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Schedule" />
        <NeedsFixtures
          tournamentId={tournament.id}
          hasEntrants={data.participants.length > 0}
          label={entrantLabel(sport)}
        />
      </div>
    )
  }

  function handleAutoSchedule(skipScheduled: boolean) {
    const count = autoScheduleTournament(tournament, { startDate, skipScheduled })
    setAutoOpen(false)
    toast.success(`${count} matches scheduled`, {
      description: `Starting ${formatDateLong(startDate)}, ${settings.matchesPerDay} per day across ${
        venues.length || 1
      } venue${venues.length === 1 ? '' : 's'}.`,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description={`${scheduled} scheduled · ${unscheduled} still to place`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  exportCSV({ ...data, standings }, 'schedule')
                  toast.success('Schedule exported')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Export failed')
                }
              }}
            >
              <Download />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={() => setAutoOpen(true)}>
              <Wand2 />
              Auto-schedule
            </Button>
          </>
        }
      />

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="space-y-2">
          <SectionTitle>
            {errors.length > 0 ? (
              <span className="text-destructive">
                {errors.length} clash{errors.length === 1 ? '' : 'es'} to fix
              </span>
            ) : (
              <span>
                {warnings.length} thing{warnings.length === 1 ? '' : 's'} to check
              </span>
            )}
          </SectionTitle>
          <div className="space-y-2">
            {[...errors, ...warnings].slice(0, 6).map((conflict) => (
              <IssueNote
                key={conflict.id}
                issue={{
                  level: conflict.severity === 'error' ? 'error' : 'warning',
                  message: conflict.message,
                  hint:
                    conflict.kind === 'venue'
                      ? 'Move one match to another slot, or raise the venue capacity in Settings.'
                      : conflict.kind === 'participant'
                        ? 'Give them more time between matches, or move one of the two.'
                        : conflict.kind === 'official'
                          ? 'Assign a different official to one of the matches.'
                          : 'Open each match to set a date and time.',
                }}
              />
            ))}
            {conflicts.length > 6 && (
              <p className="text-xs text-muted-foreground">
                …and {conflicts.length - 6} more.
              </p>
            )}
          </div>
        </div>
      )}

      {conflicts.length === 0 && scheduled > 0 && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <p className="text-sm">
              No clashes — every venue, entrant and official is free when they need to be.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scheduling rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Scheduling rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Used by auto-schedule and by clash detection. A {sport.name} match is assumed to occupy{' '}
            {sport.matchDurationMinutes} minutes.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Day starts" htmlFor="s-start">
              <Input
                id="s-start"
                type="time"
                value={settings.dayStartTime}
                onChange={(e) => updateSettings(tournament.id, { dayStartTime: e.target.value })}
              />
            </Field>
            <Field label="Day ends" htmlFor="s-end">
              <Input
                id="s-end"
                type="time"
                value={settings.dayEndTime}
                onChange={(e) => updateSettings(tournament.id, { dayEndTime: e.target.value })}
              />
            </Field>
            <Field label="Matches per day" htmlFor="s-per-day">
              <Input
                id="s-per-day"
                type="number"
                min={1}
                max={40}
                value={settings.matchesPerDay}
                onChange={(e) =>
                  updateSettings(tournament.id, {
                    matchesPerDay: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </Field>
            <Field label="Gap between matches" htmlFor="s-gap" hint="Minutes">
              <Input
                id="s-gap"
                type="number"
                min={0}
                max={240}
                value={settings.matchGapMinutes}
                onChange={(e) =>
                  updateSettings(tournament.id, {
                    matchGapMinutes: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </Field>
            <Field label="Minimum rest" htmlFor="s-rest" hint="Minutes between an entrant's matches">
              <Input
                id="s-rest"
                type="number"
                min={0}
                max={2880}
                value={settings.minRestMinutes}
                onChange={(e) =>
                  updateSettings(tournament.id, {
                    minRestMinutes: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {venues.length > 1 && (
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="sm:w-[240px]">
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All venues</SelectItem>
            {venues.map((venue) => (
              <SelectItem key={venue.id} value={venue.id}>
                {venue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue="days">
        <TabsList>
          <TabsTrigger value="days">
            <CalendarDays />
            By day
          </TabsTrigger>
          <TabsTrigger value="venues">
            <MapPin />
            By venue
          </TabsTrigger>
          <TabsTrigger value="list">
            <List />
            Full list
          </TabsTrigger>
        </TabsList>

        <TabsContent value="days">
          {byDate.size === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="Nothing scheduled yet"
              description="Auto-schedule lays every match out across days and venues in one go — you can adjust individual matches afterwards."
              action={{ label: 'Auto-schedule', onClick: () => setAutoOpen(true), icon: <Wand2 /> }}
            />
          ) : (
            <div className="space-y-5">
              {Array.from(byDate.entries()).map(([date, dayMatches]) => (
                <section key={date} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">
                      {date === 'unscheduled' ? 'Not scheduled' : friendlyDay(date)}
                    </h2>
                    {date !== 'unscheduled' && (
                      <span className="text-xs text-muted-foreground">{formatDateLong(date)}</span>
                    )}
                    <Badge variant="muted">
                      {dayMatches.length} match{dayMatches.length === 1 ? '' : 'es'}
                    </Badge>
                    {date === 'unscheduled' && (
                      <Badge variant="warning">
                        <AlertTriangle className="size-3" />
                        Needs dates
                      </Badge>
                    )}
                  </div>
                  <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {dayMatches.map((match) => (
                      <MatchRow key={match.id} match={match} data={data} onOpen={setOpenMatch} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="venues">
          {venues.length === 0 ? (
            <EmptyState
              compact
              icon={<MapPin />}
              title="No venues added"
              description="Add venues in Settings and you can assign matches to them, and spot double bookings."
              action={{
                label: 'Go to Settings',
                onClick: () => window.location.assign(`#/t/${tournament.id}/settings`),
              }}
            />
          ) : (
            <div className="space-y-5">
              {Array.from(byVenue.entries()).map(([venueId, venueMatches]) => {
                const venue = venues.find((v) => v.id === venueId)
                return (
                  <section key={venueId} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{venue?.name ?? 'No venue assigned'}</h2>
                      <Badge variant="muted">{venueMatches.length} matches</Badge>
                      {venue && venue.capacity > 1 && (
                        <Badge variant="secondary">{venue.capacity} in parallel</Badge>
                      )}
                    </div>
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {venueMatches.map((match) => (
                        <MatchRow key={match.id} match={match} data={data} onOpen={setOpenMatch} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="list">
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {filtered
              .filter((m) => !m.isBye)
              .map((match) => (
                <MatchRow key={match.id} match={match} data={data} onOpen={setOpenMatch} />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      <MatchPanel
        match={openMatch}
        data={data}
        open={openMatch !== null}
        onOpenChange={(open) => !open && setOpenMatch(null)}
      />

      <Confirm
        open={autoOpen}
        onOpenChange={setAutoOpen}
        title="Auto-schedule the tournament?"
        description={
          <div className="space-y-3">
            <p>
              Matches are laid out in round order across {venues.length || 1} venue
              {venues.length === 1 ? '' : 's'}, {settings.matchesPerDay} per day, between{' '}
              {settings.dayStartTime} and {settings.dayEndTime}.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="auto-start" className="text-sm font-medium">
                Start from
              </label>
              <Input
                id="auto-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {scheduled > 0 && (
              <p className="text-xs">
                {scheduled} matches already have dates — they will be overwritten.
              </p>
            )}
          </div>
        }
        confirmLabel="Schedule everything"
        onConfirm={() => handleAutoSchedule(false)}
        cancelLabel="Cancel"
      />
    </div>
  )
}
