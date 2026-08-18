import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/controls'
import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/shared/IssueNote'
import {
  BEST_OF_OPTIONS,
  DRAW_METHODS,
  TOURNAMENT_FORMATS,
  getFormat,
  type ConfigField,
  type TournamentFormat,
} from '@/config/formats'
import { useWizardStore } from '@/stores/useWizardStore'
import { useSport } from '@/stores/useSportStore'
import { estimateMatchCount } from '@/engine'
import { cn } from '@/lib/utils'
import { entrantWord } from '@/engine/validation'

/** Step 2 — pick the structure, then tune only the knobs it uses. */
export function StepFormat() {
  const { formatType, setFormat, config, setConfig, entrants, info } = useWizardStore()
  const sport = useSport(info.sportId)
  const format = getFormat(formatType)

  // Preview against the real entrant count when we have one, else a typical field.
  const previewCount = entrants.length >= 2 ? entrants.length : 8
  const matchCount = estimateMatchCount(formatType, previewCount, config)

  const shows = (field: ConfigField) => format.fields.includes(field)

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tournament format</h2>
          <p className="text-sm text-muted-foreground">
            How the {entrantWord(sport, 2)} are matched up. You can change this until the draw is
            made.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {TOURNAMENT_FORMATS.map((option) => (
            <FormatCard
              key={option.id}
              format={option}
              selected={formatType === option.id}
              onSelect={() => setFormat(option.id)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{format.name} options</h2>
            <p className="text-sm text-muted-foreground">
              Everything here has a sensible default — change only what you need.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            ≈ {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            {entrants.length < 2 && ' for 8 entrants'}
          </Badge>
        </div>

        <div className="space-y-4 rounded-lg border border-border p-4">
          {shows('groupCount') && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Number of groups"
                htmlFor="f-groups"
                hint={
                  entrants.length >= 2
                    ? `About ${Math.floor(entrants.length / Math.max(1, config.groupCount))} per group`
                    : undefined
                }
              >
                <Input
                  id="f-groups"
                  type="number"
                  min={1}
                  max={16}
                  value={config.groupCount}
                  onChange={(e) =>
                    setConfig({ groupCount: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </Field>
              <Field
                label="Advance per group"
                htmlFor="f-advance"
                hint={`${config.groupCount * config.advancePerGroup} reach the knockout stage`}
              >
                <Input
                  id="f-advance"
                  type="number"
                  min={1}
                  max={8}
                  value={config.advancePerGroup}
                  onChange={(e) =>
                    setConfig({ advancePerGroup: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </Field>
            </div>
          )}

          {shows('bestOf') && sport.scoringType === 'sets' && (
            <div className="space-y-2">
              <Label>Match format</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {BEST_OF_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setConfig({ bestOf: option.value })}
                    aria-pressed={config.bestOf === option.value}
                    className={cn(
                      'rounded-md border p-2.5 text-left transition-colors',
                      config.bestOf === option.value
                        ? 'border-primary bg-primary/8'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50',
                    )}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {shows('drawMethod') && (
            <div className="space-y-2">
              <Label>How should the draw be made?</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {DRAW_METHODS.map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setConfig({ drawMethod: method.value })}
                    aria-pressed={config.drawMethod === method.value}
                    className={cn(
                      'rounded-md border p-2.5 text-left transition-colors',
                      config.drawMethod === method.value
                        ? 'border-primary bg-primary/8'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50',
                    )}
                  >
                    <p className="text-sm font-medium">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{method.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {shows('doubleRoundRobin') && (
              <ToggleRow
                label="Play everyone twice"
                hint="Home and away — doubles the number of matches."
                checked={config.doubleRoundRobin}
                onChange={(doubleRoundRobin) => setConfig({ doubleRoundRobin })}
              />
            )}

            {shows('groupDoubleRoundRobin') && (
              <ToggleRow
                label="Group matches played twice"
                hint="Each pair meets home and away within their group."
                checked={config.groupDoubleRoundRobin}
                onChange={(groupDoubleRoundRobin) => setConfig({ groupDoubleRoundRobin })}
              />
            )}

            {shows('thirdPlaceMatch') && (
              <ToggleRow
                label="Third-place play-off"
                hint="The beaten semi-finalists meet to decide the bronze."
                checked={config.thirdPlaceMatch}
                onChange={(thirdPlaceMatch) => setConfig({ thirdPlaceMatch })}
              />
            )}

            {shows('grandFinalReset') && (
              <ToggleRow
                label="Grand final reset"
                hint="If the losers-bracket side wins the grand final, a decider is played."
                checked={config.grandFinalReset}
                onChange={(grandFinalReset) => setConfig({ grandFinalReset })}
              />
            )}

            {shows('seedProtectionRounds') && config.drawMethod === 'seeded' && (
              <ToggleRow
                label="Keep the top seeds apart early"
                hint="Warns you if the draw would pit two of the top four against each other in round one."
                checked={config.seedProtectionRounds > 0}
                onChange={(on) => setConfig({ seedProtectionRounds: on ? 2 : 0 })}
              />
            )}
          </div>

          {shows('points') && (
            <div className="space-y-2">
              <Label>Points system</Label>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Win" htmlFor="f-pw">
                  <Input
                    id="f-pw"
                    type="number"
                    min={0}
                    value={config.pointsWin ?? sport.pointsRule.win}
                    onChange={(e) => setConfig({ pointsWin: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Draw" htmlFor="f-pd">
                  <Input
                    id="f-pd"
                    type="number"
                    min={0}
                    disabled={!sport.allowsDraw}
                    value={config.pointsDraw ?? sport.pointsRule.draw}
                    onChange={(e) => setConfig({ pointsDraw: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Loss" htmlFor="f-pl">
                  <Input
                    id="f-pl"
                    type="number"
                    min={0}
                    value={config.pointsLoss ?? sport.pointsRule.loss}
                    onChange={(e) => setConfig({ pointsLoss: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
              {!sport.allowsDraw && (
                <p className="text-xs text-muted-foreground">
                  {sport.name} matches cannot end level, so draw points do not apply.
                </p>
              )}
            </div>
          )}
        </div>

        {format.notes.length > 0 && (
          <Callout title="Worth knowing">
            <ul className="list-disc space-y-1 pl-4">
              {format.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Callout>
        )}
      </section>
    </div>
  )
}

function FormatCard({
  format,
  selected,
  onSelect,
}: {
  format: TournamentFormat
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-all',
        selected
          ? 'border-primary bg-primary/8 shadow-xs'
          : 'border-border hover:border-primary/50 hover:bg-accent/50',
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      <span className="text-2xl leading-none">{format.icon}</span>
      <div className="space-y-0.5 pr-6">
        <p className="font-semibold">{format.name}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{format.tagline}</p>
      </div>
      <p className="text-sm text-muted-foreground">{format.description}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <Badge variant="muted">
          {format.minParticipants}–{format.maxParticipants} entrants
        </Badge>
        {format.hasBracket && <Badge variant="muted">Bracket</Badge>}
        {format.hasStandings && <Badge variant="muted">Table</Badge>}
      </div>
    </button>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
