import { NavLink, useParams } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  GitFork,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Share2,
  Shuffle,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/useUIStore'
import { useTournament } from '@/stores/useTournamentStore'
import { useSport } from '@/stores/useSportStore'
import { getFormat } from '@/config/formats'
import { entrantLabel } from '@/engine/validation'
import { TournamentStatusBadge } from '@/components/shared/StatusBadge'

export interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** Hidden when the tournament's format does not produce this view. */
  requires?: 'bracket' | 'standings'
}

/** Nav for a tournament, filtered to what its format actually has. */
export function useTournamentNav(tournamentId: string | undefined): NavItem[] {
  const tournament = useTournament(tournamentId)
  const sport = useSport(tournament?.sportId)
  if (!tournament) return []

  const format = getFormat(tournament.formatType)
  const base = `/t/${tournament.id}`

  const items: NavItem[] = [
    { to: base, label: 'Dashboard', icon: LayoutDashboard },
    { to: `${base}/teams`, label: `${entrantLabel(sport)} & Players`, icon: Users },
    { to: `${base}/draw`, label: 'Draw & Seeding', icon: Shuffle },
    { to: `${base}/fixtures`, label: 'Fixtures & Results', icon: ListOrdered },
    { to: `${base}/bracket`, label: 'Tie Sheet', icon: GitFork, requires: 'bracket' },
    { to: `${base}/standings`, label: 'Standings', icon: BarChart3, requires: 'standings' },
    { to: `${base}/schedule`, label: 'Schedule', icon: CalendarDays },
    { to: `${base}/share`, label: 'Share & Export', icon: Share2 },
    { to: `${base}/settings`, label: 'Settings', icon: Settings },
  ]

  return items.filter((item) => {
    if (item.requires === 'bracket') return format.hasBracket
    if (item.requires === 'standings') return format.hasStandings
    return true
  })
}

export function Sidebar() {
  const { tournamentId } = useParams()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const tournament = useTournament(tournamentId)
  const sport = useSport(tournament?.sportId)
  const items = useTournamentNav(tournamentId)

  if (!tournament) return null

  const format = getFormat(tournament.formatType)

  return (
    <aside
      data-app-sidebar
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      {/* Tournament identity */}
      <div className={cn('border-b border-sidebar-border p-3', collapsed && 'px-2')}>
        <div className="flex items-center gap-2.5">
          {tournament.logoUrl ? (
            <img src={tournament.logoUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-lg">
              {sport.icon}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{tournament.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sport.name} · {format.name}
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2.5">
            <TournamentStatusBadge status={tournament.status} />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === `/t/${tournament.id}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
