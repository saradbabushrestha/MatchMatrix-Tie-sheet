import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Command as CommandIcon,
  ExternalLink,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DrawerContent } from '@/components/ui/dialog'
import { Hint } from '@/components/ui/controls'
import { useUIStore, applyTheme, type Theme } from '@/stores/useUIStore'
import { useTournament } from '@/stores/useTournamentStore'
import { useTournamentNav } from './Sidebar'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

export function Header() {
  const { tournamentId } = useParams()
  const navigate = useNavigate()
  const tournament = useTournament(tournamentId)
  const { sidebarCollapsed, toggleSidebar, setCommandOpen } = useUIStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navItems = useTournamentNav(tournamentId)

  return (
    <header
      data-app-header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur"
    >
      {/* Mobile: open the nav in a drawer, since the sidebar is hidden. */}
      {tournament && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>

          <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <DrawerContent className="left-0 right-auto border-l-0 border-r sm:max-w-72" width="max-w-72">
              <div className="border-b border-border p-4">
                <p className="truncate font-semibold">{tournament.name}</p>
              </div>
              <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === `/t/${tournament.id}`}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium',
                        isActive ? 'bg-accent text-foreground' : 'text-muted-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </DrawerContent>
          </Dialog>

          <Hint label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Hint>
        </>
      )}

      {tournament ? (
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link to="/">
            <ChevronLeft />
            <span className="hidden sm:inline">All tournaments</span>
          </Link>
        </Button>
      ) : (
        <Link to="/" className="flex items-center gap-2 px-1 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </span>
          <span>TieSheet</span>
        </Link>
      )}

      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        onClick={() => setCommandOpen(true)}
        className="gap-2 text-muted-foreground"
      >
        <CommandIcon className="size-3.5" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border bg-muted px-1 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>

      {tournament?.publicVisible && (
        <Hint label="Open the public page">
          <Button variant="outline" size="icon" asChild>
            <a href={`#/p/${tournament.slug}`} target="_blank" rel="noreferrer" aria-label="Open public page">
              <ExternalLink />
            </a>
          </Button>
        </Hint>
      )}

      <ThemeToggle />

      {!tournament && (
        <Button size="sm" onClick={() => navigate('/new')}>
          <Plus />
          <span className="hidden sm:inline">Create Tournament</span>
        </Button>
      )}
    </header>
  )
}

export function ThemeToggle() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Match system', icon: Monitor },
  ]

  const Active = options.find((o) => o.value === theme)?.icon ?? Moon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Active />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
            <option.icon />
            {option.label}
            {theme === option.value && <span className="ml-auto text-primary">•</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Keeps the <html> class in step with the stored theme, including OS changes. */
export function useThemeEffect() {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyTheme('system')
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [theme])
}
