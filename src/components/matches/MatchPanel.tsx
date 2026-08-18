import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CircleSlash,
  Clock,
  Flag,
  MapPin,
  Radio,
  RotateCcw,
  Save,
  UserCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DrawerContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Confirm } from '@/components/ui/alert-dialog'
import { ParticipantChip } from '@/components/shared/ParticipantChip'
import { MatchStatusBadge } from '@/components/shared/StatusBadge'
import { Callout } from '@/components/shared/IssueNote'
import { ScoreEntry } from './ScoreEntry'
import type { Match, MatchScore, Side } from '@/types'
import type { TournamentData } from '@/hooks/useTournamentData'
import {
  clearMatchResult,
  saveMatchResult,
  saveNoResult,
  saveWalkover,
  scheduleMatch,
} from '@/services/tournamentService'
import { useMatchStore } from '@/stores/useMatchStore'
import { emptyScore, validateScore } from '@/engine/scoring'
import { formatDateLong, formatTime } from '@/lib/date'
import { cn } from '@/lib/utils'

const UNSET = '__none__'

/**
 * Match detail panel.
 *
 * One place to enter a result, schedule the match, assign officials, or record
 * a walkover — every action routes through the service so the bracket and
 * standings update together.
 */
export function MatchPanel({
  match,
  data,
  open,
  onOpenChange,
}: {
  match: Match | null
  data: TournamentData
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { tournament, sport, participantMap, venues, officials, rounds } = data
  const [draft, setDraft] = useState<MatchScore | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const updateMatch = useMatchStore((s) => s.updateMatch)
  const swapSides = useMatchStore((s) => s.swapSides)

  const home = match?.homeId ? (participantMap.get(match.homeId) ?? null) : null
  const away = match?.awayId ? (participantMap.get(match.awayId) ?? null) : null
  const round = rounds.find((r) => r.id === match?.roundId)

  // Start from the stored score, or a blank one shaped for this sport.
  const working = useMemo(
    () => draft ?? match?.score ?? emptyScore(sport, tournament.config.bestOf),
    [draft, match, sport, tournament.config.bestOf],
  )

  const validation = useMemo(
    () => validateScore(working, sport, tournament.config.bestOf),
    [working, sport, tournament.config.bestOf],
  )

  if (!match) return null

  const bothKnown = Boolean(match.homeId && match.awayId)
  const isDone = match.status === 'completed' || match.status === 'walkover'

  function handleSave() {
    if (!match) return
    if (!bothKnown) {
      toast.error('Both sides must be known before a result can be saved')
      return
    }
    if (!validation.ok) {
      toast.error('That score is not valid yet', { description: validation.errors[0] })
      return
    }

    const result = saveMatchResult(tournament.id, { matchId: match.id, score: working })
    if (!result.ok) {
      toast.error('Could not save the result', { description: result.error })
      return
    }

    const winner =
      result.outcome === 'home' ? home?.name : result.outcome === 'away' ? away?.name : null

    toast.success(`Match #${match.number} saved`, {
      description: winner ? `${winner} go through.` : 'Recorded as a draw.',
    })
    setDraft(null)
    onOpenChange(false)
  }

  function handleWalkover(side: Side) {
    if (!match) return
    saveWalkover(tournament.id, match.id, side)
    const winner = side === 'home' ? home?.name : away?.name
    toast.success('Walkover recorded', { description: `${winner ?? 'The winner'} advances.` })
    onOpenChange(false)
  }

  function handleNoResult() {
    if (!match) return
    saveNoResult(tournament.id, match.id)
    toast.success('Recorded as no result')
    onOpenChange(false)
  }

  function handleClear() {
    if (!match) return
    clearMatchResult(tournament.id, match.id)
    setDraft(null)
    toast.success(`Match #${match.number} reset`, {
      description: 'Any downstream fixtures have been updated.',
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDraft(null)
        onOpenChange(next)
      }}
    >
      <DrawerContent width="sm:max-w-lg" className="p-0">
        {/* Header */}
        <div className="border-b border-border p-5 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Match #{match.number}</Badge>
            {round && <Badge variant="muted">{round.name}</Badge>}
            <MatchStatusBadge status={match.status} />
          </div>

          <div className="mt-4 space-y-2">
            <ParticipantChip participant={home} placeholder="To be decided" size="md" bold showSeed />
            <div className="flex items-center gap-2 pl-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                vs
              </span>
              <Separator className="flex-1" />
            </div>
            <ParticipantChip participant={away} placeholder="To be decided" size="md" bold showSeed />
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {!bothKnown && (
            <Callout variant="warning" title="Waiting on an earlier round">
              This fixture fills in automatically once the feeding matches are decided. You can still
              set the date, venue and officials now.
            </Callout>
          )}

          {match.isBye && (
            <Callout title="Bye">
              {home?.name ?? away?.name ?? 'This entrant'} advances without playing, because the
              bracket had an empty slot here.
            </Callout>
          )}

          {/* Result */}
          {bothKnown && !match.isBye && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Result</Label>
                {match.status === 'live' && (
                  <Badge variant="live" className="animate-pulse">
                    <Radio className="size-3" />
                    Live
                  </Badge>
                )}
              </div>

              <ScoreEntry
                sport={sport}
                bestOf={tournament.config.bestOf}
                home={home}
                away={away}
                value={draft ?? match.score}
                onChange={setDraft}
              />

              {!validation.ok && draft && (
                <ul className="space-y-1">
                  {validation.errors.map((error) => (
                    <li key={error} className="text-xs text-destructive">
                      {error}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} disabled={!validation.ok} className="flex-1">
                  <Save />
                  {isDone ? 'Update result' : 'Save result'}
                </Button>
                {match.status !== 'live' && !isDone && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateMatch(match.id, { status: 'live' })
                      toast.success(`Match #${match.number} is now live`)
                    }}
                  >
                    <Radio />
                    Mark live
                  </Button>
                )}
                {isDone && (
                  <Button variant="outline" onClick={() => setClearOpen(true)}>
                    <RotateCcw />
                    Reset
                  </Button>
                )}
              </div>
            </section>
          )}

          {/* Scheduling */}
          <section className="space-y-3">
            <Label className="text-sm font-semibold">Schedule</Label>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" htmlFor="m-date">
                <Input
                  id="m-date"
                  type="date"
                  value={match.date ?? ''}
                  onChange={(e) => scheduleMatch(match.id, { date: e.target.value || null })}
                />
              </Field>
              <Field label="Kick-off" htmlFor="m-time">
                <Input
                  id="m-time"
                  type="time"
                  value={match.time ?? ''}
                  onChange={(e) => scheduleMatch(match.id, { time: e.target.value || null })}
                />
              </Field>
            </div>

            <Field
              label="Venue"
              hint={venues.length === 0 ? 'Add venues in Settings to pick one here.' : undefined}
            >
              <Select
                value={match.venueId ?? UNSET}
                onValueChange={(v) => scheduleMatch(match.id, { venueId: v === UNSET ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not set</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={sport.officialRoles[0] ?? 'Referee'}
              hint={
                officials.length === 0 ? 'Add officials in Settings to assign one here.' : undefined
              }
            >
              <Select
                value={match.refereeId ?? UNSET}
                onValueChange={(v) => scheduleMatch(match.id, { refereeId: v === UNSET ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not assigned</SelectItem>
                  {officials.map((official) => (
                    <SelectItem key={official.id} value={official.id}>
                      {official.name} · {official.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {match.date && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  {formatDateLong(match.date)}
                </span>
                {match.time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatTime(match.time)}
                  </span>
                )}
                {match.venueId && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" />
                    {venues.find((v) => v.id === match.venueId)?.name}
                  </span>
                )}
              </p>
            )}
          </section>

          {/* Notes */}
          <section className="space-y-2">
            <Label htmlFor="m-notes" className="text-sm font-semibold">
              Notes
            </Label>
            <Textarea
              id="m-notes"
              value={match.notes}
              onChange={(e) => updateMatch(match.id, { notes: e.target.value })}
              placeholder="Anything worth recording — a postponement, a disciplinary note, a stand-in official."
              rows={2}
            />
          </section>

          {/* Exceptions */}
          {bothKnown && !match.isBye && (
            <section className="space-y-2">
              <Label className="text-sm font-semibold">Match did not happen normally</Label>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleWalkover('home')}>
                    <UserCheck />
                    <span className="truncate">{home?.shortName ?? 'Home'} walkover</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleWalkover('away')}>
                    <UserCheck />
                    <span className="truncate">{away?.shortName ?? 'Away'} walkover</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleNoResult}>
                    <CircleSlash />
                    No result
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateMatch(match.id, { status: 'cancelled' })
                      toast.success(`Match #${match.number} cancelled`)
                      onOpenChange(false)
                    }}
                  >
                    <Flag />
                    Cancel match
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    swapSides(match.id)
                    toast.success('Sides swapped', {
                      description: 'Any recorded result was cleared.',
                    })
                  }}
                >
                  <Users />
                  Swap home and away
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A walkover advances the named side. "No result" counts as played for both, with no
                winner.
              </p>
            </section>
          )}
        </div>

        <Confirm
          open={clearOpen}
          onOpenChange={setClearOpen}
          title={`Reset match #${match.number}?`}
          description={
            <>
              The score will be cleared and any fixtures this result fed into will be emptied out.
              {isDone && ' Downstream results that depended on it are removed too.'}
            </>
          }
          confirmLabel="Reset match"
          destructive
          onConfirm={handleClear}
        />
      </DrawerContent>
    </Dialog>
  )
}

/** Compact row used by fixture lists — clicking it opens the panel. */
export function MatchRow({
  match,
  data,
  onOpen,
  className,
}: {
  match: Match
  data: TournamentData
  onOpen: (match: Match) => void
  className?: string
}) {
  const { participantMap, sport, venues } = data
  const home = match.homeId ? participantMap.get(match.homeId) : null
  const away = match.awayId ? participantMap.get(match.awayId) : null
  const venue = venues.find((v) => v.id === match.venueId)

  const homeWon = match.outcome === 'home' || match.walkoverWinner === 'home'
  const awayWon = match.outcome === 'away' || match.walkoverWinner === 'away'

  return (
    <button
      type="button"
      onClick={() => onOpen(match)}
      className={cn(
        'flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50',
        match.status === 'cancelled' && 'opacity-50',
        className,
      )}
    >
      <span className="w-8 shrink-0 text-xs font-semibold text-muted-foreground tnum">
        #{match.number}
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-center justify-between gap-2">
          <ParticipantChip
            participant={home}
            size="sm"
            bold={homeWon}
            muted={awayWon}
            placeholder="TBD"
            className="min-w-0 flex-1"
          />
          <SideValue match={match} side="home" sport={sport} />
        </span>
        <span className="flex items-center justify-between gap-2">
          <ParticipantChip
            participant={away}
            size="sm"
            bold={awayWon}
            muted={homeWon}
            placeholder="TBD"
            className="min-w-0 flex-1"
          />
          <SideValue match={match} side="away" sport={sport} />
        </span>
      </span>

      <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <MatchStatusBadge status={match.status} compact />
        {(match.date || venue) && (
          <span className="text-[10px] text-muted-foreground">
            {[match.date && formatDateLong(match.date), match.time && formatTime(match.time), venue?.name]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </span>
    </button>
  )
}

function SideValue({
  match,
  side,
  sport,
}: {
  match: Match
  side: Side
  sport: TournamentData['sport']
}) {
  if (match.status === 'walkover') {
    return (
      <span className="w-10 shrink-0 text-right text-xs font-bold text-warning">
        {match.walkoverWinner === side ? 'W' : 'L'}
      </span>
    )
  }
  if (!match.score || (match.status !== 'completed' && match.status !== 'live')) {
    return <span className="w-10 shrink-0 text-right text-sm text-muted-foreground">–</span>
  }
  const value = match.score[side]
  const text =
    sport.scoringType === 'innings' ? `${value.score}/${value.wickets ?? 0}` : String(value.score)
  const won = match.outcome === side
  return (
    <span
      className={cn(
        'w-10 shrink-0 text-right text-sm tnum',
        won ? 'font-bold' : 'font-medium text-muted-foreground',
      )}
    >
      {text}
    </span>
  )
}
