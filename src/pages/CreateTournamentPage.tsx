import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trophy, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Confirm } from '@/components/ui/alert-dialog'
import { useState } from 'react'
import { useWizardStore, type WizardStep } from '@/stores/useWizardStore'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useTeamStore } from '@/stores/useTeamStore'
import { useSport } from '@/stores/useSportStore'
import { generateTournamentFixtures } from '@/services/tournamentService'
import { getFormat } from '@/config/formats'
import { cn, guessShortName } from '@/lib/utils'
import { StepInfo } from '@/components/wizard/StepInfo'
import { StepFormat } from '@/components/wizard/StepFormat'
import { StepEntrants } from '@/components/wizard/StepEntrants'
import { StepReview } from '@/components/wizard/StepReview'
import { entrantLabel } from '@/engine/validation'

const STEPS = [
  { title: 'Tournament Information', short: 'Details' },
  { title: 'Tournament Format', short: 'Format' },
  { title: 'Add Teams & Players', short: 'Entrants' },
  { title: 'Review & Create', short: 'Review' },
] as const

/** The tournament creation wizard. */
export function CreateTournamentPage() {
  const navigate = useNavigate()
  const { step, setStep, next, back, info, formatType, config, entrants, reset } = useWizardStore()
  const createTournament = useTournamentStore((s) => s.createTournament)
  const addTeams = useTeamStore((s) => s.addTeams)
  const addPlayers = useTeamStore((s) => s.addPlayers)
  const sport = useSport(info.sportId)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const format = getFormat(formatType)

  // Step 3 keeps its own label, since it changes with the sport.
  const stepTitles = STEPS.map((s, i) =>
    i === 2 ? { ...s, title: `Add ${entrantLabel(sport)}` } : s,
  )

  const canAdvance = step === 0 ? info.name.trim().length > 0 : true

  function handleCreate() {
    if (!info.name.trim()) {
      toast.error('Your tournament needs a name', {
        description: 'Go back to the first step to add one.',
      })
      setStep(0)
      return
    }

    setCreating(true)
    try {
      const tournament = createTournament({
        name: info.name,
        description: info.description,
        sportId: info.sportId,
        logoUrl: info.logoUrl,
        organizer: info.organizer,
        venue: info.venue,
        location: info.location,
        startDate: info.startDate,
        endDate: info.endDate,
        contactName: info.contactName,
        contactEmail: info.contactEmail,
        contactPhone: info.contactPhone,
        formatType,
        config,
      })

      // Write the entrants as teams or as individual competitors.
      if (entrants.length > 0) {
        if (sport.participantType === 'team') {
          addTeams(
            entrants.map((entrant, i) => ({
              tournamentId: tournament.id,
              name: entrant.name,
              shortName: entrant.shortName || guessShortName(entrant.name),
              seed: config.drawMethod === 'seeded' ? i + 1 : null,
            })),
          )
        } else {
          addPlayers(
            entrants.map((entrant, i) => ({
              tournamentId: tournament.id,
              teamId: null,
              name: entrant.name,
              seed: config.drawMethod === 'seeded' ? i + 1 : null,
            })),
          )
        }
      }

      // Generate fixtures immediately when there are enough entrants.
      let generated = 0
      if (entrants.length >= format.minParticipants) {
        const result = generateTournamentFixtures({ ...tournament })
        if (result.ok) generated = result.matchCount
      }

      reset()
      toast.success(`${tournament.name} created`, {
        description:
          generated > 0
            ? `${generated} ${generated === 1 ? 'fixture' : 'fixtures'} generated and ready to schedule.`
            : `Add ${entrantLabel(sport).toLowerCase()} to generate the fixtures.`,
      })
      navigate(`/t/${tournament.id}`)
    } catch (error) {
      toast.error('Could not create the tournament', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
    } finally {
      setCreating(false)
    }
  }

  const isLast = step === 3

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Create Tournament</h1>
            <p className="text-sm text-muted-foreground">
              Step {step + 1} of 4 · {stepTitles[step].title}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCancelOpen(true)}
          aria-label="Cancel and discard"
        >
          <X />
        </Button>
      </div>

      {/* Step indicator — clickable so the organizer can jump back. */}
      <ol className="flex items-center gap-1">
        {stepTitles.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo'
          return (
            <li key={s.short} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setStep(i as WizardStep)}
                disabled={i > step && !canAdvance}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                  state === 'todo' && 'opacity-60',
                  i <= step && 'hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    state === 'done' && 'bg-primary text-primary-foreground',
                    state === 'current' && 'bg-primary/15 text-primary ring-2 ring-primary',
                    state === 'todo' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden truncate text-sm sm:block',
                    state === 'current' ? 'font-semibold' : 'text-muted-foreground',
                  )}
                >
                  {s.short}
                </span>
              </button>
              {i < stepTitles.length - 1 && (
                <span
                  className={cn(
                    'hidden h-px flex-1 sm:block',
                    i < step ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>

      <div className="animate-fade-in rounded-lg border border-border bg-card p-5 sm:p-6">
        {step === 0 && <StepInfo />}
        {step === 1 && <StepFormat />}
        {step === 2 && <StepEntrants />}
        {step === 3 && <StepReview />}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background/90 py-3 backdrop-blur">
        <Button variant="outline" onClick={back} disabled={step === 0}>
          <ArrowLeft />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {step === 2 && entrants.length === 0 && (
            <span className="hidden text-xs text-muted-foreground sm:block">
              You can skip this and add them later
            </span>
          )}
          {isLast ? (
            <Button onClick={handleCreate} loading={creating} disabled={!info.name.trim()}>
              <Trophy />
              Create Tournament
            </Button>
          ) : (
            <Button onClick={next} disabled={!canAdvance}>
              Continue
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>

      {!canAdvance && step === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Enter a tournament name to continue.
        </p>
      )}

      <Confirm
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Discard this tournament?"
        description="Everything you have entered in the wizard will be lost. Nothing has been saved yet."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          reset()
          navigate('/')
        }}
      />

      {(info.name || entrants.length > 0) && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              reset()
              toast.success('Wizard cleared')
            }}
          >
            <RotateCcw />
            Start over
          </Button>
        </div>
      )}
    </div>
  )
}
