import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  GitFork,
  LayoutDashboard,
  ListOrdered,
  Moon,
  Plus,
  Settings,
  Share2,
  Shuffle,
  Sun,
  Trophy,
  Users,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useUIStore } from '@/stores/useUIStore'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useSportStore, resolveSport } from '@/stores/useSportStore'
import { getFormat } from '@/config/formats'

/**
 * Command palette (⌘K).
 *
 * Jumps between tournaments and between the sections of the tournament you are
 * already in — the fastest route for an organizer running an event live.
 */
export function CommandMenu() {
  const navigate = useNavigate()
  const { commandOpen, setCommandOpen, theme, setTheme } = useUIStore()
  const tournaments = useTournamentStore((s) => s.tournaments)
  const activeId = useTournamentStore((s) => s.activeId)
  const customSports = useSportStore((s) => s.customSports)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandOpen(!commandOpen)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [commandOpen, setCommandOpen])

  const active = tournaments.find((t) => t.id === activeId)

  function go(path: string) {
    setCommandOpen(false)
    navigate(path)
  }

  const sections = active
    ? (() => {
        const format = getFormat(active.formatType)
        const base = `/t/${active.id}`
        return [
          { label: 'Dashboard', icon: LayoutDashboard, path: base },
          { label: 'Teams & Players', icon: Users, path: `${base}/teams` },
          { label: 'Draw & Seeding', icon: Shuffle, path: `${base}/draw` },
          { label: 'Fixtures & Results', icon: ListOrdered, path: `${base}/fixtures` },
          ...(format.hasBracket ? [{ label: 'Tie Sheet', icon: GitFork, path: `${base}/bracket` }] : []),
          ...(format.hasStandings
            ? [{ label: 'Standings', icon: BarChart3, path: `${base}/standings` }]
            : []),
          { label: 'Schedule', icon: CalendarDays, path: `${base}/schedule` },
          { label: 'Share & Export', icon: Share2, path: `${base}/share` },
          { label: 'Settings', icon: Settings, path: `${base}/settings` },
        ]
      })()
    : []

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search tournaments, or jump to a section…" />
      <CommandList>
        <CommandEmpty>Nothing matched that search.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go('/new')}>
            <Plus />
            Create Tournament
          </CommandItem>
          <CommandItem onSelect={() => go('/')}>
            <Trophy />
            All tournaments
          </CommandItem>
        </CommandGroup>

        {sections.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={active?.name ?? 'Current tournament'}>
              {sections.map((section) => (
                <CommandItem key={section.path} onSelect={() => go(section.path)}>
                  <section.icon />
                  {section.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tournaments.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tournaments">
              {tournaments.slice(0, 12).map((tournament) => {
                const sport = resolveSport(tournament.sportId, customSports)
                return (
                  <CommandItem
                    key={tournament.id}
                    value={`${tournament.name} ${sport.name}`}
                    onSelect={() => go(`/t/${tournament.id}`)}
                  >
                    <span className="text-base leading-none">{sport.icon}</span>
                    <span className="truncate">{tournament.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {getFormat(tournament.formatType).name}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem
            onSelect={() => {
              setTheme(theme === 'dark' ? 'light' : 'dark')
              setCommandOpen(false)
            }}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
