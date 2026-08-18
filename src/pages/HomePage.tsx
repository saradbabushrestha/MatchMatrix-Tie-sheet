import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Copy,
  Database,
  ExternalLink,
  Eye,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/controls'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Confirm } from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { TournamentStatusBadge } from '@/components/shared/StatusBadge'
import { PageHeader } from '@/components/shared/StatCard'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useSportStore, resolveSport } from '@/stores/useSportStore'
import { useMatchStore } from '@/stores/useMatchStore'
import { useTeamStore } from '@/stores/useTeamStore'
import { useUIStore } from '@/stores/useUIStore'
import { deleteTournament } from '@/services/tournamentService'
import { getFormat } from '@/config/formats'
import { loadSeedData } from '@/data/seed'
import { formatDateLong } from '@/lib/date'
import type { Tournament } from '@/types'

/** The tournament list — the app's front door. */
export function HomePage() {
  const navigate = useNavigate()
  const tournaments = useTournamentStore((s) => s.tournaments)
  const duplicateTournament = useTournamentStore((s) => s.duplicateTournament)
  const customSports = useSportStore((s) => s.customSports)
  const matches = useMatchStore((s) => s.matches)
  const teams = useTeamStore((s) => s.teams)
  const players = useTeamStore((s) => s.players)
  const { seedLoaded, markSeedLoaded } = useUIStore()

  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<Tournament | null>(null)
  const [seeding, setSeeding] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tournaments
    return tournaments.filter((t) => {
      const sport = resolveSport(t.sportId, customSports)
      return (
        t.name.toLowerCase().includes(q) ||
        sport.name.toLowerCase().includes(q) ||
        t.organizer.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q)
      )
    })
  }, [tournaments, query, customSports])

  function handleLoadDemo() {
    setSeeding(true)
    // Let the button paint its loading state before the synchronous build.
    window.setTimeout(() => {
      try {
        const count = loadSeedData()
        markSeedLoaded()
        toast.success(`${count} demo tournaments loaded`, {
          description: 'Football, cricket, basketball and badminton — each part-played.',
        })
      } catch (error) {
        toast.error('Could not load the demo data', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setSeeding(false)
      }
    }, 30)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments"
        description={
          tournaments.length > 0
            ? `${tournaments.length} tournament${tournaments.length === 1 ? '' : 's'} · every sport, one place`
            : 'Create a tournament for any sport and get a professional tie sheet in minutes.'
        }
        actions={
          <>
            {!seedLoaded && tournaments.length === 0 && (
              <Button variant="outline" onClick={handleLoadDemo} loading={seeding}>
                <Database />
                Load demo data
              </Button>
            )}
            <Button onClick={() => navigate('/new')}>
              <Plus />
              Create Tournament
            </Button>
          </>
        }
      />

      {tournaments.length === 0 ? (
        <div className="bg-grid rounded-lg border border-dashed border-border">
          <EmptyState
            className="border-0 bg-transparent py-16"
            icon={<Trophy />}
            title="No tournaments yet"
            description="Pick a sport, choose a format, add your teams — the fixtures, bracket and standings are generated for you."
            action={{
              label: 'Create your first tournament',
              onClick: () => navigate('/new'),
              icon: <Plus />,
            }}
            secondaryAction={
              seedLoaded ? undefined : { label: 'Or explore the demo data', onClick: handleLoadDemo }
            }
          />
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, sport or organizer…"
              className="pl-9"
              aria-label="Search tournaments"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              compact
              icon={<Search />}
              title="Nothing matched that search"
              description={`No tournament matches "${query}".`}
              action={{ label: 'Clear search', onClick: () => setQuery('') }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((tournament) => {
                const sport = resolveSport(tournament.sportId, customSports)
                const format = getFormat(tournament.formatType)
                const own = matches.filter(
                  (m) => m.tournamentId === tournament.id && !m.isBye && m.status !== 'cancelled',
                )
                const done = own.filter(
                  (m) =>
                    m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
                )
                const entrantCount =
                  tournament.participantType === 'team'
                    ? teams.filter((t) => t.tournamentId === tournament.id).length
                    : players.filter((p) => p.tournamentId === tournament.id && !p.teamId).length

                const progress = own.length > 0 ? (done.length / own.length) * 100 : 0

                return (
                  <Card
                    key={tournament.id}
                    className="group flex flex-col transition-shadow hover:shadow-pop"
                  >
                    <Link
                      to={`/t/${tournament.id}`}
                      className="flex flex-1 flex-col gap-3 p-4 focus-visible:rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        {tournament.logoUrl ? (
                          <img
                            src={tournament.logoUrl}
                            alt=""
                            className="size-11 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">
                            {sport.icon}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold leading-tight group-hover:text-primary">
                            {tournament.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {sport.name} · {format.name}
                          </p>
                        </div>
                        <TournamentStatusBadge status={tournament.status} />
                      </div>

                      {tournament.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {tournament.description}
                        </p>
                      )}

                      <div className="mt-auto space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="muted">
                            {entrantCount} {tournament.participantType === 'team' ? 'teams' : 'players'}
                          </Badge>
                          <Badge variant="muted">{own.length} matches</Badge>
                          {tournament.publicVisible && (
                            <Badge variant="success">
                              <Eye className="size-3" />
                              Public
                            </Badge>
                          )}
                        </div>

                        {own.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {done.length} of {own.length} played
                              </span>
                              <span className="tnum">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                          </div>
                        )}

                        {tournament.startDate && (
                          <p className="text-xs text-muted-foreground">
                            {formatDateLong(tournament.startDate)}
                            {tournament.location && ` · ${tournament.location}`}
                          </p>
                        )}
                      </div>
                    </Link>

                    <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/t/${tournament.id}`}>Open</Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${tournament.name}`}
                          >
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tournament.publicVisible && (
                            <DropdownMenuItem asChild>
                              <a
                                href={`#/p/${tournament.slug}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink />
                                Open public page
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              const copy = duplicateTournament(tournament.id)
                              if (copy) {
                                toast.success(`"${copy.name}" created`, {
                                  description: 'Settings copied. Teams and fixtures are not.',
                                })
                              }
                            }}
                          >
                            <Copy />
                            Duplicate settings
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onClick={() => setDeleting(tournament)}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <Confirm
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="Its teams, players, fixtures, results and schedule are all deleted. This cannot be undone."
        confirmLabel="Delete tournament"
        destructive
        onConfirm={() => {
          if (!deleting) return
          const name = deleting.name
          deleteTournament(deleting.id)
          setDeleting(null)
          toast.success(`"${name}" deleted`)
        }}
      />
    </div>
  )
}
