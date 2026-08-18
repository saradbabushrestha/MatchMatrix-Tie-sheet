import { useMemo, useState } from 'react'
import {
  Copy,
  Crown,
  Download,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Confirm } from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/StatCard'
import { ParticipantAvatar } from '@/components/shared/ParticipantChip'
import { TeamDialog, PlayerDialog } from '@/components/teams/TeamDialog'
import { ImportDialog } from '@/components/teams/ImportDialog'
import { useTournamentPage, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useTeamStore } from '@/stores/useTeamStore'
import { entrantLabel } from '@/engine/validation'
import { exportCSV } from '@/services/exportService'
import { useStandings } from '@/hooks/useTournamentData'
import type { Player, Team } from '@/types'

/** Team and player management. */
export function TeamsPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <TeamsView tournament={page.tournament} data={page.data} />
}

function TeamsView({ tournament, data }: TournamentViewProps) {
  const [query, setQuery] = useState('')
  const [teamDialog, setTeamDialog] = useState<{ open: boolean; team: Team | null }>({
    open: false,
    team: null,
  })
  const [playerDialog, setPlayerDialog] = useState<{ open: boolean; player: Player | null }>({
    open: false,
    player: null,
  })
  const [importOpen, setImportOpen] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null)

  const { removeTeam, duplicateTeam, removePlayer, setSeeds, clearSeeds } = useTeamStore()
  const standings = useStandings(data)

  const { sport, teams, players, groups } = data

  const label = entrantLabel(sport)
  const isTeamSport = sport.participantType === 'team'

  const individuals = useMemo(
    () => players.filter((p) => p.teamId === null),
    [players],
  )

  const q = query.trim().toLowerCase()

  const visibleTeams = useMemo(
    () =>
      teams.filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.shortName.toLowerCase().includes(q) ||
          (t.coach ?? '').toLowerCase().includes(q),
      ),
    [teams, q],
  )

  const visibleIndividuals = useMemo(
    () => individuals.filter((p) => !q || p.name.toLowerCase().includes(q)),
    [individuals, q],
  )

  const squadPlayers = useMemo(
    () =>
      players
        .filter((p) => p.teamId !== null)
        .filter((p) => {
          if (!q) return true
          const team = teams.find((t) => t.id === p.teamId)
          return (
            p.name.toLowerCase().includes(q) ||
            (team?.name ?? '').toLowerCase().includes(q) ||
            (p.position ?? '').toLowerCase().includes(q)
          )
        }),
    [players, teams, q],
  )

  const groupName = (groupId: string | null) =>
    groupId ? (groups.find((g) => g.id === groupId)?.name ?? null) : null

  function handleAutoSeed() {
    // Seed by current standings where there are results, else keep list order.
    const table = standings[0]
    const ordered =
      table && table.rows.some((r) => r.played > 0)
        ? table.rows.map((r) => r.participant.id)
        : isTeamSport
          ? teams.map((t) => t.id)
          : individuals.map((p) => p.id)

    setSeeds(isTeamSport ? 'team' : 'player', ordered)
    toast.success('Seeds assigned', {
      description:
        table && table.rows.some((r) => r.played > 0)
          ? 'Ordered by the current standings.'
          : 'Ordered by the entry list.',
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${label} & Players`}
        description={
          isTeamSport
            ? `${teams.length} team${teams.length === 1 ? '' : 's'} · ${players.length} player${players.length === 1 ? '' : 's'}`
            : `${individuals.length} player${individuals.length === 1 ? '' : 's'} entered`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleAutoSeed}>
                  <Shuffle />
                  Auto-assign seeds
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    clearSeeds(tournament.id)
                    toast.success('Seeds cleared')
                  }}
                >
                  <Trash2 />
                  Clear all seeds
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    try {
                      exportCSV(
                        { ...data, standings },
                        isTeamSport ? 'teams' : 'players',
                      )
                      toast.success('Exported to CSV')
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Export failed')
                    }
                  }}
                >
                  <Download />
                  Export {isTeamSport ? 'teams' : 'players'} as CSV
                </DropdownMenuItem>
                {isTeamSport && players.length > 0 && (
                  <DropdownMenuItem
                    onClick={() => {
                      try {
                        exportCSV({ ...data, standings }, 'players')
                        toast.success('Exported to CSV')
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Export failed')
                      }
                    }}
                  >
                    <Download />
                    Export all players as CSV
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() =>
                isTeamSport
                  ? setTeamDialog({ open: true, team: null })
                  : setPlayerDialog({ open: true, player: null })
              }
            >
              <Plus />
              Add {isTeamSport ? 'Team' : 'Player'}
            </Button>
          </>
        }
      />

      {(isTeamSport ? teams.length : individuals.length) === 0 ? (
        <EmptyState
          icon={<Users />}
          title={`No ${label.toLowerCase()} yet`}
          description={
            isTeamSport
              ? 'Add teams one at a time, or import a spreadsheet with the squads already filled in.'
              : 'Add players one at a time, or import a list from a spreadsheet.'
          }
          action={{
            label: `Add ${isTeamSport ? 'a team' : 'a player'}`,
            onClick: () =>
              isTeamSport
                ? setTeamDialog({ open: true, team: null })
                : setPlayerDialog({ open: true, player: null }),
            icon: <Plus />,
          }}
          secondaryAction={{ label: 'Import from a file', onClick: () => setImportOpen(true) }}
        />
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isTeamSport ? 'Search teams, coaches or players…' : 'Search players…'}
              className="pl-9"
              aria-label="Search"
            />
          </div>

          {isTeamSport ? (
            <Tabs defaultValue="teams">
              <TabsList>
                <TabsTrigger value="teams">
                  Teams
                  <Badge variant="muted">{visibleTeams.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="players">
                  All players
                  <Badge variant="muted">{squadPlayers.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="teams">
                {visibleTeams.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Search />}
                    title="Nothing matched"
                    action={{ label: 'Clear search', onClick: () => setQuery('') }}
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleTeams.map((team) => {
                      const squad = players.filter((p) => p.teamId === team.id)
                      const captain = squad.find((p) => p.isCaptain)
                      const short = squad.length > 0 && squad.length < sport.teamSize

                      return (
                        <Card key={team.id} className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => setTeamDialog({ open: true, team })}
                            className="flex flex-1 flex-col gap-3 p-4 text-left"
                          >
                            <div className="flex items-start gap-3">
                              <ParticipantAvatar
                                participant={{
                                  name: team.name,
                                  shortName: team.shortName,
                                  logoUrl: team.logoUrl,
                                  color: team.color,
                                }}
                                size="lg"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold leading-tight">{team.name}</p>
                                <p className="text-xs text-muted-foreground">{team.shortName}</p>
                                {captain && (
                                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                    <Crown className="size-3 shrink-0 text-warning" />
                                    {captain.name}
                                  </p>
                                )}
                              </div>
                              {team.seed != null && (
                                <Badge variant="secondary" className="shrink-0">
                                  Seed {team.seed}
                                </Badge>
                              )}
                            </div>

                            <div className="mt-auto flex flex-wrap gap-1.5">
                              <Badge variant={short ? 'warning' : 'muted'}>
                                {squad.length} player{squad.length === 1 ? '' : 's'}
                              </Badge>
                              {groupName(team.groupId) && (
                                <Badge variant="default">{groupName(team.groupId)}</Badge>
                              )}
                              {team.coach && <Badge variant="muted">Coach: {team.coach}</Badge>}
                            </div>
                          </button>

                          <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTeamDialog({ open: true, team })}
                            >
                              <Pencil />
                              Edit squad
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${team.name}`}
                                >
                                  <MoreVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    const copy = duplicateTeam(team.id)
                                    if (copy) toast.success(`"${copy.name}" created`)
                                  }}
                                >
                                  <Copy />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onClick={() => setDeletingTeam(team)}>
                                  <Trash2 />
                                  Delete team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="players">
                {squadPlayers.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<UserPlus />}
                    title="No players yet"
                    description="Open a team to add its squad, or import a spreadsheet."
                    action={{ label: 'Import players', onClick: () => setImportOpen(true) }}
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <TableScroller>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-14">No.</TableHead>
                            <TableHead>Player</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead className="w-24">Position</TableHead>
                            <TableHead className="w-32">Contact</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {squadPlayers.map((player) => {
                            const team = teams.find((t) => t.id === player.teamId)
                            return (
                              <TableRow key={player.id}>
                                <TableCell className="tnum text-muted-foreground">
                                  {player.jerseyNumber ?? '—'}
                                </TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1.5 font-medium">
                                    {player.name}
                                    {player.isCaptain && (
                                      <Crown
                                        className="size-3 text-warning"
                                        aria-label="Captain"
                                      />
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {team?.name ?? '—'}
                                </TableCell>
                                <TableCell>
                                  {player.position ? (
                                    <Badge variant="muted">{player.position}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="truncate text-xs text-muted-foreground">
                                  {player.phone || player.email || '—'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => team && setTeamDialog({ open: true, team })}
                                    aria-label={`Edit ${player.name}`}
                                  >
                                    <Pencil />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableScroller>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            /* Individual sport: a flat player list */
            <div className="overflow-hidden rounded-lg border border-border">
              <TableScroller>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Seed</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-28">Category</TableHead>
                      <TableHead className="w-36">Contact</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleIndividuals.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          {player.seed != null ? (
                            <span className="inline-flex size-6 items-center justify-center rounded bg-muted text-xs font-bold tnum">
                              {player.seed}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <ParticipantAvatar
                              participant={{
                                name: player.name,
                                shortName: player.name,
                                logoUrl: player.photoUrl,
                                color: '#64748b',
                              }}
                              size="sm"
                            />
                            <span className="font-medium">{player.name}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          {player.position ? (
                            <Badge variant="muted">{player.position}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="truncate text-xs text-muted-foreground">
                          {player.phone || player.email || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setPlayerDialog({ open: true, player })}
                              aria-label={`Edit ${player.name}`}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeletingPlayer(player)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${player.name}`}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {visibleIndividuals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          Nothing matched "{query}".
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableScroller>
            </div>
          )}
        </>
      )}

      <TeamDialog
        open={teamDialog.open}
        onOpenChange={(open) => setTeamDialog({ open, team: open ? teamDialog.team : null })}
        tournamentId={tournament.id}
        sport={sport}
        team={teamDialog.team}
      />

      <PlayerDialog
        open={playerDialog.open}
        onOpenChange={(open) => setPlayerDialog({ open, player: open ? playerDialog.player : null })}
        tournamentId={tournament.id}
        sport={sport}
        player={playerDialog.player}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        sport={sport}
        existingTeamNames={teams.map((t) => t.name)}
        mode="tournament"
        tournamentId={tournament.id}
      />

      <Confirm
        open={deletingTeam !== null}
        onOpenChange={(open) => !open && setDeletingTeam(null)}
        title={`Delete ${deletingTeam?.name}?`}
        description={
          <>
            The team and its squad are removed.
            {tournament.fixturesGenerated &&
              ' Fixtures have already been generated — you will need to redraw for the change to take effect.'}
          </>
        }
        confirmLabel="Delete team"
        destructive
        onConfirm={() => {
          if (!deletingTeam) return
          const name = deletingTeam.name
          removeTeam(deletingTeam.id)
          setDeletingTeam(null)
          toast.success(`${name} deleted`)
        }}
      />

      <Confirm
        open={deletingPlayer !== null}
        onOpenChange={(open) => !open && setDeletingPlayer(null)}
        title={`Remove ${deletingPlayer?.name}?`}
        description={
          <>
            They are removed from the entry list.
            {tournament.fixturesGenerated &&
              ' The draw has already been made — redraw for the change to take effect.'}
          </>
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!deletingPlayer) return
          const name = deletingPlayer.name
          removePlayer(deletingPlayer.id)
          setDeletingPlayer(null)
          toast.success(`${name} removed`)
        }}
      />
    </div>
  )
}
