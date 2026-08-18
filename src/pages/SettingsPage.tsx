import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, Trash2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Field, Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Confirm } from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/StatCard'
import { LogoUpload } from '@/components/shared/LogoUpload'
import { Callout } from '@/components/shared/IssueNote'
import { useTournamentPage, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useVenueStore } from '@/stores/useVenueStore'
import { deleteTournament } from '@/services/tournamentService'
import { getFormat, BEST_OF_OPTIONS } from '@/config/formats'
import { pointsSummary } from '@/services/tournamentService'

/** Tournament settings: details, rules, venues, officials, deletion. */
export function SettingsPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <SettingsView tournament={page.tournament} data={page.data} />
}

function SettingsView({ tournament, data }: TournamentViewProps) {
  const navigate = useNavigate()
  const updateTournament = useTournamentStore((s) => s.updateTournament)
  const updateConfig = useTournamentStore((s) => s.updateConfig)
  const { addVenue, updateVenue, removeVenue, addOfficial, removeOfficial } = useVenueStore()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [venueName, setVenueName] = useState('')
  const [officialName, setOfficialName] = useState('')
  const [officialRole, setOfficialRole] = useState(data.sport.officialRoles[0] ?? 'Referee')

  const { sport, venues, officials, matches } = data
  const format = getFormat(tournament.formatType)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description={`${sport.name} · ${format.name}`}
      />

      {/* Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Tournament details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="st-name" required className="sm:col-span-2">
              <Input
                id="st-name"
                value={tournament.name}
                onChange={(e) => updateTournament(tournament.id, { name: e.target.value })}
              />
            </Field>

            <Field label="Description" htmlFor="st-desc" className="sm:col-span-2">
              <Textarea
                id="st-desc"
                value={tournament.description}
                onChange={(e) => updateTournament(tournament.id, { description: e.target.value })}
                rows={3}
              />
            </Field>

            <Field label="Logo" className="sm:col-span-2">
              <LogoUpload
                value={tournament.logoUrl}
                onChange={(logoUrl) => updateTournament(tournament.id, { logoUrl })}
              />
            </Field>

            <Field label="Organized by" htmlFor="st-org">
              <Input
                id="st-org"
                value={tournament.organizer}
                onChange={(e) => updateTournament(tournament.id, { organizer: e.target.value })}
              />
            </Field>
            <Field label="Main venue" htmlFor="st-venue">
              <Input
                id="st-venue"
                value={tournament.venue}
                onChange={(e) => updateTournament(tournament.id, { venue: e.target.value })}
              />
            </Field>
            <Field label="Location" htmlFor="st-loc">
              <Input
                id="st-loc"
                value={tournament.location}
                onChange={(e) => updateTournament(tournament.id, { location: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="st-start">
                <Input
                  id="st-start"
                  type="date"
                  value={tournament.startDate ?? ''}
                  onChange={(e) =>
                    updateTournament(tournament.id, { startDate: e.target.value || null })
                  }
                />
              </Field>
              <Field label="Ends" htmlFor="st-end">
                <Input
                  id="st-end"
                  type="date"
                  value={tournament.endDate ?? ''}
                  onChange={(e) =>
                    updateTournament(tournament.id, { endDate: e.target.value || null })
                  }
                />
              </Field>
            </div>
            <Field label="Contact name" htmlFor="st-cname">
              <Input
                id="st-cname"
                value={tournament.contactName}
                onChange={(e) => updateTournament(tournament.id, { contactName: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" htmlFor="st-cphone">
                <Input
                  id="st-cphone"
                  type="tel"
                  value={tournament.contactPhone}
                  onChange={(e) => updateTournament(tournament.id, { contactPhone: e.target.value })}
                />
              </Field>
              <Field label="Email" htmlFor="st-cemail">
                <Input
                  id="st-cemail"
                  type="email"
                  value={tournament.contactEmail}
                  onChange={(e) => updateTournament(tournament.id, { contactEmail: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Changes save as you type.</p>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Match & scoring rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            {sport.name} defaults apply unless you override them here.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sport.scoringType === 'sets' && (
            <Field
              label="Match format"
              hint={`Currently: best of ${tournament.config.bestOf > 1 ? tournament.config.bestOf : sport.periods.count}`}
            >
              <Select
                value={String(tournament.config.bestOf)}
                onValueChange={(v) =>
                  updateConfig(tournament.id, { bestOf: Number(v) as 1 | 3 | 5 | 7 })
                }
              >
                <SelectTrigger className="sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEST_OF_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label} — {option.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {format.hasStandings && (
            <div className="space-y-2">
              <Label>Points system</Label>
              <div className="grid grid-cols-3 gap-3 sm:max-w-sm">
                <Field label="Win" htmlFor="st-pw">
                  <Input
                    id="st-pw"
                    type="number"
                    min={0}
                    value={tournament.config.pointsWin ?? sport.pointsRule.win}
                    onChange={(e) =>
                      updateConfig(tournament.id, { pointsWin: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label="Draw" htmlFor="st-pd">
                  <Input
                    id="st-pd"
                    type="number"
                    min={0}
                    disabled={!sport.allowsDraw}
                    value={tournament.config.pointsDraw ?? sport.pointsRule.draw}
                    onChange={(e) =>
                      updateConfig(tournament.id, { pointsDraw: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label="Loss" htmlFor="st-pl">
                  <Input
                    id="st-pl"
                    type="number"
                    min={0}
                    value={tournament.config.pointsLoss ?? sport.pointsRule.loss}
                    onChange={(e) =>
                      updateConfig(tournament.id, { pointsLoss: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                {pointsSummary(sport, tournament.config)}. Standings recalculate immediately.
              </p>
            </div>
          )}

          <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-2">
            <SportFact label="Contested by" value={sport.participantType === 'team' ? 'Teams' : 'Individuals'} />
            {sport.participantType === 'team' && (
              <SportFact label="Team size" value={`${sport.teamSize} on the field, up to ${sport.squadSize} in the squad`} />
            )}
            <SportFact
              label="Structure"
              value={
                sport.scoringType === 'sets'
                  ? `Best of ${sport.periods.count} ${sport.periods.label.toLowerCase()}s${sport.periods.pointsPerSet ? `, to ${sport.periods.pointsPerSet}` : ''}`
                  : sport.scoringType === 'innings'
                    ? 'Innings, with runs and wickets'
                    : `${sport.periods.count} × ${sport.periods.durationMinutes ?? '?'} min ${sport.periods.label.toLowerCase()}s`
              }
            />
            <SportFact label="Slot length" value={`${sport.matchDurationMinutes} minutes`} />
            <SportFact
              label="Draws"
              value={
                sport.allowsDraw
                  ? 'Allowed'
                  : `Not allowed — settled by ${sport.drawResolutionLabel.toLowerCase() || 'a decider'}`
              }
            />
          </div>

          <Callout title="Format is fixed once drawn">
            The tournament format cannot be changed after fixtures exist. Clear the draw on the Draw
            page first, or create a new tournament.
          </Callout>
        </CardContent>
      </Card>

      {/* Venues */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-4" />
            Venues
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign matches to venues to spot double bookings. Set a capacity above 1 for a site with
            several courts or pitches.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!venueName.trim()) return
              addVenue({ tournamentId: tournament.id, name: venueName, capacity: 1 })
              setVenueName('')
              toast.success('Venue added')
            }}
          >
            <Input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. Budhanilkantha Ground"
              aria-label="New venue name"
            />
            <Button type="submit" variant="outline" disabled={!venueName.trim()}>
              <Plus />
              Add
            </Button>
          </form>

          {venues.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              No venues yet.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
              {venues.map((venue) => {
                const used = matches.filter((m) => m.venueId === venue.id).length
                return (
                  <li key={venue.id} className="flex items-center gap-2 p-2">
                    <Input
                      value={venue.name}
                      onChange={(e) => updateVenue(venue.id, { name: e.target.value })}
                      className="h-8 flex-1 border-transparent bg-transparent px-1.5 shadow-none focus-visible:border-input focus-visible:bg-background"
                      aria-label="Venue name"
                    />
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Label htmlFor={`cap-${venue.id}`} className="text-xs text-muted-foreground">
                        Capacity
                      </Label>
                      <Input
                        id={`cap-${venue.id}`}
                        type="number"
                        min={1}
                        max={20}
                        value={venue.capacity}
                        onChange={(e) =>
                          updateVenue(venue.id, {
                            capacity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-8 w-16 px-1.5 text-center tnum"
                      />
                    </div>
                    <Badge variant="muted" className="shrink-0">
                      {used} match{used === 1 ? '' : 'es'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        removeVenue(venue.id)
                        toast.success(`${venue.name} removed`, {
                          description:
                            used > 0
                              ? `${used} match${used === 1 ? '' : 'es'} now have no venue.`
                              : undefined,
                        })
                      }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${venue.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Officials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <UserCog className="size-4" />
            Match officials
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign officials to matches and get warned if someone is double-booked.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (!officialName.trim()) return
              addOfficial({
                tournamentId: tournament.id,
                name: officialName,
                role: officialRole,
              })
              setOfficialName('')
              toast.success('Official added')
            }}
          >
            <Input
              value={officialName}
              onChange={(e) => setOfficialName(e.target.value)}
              placeholder="Name"
              aria-label="Official name"
              className="flex-1"
            />
            <Select value={officialRole} onValueChange={setOfficialRole}>
              <SelectTrigger className="sm:w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sport.officialRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" disabled={!officialName.trim()}>
              <Plus />
              Add
            </Button>
          </form>

          {officials.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              No officials yet.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
              {officials.map((official) => {
                const assigned = matches.filter((m) => m.refereeId === official.id).length
                return (
                  <li key={official.id} className="flex items-center gap-2 p-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {official.name}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {official.role}
                    </Badge>
                    <Badge variant="muted" className="shrink-0">
                      {assigned} match{assigned === 1 ? '' : 'es'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        removeOfficial(official.id)
                        toast.success(`${official.name} removed`)
                      }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${official.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-destructive">Delete this tournament</CardTitle>
          <p className="text-sm text-muted-foreground">
            Removes the tournament along with its {data.participants.length} entrants,{' '}
            {data.players.length} players and {matches.length} matches. There is no undo.
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            Delete tournament
          </Button>
        </CardContent>
      </Card>

      <Confirm
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${tournament.name}"?`}
        description="Everything belonging to this tournament is permanently removed."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={() => {
          const name = tournament.name
          deleteTournament(tournament.id)
          toast.success(`"${name}" deleted`)
          navigate('/')
        }}
      />
    </div>
  )
}

function SportFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  )
}
