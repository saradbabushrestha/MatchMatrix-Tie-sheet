import { useState } from 'react'
import { toast } from 'sonner'
import { Crown, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox, Separator } from '@/components/ui/controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LogoUpload } from '@/components/shared/LogoUpload'
import { IssueList } from '@/components/shared/IssueNote'
import { useTeamStore } from '@/stores/useTeamStore'
import { validateTeam } from '@/engine/validation'
import { guessShortName } from '@/lib/utils'
import type { Player, SportConfig, Team } from '@/types'

const UNSET = '__none__'

interface TeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  sport: SportConfig
  /** Null to create a new team. */
  team: Team | null
}

/**
 * Team editor with an inline squad list.
 *
 * Squad edits save immediately, which is what an organizer expects while typing
 * a team sheet — no separate save step per player.
 */
export function TeamDialog({ open, onOpenChange, tournamentId, sport, team }: TeamDialogProps) {
  const { teams, players, addTeam, updateTeam, addPlayer, updatePlayer, removePlayer } =
    useTeamStore()

  const [draft, setDraft] = useState(() => makeDraft(team))
  const [playerName, setPlayerName] = useState('')
  const [lastTeamId, setLastTeamId] = useState<string | null>(team?.id ?? null)

  // Re-seed the form when the dialog is pointed at a different team.
  if ((team?.id ?? null) !== lastTeamId) {
    setLastTeamId(team?.id ?? null)
    setDraft(makeDraft(team))
    setPlayerName('')
  }

  const tournamentTeams = teams.filter((t) => t.tournamentId === tournamentId)
  const squad = team
    ? players
        .filter((p) => p.teamId === team.id)
        .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999))
    : []

  const validation = validateTeam(
    { id: team?.id ?? 'new', name: draft.name },
    tournamentTeams,
    players,
    sport,
  )

  function handleSave() {
    if (!draft.name.trim()) {
      toast.error('A team needs a name')
      return
    }
    const blocking = validation.issues.filter((i) => i.level === 'error')
    if (blocking.length > 0) {
      toast.error(blocking[0].message, { description: blocking[0].hint })
      return
    }

    if (team) {
      updateTeam(team.id, {
        name: draft.name.trim(),
        shortName: draft.shortName.trim() || guessShortName(draft.name),
        logoUrl: draft.logoUrl,
        coach: draft.coach || null,
        manager: draft.manager || null,
        contactPhone: draft.contactPhone || null,
        contactEmail: draft.contactEmail || null,
        seed: draft.seed,
        notes: draft.notes || null,
      })
      toast.success(`${draft.name} updated`)
    } else {
      addTeam({
        tournamentId,
        name: draft.name,
        shortName: draft.shortName,
        logoUrl: draft.logoUrl,
        coach: draft.coach || null,
        manager: draft.manager || null,
        contactPhone: draft.contactPhone || null,
        contactEmail: draft.contactEmail || null,
        seed: draft.seed,
        notes: draft.notes || null,
      })
      toast.success(`${draft.name} added`)
    }
    onOpenChange(false)
  }

  function handleAddPlayer() {
    if (!team) return
    const name = playerName.trim()
    if (!name) return

    const nextNumber = (() => {
      const used = new Set(squad.map((p) => p.jerseyNumber).filter((n): n is number => n != null))
      for (let i = 1; i <= sport.squadSize + 20; i++) if (!used.has(i)) return i
      return null
    })()

    addPlayer({
      tournamentId,
      teamId: team.id,
      name,
      jerseyNumber: nextNumber,
      position: sport.positions[0] ?? null,
      isCaptain: squad.length === 0,
    })
    setPlayerName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[88vh]">
        <DialogHeader>
          <DialogTitle>{team ? `Edit ${team.name}` : 'Add a team'}</DialogTitle>
          <DialogDescription>
            {team
              ? 'Changes to the squad are saved as you type. Team details save when you press Save.'
              : `Add the team first, then reopen it to enter the squad.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
            <Field label="Team name" htmlFor="td-name" required>
              <Input
                id="td-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Budhanilkantha FC"
                autoFocus
              />
            </Field>
            <Field label="Short code" htmlFor="td-short" hint="For brackets">
              <Input
                id="td-short"
                value={draft.shortName}
                onChange={(e) => setDraft({ ...draft, shortName: e.target.value.toUpperCase() })}
                placeholder={guessShortName(draft.name || 'TBD')}
                maxLength={5}
              />
            </Field>
          </div>

          <Field label="Team logo">
            <LogoUpload value={draft.logoUrl} onChange={(logoUrl) => setDraft({ ...draft, logoUrl })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coach" htmlFor="td-coach">
              <Input
                id="td-coach"
                value={draft.coach}
                onChange={(e) => setDraft({ ...draft, coach: e.target.value })}
                placeholder="Who runs the team?"
              />
            </Field>
            <Field label="Manager" htmlFor="td-manager">
              <Input
                id="td-manager"
                value={draft.manager}
                onChange={(e) => setDraft({ ...draft, manager: e.target.value })}
              />
            </Field>
            <Field label="Contact phone" htmlFor="td-phone">
              <Input
                id="td-phone"
                type="tel"
                value={draft.contactPhone}
                onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
              />
            </Field>
            <Field label="Contact email" htmlFor="td-email">
              <Input
                id="td-email"
                type="email"
                value={draft.contactEmail}
                onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
              />
            </Field>
            <Field
              label="Seed"
              htmlFor="td-seed"
              hint="Lower is stronger. Leave blank if unseeded."
            >
              <Input
                id="td-seed"
                type="number"
                min={1}
                value={draft.seed ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, seed: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Field label="Notes" htmlFor="td-notes">
              <Input
                id="td-notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Anything worth remembering"
              />
            </Field>
          </div>

          {validation.issues.length > 0 && <IssueList issues={validation.issues} />}

          {/* Squad */}
          {team && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">
                    Players
                    <Badge variant="muted" className="ml-2">
                      {squad.length} / {sport.squadSize}
                    </Badge>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {sport.name} is {sport.teamSize}-a-side
                  </span>
                </div>

                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAddPlayer()
                  }}
                >
                  <Input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Player name"
                    aria-label="New player name"
                  />
                  <Button type="submit" variant="outline" disabled={!playerName.trim()}>
                    <UserPlus />
                    Add
                  </Button>
                </form>

                {squad.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No players yet. Add them above, or import a squad list from the team page.
                  </p>
                ) : (
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                    {squad.map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        sport={sport}
                        onUpdate={(patch) => updatePlayer(player.id, patch)}
                        onRemove={() => {
                          removePlayer(player.id)
                          toast.success(`${player.name} removed`)
                        }}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {team ? 'Close' : 'Cancel'}
          </Button>
          <Button onClick={handleSave}>{team ? 'Save changes' : 'Add team'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlayerRow({
  player,
  sport,
  onUpdate,
  onRemove,
}: {
  player: Player
  sport: SportConfig
  onUpdate: (patch: Partial<Player>) => void
  onRemove: () => void
}) {
  return (
    <li className="flex items-center gap-2 p-2">
      <Input
        type="number"
        min={0}
        value={player.jerseyNumber ?? ''}
        onChange={(e) =>
          onUpdate({ jerseyNumber: e.target.value ? Number(e.target.value) : null })
        }
        className="h-8 w-14 px-1.5 text-center tnum"
        aria-label={`${player.name} jersey number`}
      />
      <Input
        value={player.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="h-8 flex-1 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-input focus-visible:bg-background"
        aria-label="Player name"
      />
      <Select
        value={player.position ?? UNSET}
        onValueChange={(v) => onUpdate({ position: v === UNSET ? null : v })}
      >
        <SelectTrigger className="h-8 w-[104px] shrink-0 px-2 text-xs">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>No position</SelectItem>
          {sport.positions.map((position) => (
            <SelectItem key={position} value={position}>
              {position}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label
        className="flex shrink-0 cursor-pointer items-center gap-1.5 px-1"
        title="Mark as captain"
      >
        <Checkbox
          checked={player.isCaptain}
          onCheckedChange={(checked) => onUpdate({ isCaptain: checked === true })}
          aria-label={`${player.name} is captain`}
        />
        <Crown
          className={player.isCaptain ? 'size-3.5 text-warning' : 'size-3.5 text-muted-foreground'}
        />
      </label>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${player.name}`}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

function makeDraft(team: Team | null) {
  return {
    name: team?.name ?? '',
    shortName: team?.shortName ?? '',
    logoUrl: team?.logoUrl ?? null,
    coach: team?.coach ?? '',
    manager: team?.manager ?? '',
    contactPhone: team?.contactPhone ?? '',
    contactEmail: team?.contactEmail ?? '',
    seed: team?.seed ?? null,
    notes: team?.notes ?? '',
  }
}

/* ── Individual competitor editor ────────────────────────────────────────── */

/** Editor for an individual-sport competitor, which has no squad. */
export function PlayerDialog({
  open,
  onOpenChange,
  tournamentId,
  sport,
  player,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  sport: SportConfig
  player: Player | null
}) {
  const { players, addPlayer, updatePlayer } = useTeamStore()
  const [draft, setDraft] = useState(() => makePlayerDraft(player))
  const [lastId, setLastId] = useState<string | null>(player?.id ?? null)

  if ((player?.id ?? null) !== lastId) {
    setLastId(player?.id ?? null)
    setDraft(makePlayerDraft(player))
  }

  const others = players.filter(
    (p) => p.tournamentId === tournamentId && p.teamId === null && p.id !== player?.id,
  )
  const clash = others.find(
    (p) => p.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
  )

  function handleSave() {
    if (!draft.name.trim()) {
      toast.error('A player needs a name')
      return
    }
    if (clash) {
      toast.error(`"${clash.name}" is already entered`, {
        description: 'Add an initial or middle name to tell them apart.',
      })
      return
    }

    if (player) {
      updatePlayer(player.id, {
        name: draft.name.trim(),
        position: draft.position,
        photoUrl: draft.photoUrl,
        phone: draft.phone || null,
        email: draft.email || null,
        seed: draft.seed,
        notes: draft.notes || null,
      })
      toast.success(`${draft.name} updated`)
    } else {
      addPlayer({
        tournamentId,
        teamId: null,
        name: draft.name,
        position: draft.position,
        photoUrl: draft.photoUrl,
        phone: draft.phone || null,
        email: draft.email || null,
        seed: draft.seed,
        notes: draft.notes || null,
      })
      toast.success(`${draft.name} added`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{player ? `Edit ${player.name}` : 'Add a player'}</DialogTitle>
          <DialogDescription>
            {sport.name} is an individual sport, so each entrant competes on their own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field
            label="Player name"
            htmlFor="pd-name"
            required
            error={clash ? `"${clash.name}" is already entered.` : undefined}
          >
            <Input
              id="pd-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Sarad Shrestha"
              autoFocus
            />
          </Field>

          <Field label="Photo">
            <LogoUpload
              value={draft.photoUrl}
              onChange={(photoUrl) => setDraft({ ...draft, photoUrl })}
              label="Photo"
              shape="circle"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Seed" htmlFor="pd-seed" hint="Lower is stronger">
              <Input
                id="pd-seed"
                type="number"
                min={1}
                value={draft.seed ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, seed: e.target.value ? Number(e.target.value) : null })
                }
              />
            </Field>
            <Field label="Category">
              <Select
                value={draft.position ?? UNSET}
                onValueChange={(v) => setDraft({ ...draft, position: v === UNSET ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Not set</SelectItem>
                  {sport.positions.map((position) => (
                    <SelectItem key={position} value={position}>
                      {position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Phone" htmlFor="pd-phone">
              <Input
                id="pd-phone"
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label="Email" htmlFor="pd-email">
              <Input
                id="pd-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="pd-notes">
            <Textarea
              id="pd-notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {player ? 'Save changes' : (
              <>
                <Plus />
                Add player
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function makePlayerDraft(player: Player | null) {
  return {
    name: player?.name ?? '',
    photoUrl: player?.photoUrl ?? null,
    position: player?.position ?? null,
    phone: player?.phone ?? '',
    email: player?.email ?? '',
    seed: player?.seed ?? null,
    notes: player?.notes ?? '',
  }
}
