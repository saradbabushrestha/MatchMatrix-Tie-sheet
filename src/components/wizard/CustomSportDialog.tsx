import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Callout } from '@/components/shared/IssueNote'
import { CUSTOM_SPORT_TEMPLATE } from '@/config/sports'
import { useSportStore } from '@/stores/useSportStore'
import { guessShortName } from '@/lib/utils'
import type { ScoringType, SportConfig, CustomSportDraft } from '@/types'

const SCORING_OPTIONS: { value: ScoringType; label: string; hint: string; example: string }[] = [
  {
    value: 'aggregate',
    label: 'Single score per side',
    hint: 'One running total each — goals, points, tries.',
    example: '2 - 1',
  },
  {
    value: 'sets',
    label: 'Sets or games',
    hint: 'Whoever wins the most sets wins the match.',
    example: '21-18, 18-21, 21-16',
  },
  {
    value: 'innings',
    label: 'Runs and wickets',
    hint: 'Cricket-style, with overs tracked for run rate.',
    example: '164/7',
  },
]

/**
 * Custom sport builder.
 *
 * Produces exactly the same `SportConfig` shape as a built-in sport, which is
 * what lets the engine treat an organizer's invented game identically to
 * football.
 */
export function CustomSportDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (sport: SportConfig) => void
}) {
  const addSport = useSportStore((s) => s.addSport)
  const [draft, setDraft] = useState<CustomSportDraft>({ ...CUSTOM_SPORT_TEMPLATE })
  const [positionsText, setPositionsText] = useState('Player')

  function patch(next: Partial<CustomSportDraft>) {
    setDraft((d) => ({ ...d, ...next }))
  }

  function patchPeriods(next: Partial<CustomSportDraft['periods']>) {
    setDraft((d) => ({ ...d, periods: { ...d.periods, ...next } }))
  }

  function patchPoints(next: Partial<CustomSportDraft['pointsRule']>) {
    setDraft((d) => ({ ...d, pointsRule: { ...d.pointsRule, ...next } }))
  }

  function handleCreate() {
    if (!draft.name.trim()) {
      toast.error('Give the sport a name first')
      return
    }

    const positions = positionsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    const isSets = draft.scoringType === 'sets'

    const sport = addSport({
      ...draft,
      name: draft.name.trim(),
      shortName: draft.shortName.trim() || guessShortName(draft.name),
      positions: positions.length > 0 ? positions : ['Player'],
      // Set-based sports never draw, and need a sets-to-win figure.
      allowsDraw: isSets ? false : draft.allowsDraw,
      drawResolution: isSets ? 'none' : draft.drawResolution,
      periods: {
        ...draft.periods,
        setsToWin: isSets ? Math.ceil(draft.periods.count / 2) : null,
      },
      standingsColumns: isSets
        ? ['played', 'won', 'lost', 'setsFor', 'setsAgainst', 'setsDiff', 'points']
        : draft.allowsDraw
          ? ['played', 'won', 'drawn', 'lost', 'scoreFor', 'scoreAgainst', 'scoreDiff', 'points']
          : ['played', 'won', 'lost', 'scoreFor', 'scoreAgainst', 'scoreDiff', 'points'],
    })

    toast.success(`${sport.name} added`, {
      description: 'It is now available for any tournament you create.',
    })
    onCreated?.(sport)
    setDraft({ ...CUSTOM_SPORT_TEMPLATE })
    setPositionsText('Player')
    onOpenChange(false)
  }

  const isSets = draft.scoringType === 'sets'
  const isTeam = draft.participantType === 'team'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>Add a custom sport</DialogTitle>
          <DialogDescription>
            Describe how your game is played and scored. Everything else — fixtures, brackets,
            standings — works the same as the built-in sports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px_88px]">
            <Field label="Sport name" htmlFor="cs-name" required>
              <Input
                id="cs-name"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Kabaddi"
                autoFocus
              />
            </Field>
            <Field label="Short code" htmlFor="cs-short" hint="For dense tables">
              <Input
                id="cs-short"
                value={draft.shortName}
                onChange={(e) => patch({ shortName: e.target.value.toUpperCase().slice(0, 4) })}
                placeholder={guessShortName(draft.name || 'SPT')}
              />
            </Field>
            <Field label="Icon" htmlFor="cs-icon">
              <Input
                id="cs-icon"
                value={draft.icon}
                onChange={(e) => patch({ icon: e.target.value.slice(0, 2) })}
                className="text-center text-lg"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contested by">
              <Select
                value={draft.participantType}
                onValueChange={(v) =>
                  patch({
                    participantType: v as 'team' | 'individual',
                    teamSize: v === 'individual' ? 1 : Math.max(2, draft.teamSize),
                    squadSize: v === 'individual' ? 1 : Math.max(2, draft.squadSize),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">Teams</SelectItem>
                  <SelectItem value="individual">Individual players</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {isTeam && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Players on field" htmlFor="cs-size">
                  <Input
                    id="cs-size"
                    type="number"
                    min={1}
                    max={30}
                    value={draft.teamSize}
                    onChange={(e) => patch({ teamSize: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
                <Field label="Max squad" htmlFor="cs-squad">
                  <Input
                    id="cs-squad"
                    type="number"
                    min={1}
                    max={50}
                    value={draft.squadSize}
                    onChange={(e) => patch({ squadSize: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>How is it scored?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {SCORING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => patch({ scoringType: option.value })}
                  aria-pressed={draft.scoringType === option.value}
                  className={
                    draft.scoringType === option.value
                      ? 'rounded-lg border border-primary bg-primary/8 p-3 text-left'
                      : 'rounded-lg border border-border p-3 text-left hover:border-primary/50 hover:bg-accent/50'
                  }
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{option.hint}</p>
                  <p className="mt-1.5 font-mono text-xs text-primary">{option.example}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={isSets ? 'Maximum sets' : 'Periods per match'}
              htmlFor="cs-count"
              hint={isSets ? `First to ${Math.ceil(draft.periods.count / 2)} wins` : undefined}
            >
              <Input
                id="cs-count"
                type="number"
                min={1}
                max={9}
                value={draft.periods.count}
                onChange={(e) => patchPeriods({ count: Math.max(1, Number(e.target.value) || 1) })}
              />
            </Field>
            <Field label="Period is called" htmlFor="cs-label">
              <Input
                id="cs-label"
                value={draft.periods.label}
                onChange={(e) => patchPeriods({ label: e.target.value })}
                placeholder={isSets ? 'Set' : 'Half'}
              />
            </Field>
            <Field label="Minutes each" htmlFor="cs-dur">
              <Input
                id="cs-dur"
                type="number"
                min={1}
                max={240}
                value={draft.periods.durationMinutes ?? ''}
                onChange={(e) =>
                  patchPeriods({ durationMinutes: Number(e.target.value) || null })
                }
              />
            </Field>
          </div>

          <Field
            label="Total slot length in minutes"
            htmlFor="cs-total"
            hint="Used to lay out the schedule and spot venue clashes — include breaks."
          >
            <Input
              id="cs-total"
              type="number"
              min={5}
              max={600}
              value={draft.matchDurationMinutes}
              onChange={(e) =>
                patch({ matchDurationMinutes: Math.max(5, Number(e.target.value) || 60) })
              }
            />
          </Field>

          {!isSets && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Can a match end level?</p>
                <p className="text-xs text-muted-foreground">
                  Turn this off and every match must produce a winner.
                </p>
              </div>
              <Switch
                checked={draft.allowsDraw}
                onCheckedChange={(allowsDraw) =>
                  patch({
                    allowsDraw,
                    drawResolution: allowsDraw ? 'shootout' : 'shootout',
                  })
                }
              />
            </div>
          )}

          {!isSets && !draft.allowsDraw && (
            <Field
              label="Level matches are settled by"
              htmlFor="cs-decider"
              hint="Shown when you enter a level score."
            >
              <Input
                id="cs-decider"
                value={draft.drawResolutionLabel}
                onChange={(e) => patch({ drawResolutionLabel: e.target.value })}
                placeholder="e.g. Penalties, Golden point, Tiebreak"
              />
            </Field>
          )}

          <div className="space-y-2">
            <Label>League points</Label>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Win" htmlFor="cs-pw">
                <Input
                  id="cs-pw"
                  type="number"
                  min={0}
                  value={draft.pointsRule.win}
                  onChange={(e) => patchPoints({ win: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Draw" htmlFor="cs-pd">
                <Input
                  id="cs-pd"
                  type="number"
                  min={0}
                  disabled={isSets || !draft.allowsDraw}
                  value={draft.pointsRule.draw}
                  onChange={(e) => patchPoints({ draw: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Loss" htmlFor="cs-pl">
                <Input
                  id="cs-pl"
                  type="number"
                  min={0}
                  value={draft.pointsRule.loss}
                  onChange={(e) => patchPoints({ loss: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Score unit"
              htmlFor="cs-noun"
              hint="Singular, e.g. goal, point, run"
            >
              <Input
                id="cs-noun"
                value={draft.scoreNoun[0]}
                onChange={(e) =>
                  patch({ scoreNoun: [e.target.value, `${e.target.value}s`] })
                }
              />
            </Field>
            <Field
              label="Positions"
              htmlFor="cs-pos"
              hint="Comma separated, offered when adding players"
            >
              <Input
                id="cs-pos"
                value={positionsText}
                onChange={(e) => setPositionsText(e.target.value)}
                placeholder="Raider, Defender, All-rounder"
              />
            </Field>
          </div>

          <Callout title="Ranked by">
            Points first, then {isSets ? 'set difference' : 'score difference'}, then head-to-head.
            You can fine-tune this per tournament afterwards.
          </Callout>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Add sport</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
