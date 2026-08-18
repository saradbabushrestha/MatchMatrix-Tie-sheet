import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ListOrdered,
  RotateCcw,
  Shuffle,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Confirm } from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader, DetailRow, SectionTitle } from '@/components/shared/StatCard'
import { ParticipantChip } from '@/components/shared/ParticipantChip'
import { IssueList, Callout } from '@/components/shared/IssueNote'
import { useTournamentPage, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useTeamStore } from '@/stores/useTeamStore'
import { useTournamentStore } from '@/stores/useTournamentStore'
import {
  checkFixtures,
  generateTournamentFixtures,
  resetFixtures,
} from '@/services/tournamentService'
import { buildDrawSlots, checkSeedProtection, estimateMatchCount, seedOrder } from '@/engine'
import { entrantLabel, entrantWord } from '@/engine/validation'
import { getFormat, DRAW_METHODS } from '@/config/formats'
import { nextPowerOfTwo, shuffle } from '@/lib/utils'
import type { DrawMethod } from '@/types'

/** Draw and seeding — set the order, then generate the fixtures. */
export function DrawPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <DrawView tournament={page.tournament} data={page.data} />
}

function DrawView({ tournament, data }: TournamentViewProps) {
  const { sport, participants, matches } = data
  const { setSeeds, clearSeeds } = useTeamStore()
  const updateConfig = useTournamentStore((s) => s.updateConfig)

  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  // Local ordering the organizer is arranging before committing seeds.
  const [order, setOrder] = useState<string[] | null>(null)

  const format = getFormat(tournament.formatType)
  const label = entrantLabel(sport)
  const isTeamSport = sport.participantType === 'team'

  const ordered = useMemo(() => {
    const byId = new Map(participants.map((p) => [p.id, p]))
    if (order) {
      return order.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => p != null)
    }
    // Default view: explicit seeds first, then whatever order they were added.
    return participants
      .slice()
      .sort((a, b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER))
  }, [participants, order])

  const validation = checkFixtures(tournament)
  const matchCount = estimateMatchCount(
    tournament.formatType,
    participants.length,
    tournament.config,
  )

  // Preview the first round the same way the generator will build it.
  const previewSlots = useMemo(() => {
    if (participants.length < 2 || !format.hasBracket) return []
    if (tournament.config.drawMethod === 'random') return []
    const seeded = ordered.map((p, i) => ({ ...p, seed: i + 1 }))
    return buildDrawSlots(seeded, 'seeded')
  }, [ordered, participants.length, format.hasBracket, tournament.config.drawMethod])

  const seedProblems = useMemo(
    () => checkSeedProtection(previewSlots, tournament.config.seedProtectionRounds),
    [previewSlots, tournament.config.seedProtectionRounds],
  )

  const hasResults = matches.some(
    (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
  )

  function move(id: string, direction: -1 | 1) {
    const current = ordered.map((p) => p.id)
    const index = current.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    setOrder(current)
  }

  function commitSeeds(ids: string[]) {
    setSeeds(isTeamSport ? 'team' : 'player', ids)
    setOrder(ids)
  }

  function handleShuffle() {
    const shuffled = shuffle(ordered.map((p) => p.id))
    setOrder(shuffled)
    toast.success(`${label} shuffled`, {
      description: 'Apply the order as seeds, or generate the draw straight away.',
    })
  }

  function handleGenerate() {
    setGenerating(true)
    window.setTimeout(() => {
      try {
        // Commit whatever order is on screen so the draw matches the preview.
        if (order) setSeeds(isTeamSport ? 'team' : 'player', order)

        const fresh = useTournamentStore
          .getState()
          .tournaments.find((t) => t.id === tournament.id)
        if (!fresh) return

        const result = generateTournamentFixtures(fresh)
        if (!result.ok) {
          const first = result.validation.issues.find((i) => i.level === 'error')
          toast.error('Could not generate the fixtures', { description: first?.message })
          return
        }
        toast.success(`${result.matchCount} fixtures generated`, {
          description: 'Schedule them, then enter results as they come in.',
        })
      } finally {
        setGenerating(false)
        setRegenerateOpen(false)
      }
    }, 20)
  }

  if (participants.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Draw & Seeding" description="Set the order, then generate the fixtures." />
        <EmptyState
          icon={<Users />}
          title={`Add ${label.toLowerCase()} first`}
          description={`${format.name} needs at least ${format.minParticipants} ${entrantWord(sport, format.minParticipants)} before a draw can be made.`}
          action={{
            label: `Add ${label}`,
            onClick: () => window.location.assign(`#/t/${tournament.id}/teams`),
            icon: <Users />,
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draw & Seeding"
        description={`${participants.length} ${entrantWord(sport, participants.length)} · ${matchCount} matches will be generated`}
        actions={
          <>
            {matches.length > 0 && (
              <Button variant="outline" onClick={() => setResetOpen(true)}>
                <RotateCcw />
                <span className="hidden sm:inline">Clear draw</span>
              </Button>
            )}
            <Button
              onClick={() => (matches.length > 0 ? setRegenerateOpen(true) : handleGenerate())}
              loading={generating}
              disabled={!validation.ok}
            >
              <Wand2 />
              {matches.length > 0 ? 'Redraw' : 'Generate Fixtures'}
            </Button>
          </>
        }
      />

      {matches.length > 0 && (
        <Callout title="Fixtures already generated">
          {matches.length} matches exist{hasResults ? ' and some results have been entered' : ''}.
          Redrawing replaces every fixture{hasResults ? ' and discards all results' : ''}.{' '}
          <Link to={`/t/${tournament.id}/fixtures`} className="font-medium underline">
            View fixtures
          </Link>
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Entry order */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {tournament.config.drawMethod === 'seeded' ? 'Seeding order' : 'Entry order'}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShuffle}>
                  <Shuffle />
                  Shuffle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => commitSeeds(ordered.map((p) => p.id))}
                >
                  <Sparkles />
                  Apply as seeds
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {tournament.config.drawMethod === 'seeded'
                ? 'Strongest first. Seed 1 and 2 land in opposite halves of the bracket.'
                : tournament.config.drawMethod === 'random'
                  ? 'The draw is randomised when you generate, so this order is only a reference.'
                  : 'Pairs are taken in order: 1 v 2, 3 v 4, and so on.'}
            </p>
          </CardHeader>

          <CardContent className="p-0">
            <ul className="divide-y divide-border border-t border-border">
              {ordered.map((participant, index) => {
                const isProtected =
                  tournament.config.seedProtectionRounds > 0 &&
                  index < 2 ** tournament.config.seedProtectionRounds
                return (
                  <li key={participant.id} className="flex items-center gap-3 p-2.5">
                    <span
                      className={
                        isProtected
                          ? 'flex size-7 shrink-0 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary tnum'
                          : 'flex size-7 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground tnum'
                      }
                    >
                      {index + 1}
                    </span>
                    <ParticipantChip
                      participant={participant}
                      size="sm"
                      bold
                      className="min-w-0 flex-1"
                    />
                    {participant.seed != null && participant.seed !== index + 1 && (
                      <Badge variant="muted" className="shrink-0">
                        was {participant.seed}
                      </Badge>
                    )}
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => move(participant.id, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${participant.name} up`}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => move(participant.id, 1)}
                        disabled={index === ordered.length - 1}
                        aria-label={`Move ${participant.name} down`}
                      >
                        <ArrowDown />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Settings + preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Draw method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="sr-only">Draw method</Label>
              <Select
                value={tournament.config.drawMethod}
                onValueChange={(v) =>
                  updateConfig(tournament.id, { drawMethod: v as DrawMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRAW_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {DRAW_METHODS.find((m) => m.value === tournament.config.drawMethod)?.hint}
              </p>

              <div className="divide-y divide-border pt-1">
                <DetailRow label="Format" value={format.name} />
                <DetailRow
                  label={label}
                  value={<span className="tnum">{participants.length}</span>}
                />
                <DetailRow label="Matches" value={<span className="tnum">{matchCount}</span>} />
                {format.hasBracket && (
                  <>
                    <DetailRow
                      label="Bracket size"
                      value={<span className="tnum">{nextPowerOfTwo(participants.length)}</span>}
                    />
                    <DetailRow
                      label="Byes"
                      value={
                        <span className="tnum">
                          {nextPowerOfTwo(participants.length) - participants.length}
                        </span>
                      }
                    />
                  </>
                )}
                {tournament.formatType === 'group_knockout' && (
                  <DetailRow
                    label="Groups"
                    value={
                      <span className="tnum">
                        {tournament.config.groupCount} × top {tournament.config.advancePerGroup}
                      </span>
                    }
                  />
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  clearSeeds(tournament.id)
                  setOrder(null)
                  toast.success('Seeds cleared')
                }}
              >
                Clear all seeds
              </Button>
            </CardContent>
          </Card>

          {seedProblems.length > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="flex gap-3 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Protected seeds would meet early</p>
                  <p className="text-xs text-muted-foreground">
                    {seedProblems
                      .map((p) => `seed ${p.seedA} v seed ${p.seedB}`)
                      .join(', ')}{' '}
                    in round one. Shuffle or reorder to separate them.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {validation.issues.length > 0 && <IssueList issues={validation.issues} />}

      {/* First-round preview */}
      {previewSlots.length > 0 && (
        <div className="space-y-3">
          <SectionTitle>First round preview</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: previewSlots.length / 2 }, (_, i) => {
              const home = previewSlots[i * 2]
              const away = previewSlots[i * 2 + 1]
              const isBye = (home == null) !== (away == null)
              return (
                <div
                  key={i}
                  className="space-y-1.5 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground tnum">
                      Match {i + 1}
                    </span>
                    {isBye && <Badge variant="muted">Bye</Badge>}
                  </div>
                  <ParticipantChip participant={home} size="sm" placeholder="Bye" showSeed />
                  <ParticipantChip participant={away} size="sm" placeholder="Bye" showSeed />
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {tournament.config.drawMethod === 'random'
              ? 'This preview uses the current order — the actual draw will be randomised.'
              : `Standard bracket positions: ${seedOrder(Math.min(8, previewSlots.length)).join(', ')}${previewSlots.length > 8 ? '…' : ''}`}
          </p>
        </div>
      )}

      {matches.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" asChild>
            <Link to={`/t/${tournament.id}/fixtures`}>
              <ListOrdered />
              Go to fixtures & results
            </Link>
          </Button>
        </div>
      )}

      <Confirm
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Redraw the whole tournament?"
        description={
          hasResults
            ? 'Every fixture is replaced and all results, dates and venue assignments are lost. There is no undo.'
            : 'Every fixture is replaced, along with any dates and venues you have set.'
        }
        confirmLabel="Redraw"
        destructive
        onConfirm={handleGenerate}
      />

      <Confirm
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Clear the draw?"
        description={`All ${matches.length} fixtures are deleted. Your ${label.toLowerCase()} and their squads are kept.`}
        confirmLabel="Clear draw"
        destructive
        onConfirm={() => {
          resetFixtures(tournament.id)
          setResetOpen(false)
          toast.success('Draw cleared', { description: `${label} and squads were kept.` })
        }}
      />
    </div>
  )
}
