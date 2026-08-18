import { useState } from 'react'
import { Check, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { LogoUpload } from '@/components/shared/LogoUpload'
import { useAllSports } from '@/stores/useSportStore'
import { useWizardStore } from '@/stores/useWizardStore'
import { cn } from '@/lib/utils'
import { CustomSportDialog } from './CustomSportDialog'
import type { SportConfig } from '@/types'

/** Step 1 — who is running this, what sport, and when. */
export function StepInfo() {
  const { info, setInfo } = useWizardStore()
  const sports = useAllSports()
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tournament details</h2>
          <p className="text-sm text-muted-foreground">
            Only the name and sport are required — you can fill in the rest later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tournament name"
            htmlFor="t-name"
            required
            className="sm:col-span-2"
            hint="This is what appears on the tie sheet and the public page."
          >
            <Input
              id="t-name"
              value={info.name}
              onChange={(e) => setInfo({ name: e.target.value })}
              placeholder="e.g. Budhanilkantha Cup 2026"
              autoFocus
            />
          </Field>

          <Field label="Description" htmlFor="t-desc" className="sm:col-span-2">
            <Textarea
              id="t-desc"
              value={info.description}
              onChange={(e) => setInfo({ description: e.target.value })}
              placeholder="A short summary for the public page — who is competing and what is at stake."
              rows={3}
            />
          </Field>

          <Field label="Tournament logo" className="sm:col-span-2">
            <LogoUpload value={info.logoUrl} onChange={(logoUrl) => setInfo({ logoUrl })} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Sport</h2>
            <p className="text-sm text-muted-foreground">
              The sport sets the scoring, squad size and how standings are ranked.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCustomOpen(true)}>
            <Plus />
            Add custom sport
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {sports.map((sport) => (
            <SportCard
              key={sport.id}
              sport={sport}
              selected={info.sportId === sport.id}
              onSelect={() => setInfo({ sportId: sport.id })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Organizer & venue</h2>
          <p className="text-sm text-muted-foreground">
            Shown on printed tie sheets and on the public page.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organized by" htmlFor="t-org">
            <Input
              id="t-org"
              value={info.organizer}
              onChange={(e) => setInfo({ organizer: e.target.value })}
              placeholder="e.g. Budhanilkantha Youth Council"
            />
          </Field>

          <Field label="Main venue" htmlFor="t-venue">
            <Input
              id="t-venue"
              value={info.venue}
              onChange={(e) => setInfo({ venue: e.target.value })}
              placeholder="e.g. Budhanilkantha Ground"
            />
          </Field>

          <Field label="Location" htmlFor="t-loc">
            <Input
              id="t-loc"
              value={info.location}
              onChange={(e) => setInfo({ location: e.target.value })}
              placeholder="e.g. Kathmandu, Nepal"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" htmlFor="t-start">
              <Input
                id="t-start"
                type="date"
                value={info.startDate ?? ''}
                onChange={(e) => setInfo({ startDate: e.target.value || null })}
              />
            </Field>
            <Field
              label="Ends"
              htmlFor="t-end"
              error={
                info.startDate && info.endDate && info.endDate < info.startDate
                  ? 'The end date is before the start date.'
                  : undefined
              }
            >
              <Input
                id="t-end"
                type="date"
                value={info.endDate ?? ''}
                min={info.startDate ?? undefined}
                onChange={(e) => setInfo({ endDate: e.target.value || null })}
              />
            </Field>
          </div>

          <Field label="Contact name" htmlFor="t-cname">
            <Input
              id="t-cname"
              value={info.contactName}
              onChange={(e) => setInfo({ contactName: e.target.value })}
              placeholder="Who should people ask?"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" htmlFor="t-cphone">
              <Input
                id="t-cphone"
                type="tel"
                value={info.contactPhone}
                onChange={(e) => setInfo({ contactPhone: e.target.value })}
                placeholder="98…"
              />
            </Field>
            <Field
              label="Email"
              htmlFor="t-cemail"
              error={
                info.contactEmail && !info.contactEmail.includes('@')
                  ? 'That does not look like an email address.'
                  : undefined
              }
            >
              <Input
                id="t-cemail"
                type="email"
                value={info.contactEmail}
                onChange={(e) => setInfo({ contactEmail: e.target.value })}
                placeholder="name@example.com"
              />
            </Field>
          </div>
        </div>
      </section>

      <CustomSportDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        onCreated={(sport) => setInfo({ sportId: sport.id })}
      />
    </div>
  )
}

function SportCard({
  sport,
  selected,
  onSelect,
}: {
  sport: SportConfig
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all',
        selected
          ? 'border-primary bg-primary/8 shadow-xs'
          : 'border-border hover:border-primary/50 hover:bg-accent/50',
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
      <span className="text-2xl leading-none">{sport.icon}</span>
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {sport.name}
        {!sport.builtIn && <Sparkles className="size-3 text-primary" />}
      </span>
      <span className="text-xs text-muted-foreground">
        {sport.participantType === 'team' ? `${sport.teamSize}-a-side` : 'Individual'}
        {' · '}
        {sport.scoringType === 'sets'
          ? `Best of ${sport.periods.count}`
          : sport.scoringType === 'innings'
            ? 'Innings'
            : `${sport.periods.count} × ${sport.periods.durationMinutes ?? '?'}m`}
      </span>
    </button>
  )
}
