import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ListPlus,
  Shuffle,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { IssueList } from '@/components/shared/IssueNote'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWizardStore } from '@/stores/useWizardStore'
import { useSport } from '@/stores/useSportStore'
import { validateFixtureGeneration, entrantLabel, entrantWord } from '@/engine/validation'
import { estimateMatchCount } from '@/engine'
import { getFormat } from '@/config/formats'
import { colorFor, guessShortName, initials } from '@/lib/utils'
import { ImportDialog } from '@/components/teams/ImportDialog'

/** Step 3 — get the entrants in. Quick typing, paste a list, or import a file. */
export function StepEntrants() {
  const {
    info,
    formatType,
    config,
    entrants,
    addEntrant,
    addEntrants,
    updateEntrant,
    removeEntrant,
    moveEntrant,
    shuffleEntrants,
    clearEntrants,
  } = useWizardStore()

  const sport = useSport(info.sportId)
  const format = getFormat(formatType)
  const [name, setName] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const label = entrantLabel(sport)

  // Validate against the engine's real rules, so the wizard and the draw agree.
  const validation = useMemo(
    () =>
      validateFixtureGeneration(
        formatType,
        entrants.map((e, i) => ({
          id: e.key,
          name: e.name,
          shortName: e.shortName || guessShortName(e.name),
          logoUrl: null,
          color: colorFor(e.name),
          seed: e.seed ?? i + 1,
          groupId: null,
          kind: sport.participantType === 'team' ? ('team' as const) : ('player' as const),
        })),
        config,
        sport,
      ),
    [formatType, entrants, config, sport],
  )

  const matchCount = estimateMatchCount(formatType, entrants.length, config)

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return

    const clash = entrants.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())
    if (clash) {
      toast.error(`"${trimmed}" is already on the list`)
      return
    }

    addEntrant(trimmed)
    setName('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Add {label.toLowerCase()}</h2>
        <p className="text-sm text-muted-foreground">
          Type them in one at a time, paste a list, or import a spreadsheet. You can add{' '}
          {sport.participantType === 'team' ? 'squads and logos' : 'photos and contact details'}{' '}
          afterwards.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              sport.participantType === 'team'
                ? 'e.g. Budhanilkantha FC'
                : 'e.g. Sarad Shrestha'
            }
            aria-label={`${label} name`}
          />
          <Button type="submit" disabled={!name.trim()}>
            <UserPlus />
            Add
          </Button>
        </form>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPasteOpen(true)}>
            <ListPlus />
            Paste list
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import file
          </Button>
        </div>
      </div>

      {entrants.length === 0 ? (
        <EmptyState
          icon={<UserPlus />}
          title={`No ${entrantWord(sport, 2)} yet`}
          description={`${format.name} needs at least ${format.minParticipants}. You can also skip this and add them from the tournament dashboard.`}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {entrants.length} {entrantWord(sport, entrants.length)}
              </Badge>
              {matchCount > 0 && (
                <Badge variant="muted">
                  {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={shuffleEntrants}>
                <Shuffle />
                Shuffle
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearEntrants}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 />
                Clear all
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {config.drawMethod === 'seeded'
              ? 'The order below is the seeding order — strongest first. Use the arrows to reorder.'
              : 'The order below is used as the entry list.'}
          </p>

          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {entrants.map((entrant, index) => (
              <li key={entrant.key} className="flex items-center gap-3 p-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground tnum">
                  {index + 1}
                </span>
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: colorFor(entrant.name) }}
                  aria-hidden
                >
                  {initials(entrant.name)}
                </span>
                <Input
                  value={entrant.name}
                  onChange={(e) => updateEntrant(entrant.key, { name: e.target.value })}
                  className="h-8 flex-1 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-input focus-visible:bg-background"
                  aria-label={`${label} ${index + 1} name`}
                />
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveEntrant(entrant.key, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveEntrant(entrant.key, 1)}
                    disabled={index === entrants.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeEntrant(entrant.key)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${entrant.name}`}
                  >
                    <X />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entrants.length > 0 && <IssueList issues={validation.issues} />}

      <PasteListDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        label={label}
        existing={entrants.map((e) => e.name)}
        onAdd={addEntrants}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        sport={sport}
        existingTeamNames={entrants.map((e) => e.name)}
        mode="wizard"
        onWizardImport={(names) => addEntrants(names)}
      />
    </div>
  )
}

function PasteListDialog({
  open,
  onOpenChange,
  label,
  existing,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  existing: string[]
  onAdd: (names: string[]) => void
}) {
  const [text, setText] = useState('')

  // Split on newlines or commas — both are how people naturally paste a list.
  const names = useMemo(
    () =>
      text
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean),
    [text],
  )

  const lower = new Set(existing.map((n) => n.toLowerCase()));
  const fresh = names.filter((n, i) => {
    if (lower.has(n.toLowerCase())) return false
    // Also drop duplicates within the pasted text itself.
    return names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i
  })
  const skipped = names.length - fresh.length

  function handleAdd() {
    if (fresh.length === 0) return
    onAdd(fresh)
    toast.success(`Added ${fresh.length} ${fresh.length === 1 ? 'entry' : 'entries'}`, {
      description: skipped > 0 ? `${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.` : undefined,
    })
    setText('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paste a list of {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            One per line, or separated by commas. Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        <Field
          label="Names"
          htmlFor="paste-list"
          hint={
            names.length > 0
              ? `${fresh.length} will be added${skipped > 0 ? `, ${skipped} skipped as duplicates` : ''}`
              : undefined
          }
        >
          <Textarea
            id="paste-list"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={'Budhanilkantha FC\nKirtipur United\nBoudha Warriors\nThamel City'}
            autoFocus
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={fresh.length === 0}>
            Add {fresh.length > 0 ? fresh.length : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
