import { useNavigate } from 'react-router-dom'
import { Trophy, Shield, Users, Zap, LayoutDashboard, Shuffle, Share2, GitFork } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuthControl } from '@/components/auth/AuthControl'
import { ThemeToggle } from '@/components/layout/Header'
import { Suspense, lazy } from 'react'

const HeroScene = lazy(() => import('@/components/3d/HeroScene').then(m => ({ default: m.HeroScene })))

export function LandingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setAuthModalOpen = useAuthStore((s) => s.setAuthModalOpen)

  const handleCTA = () => {
    if (user) {
      navigate('/dashboard')
    } else {
      setAuthModalOpen(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
      {/* Custom Navbar for Landing Page */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 font-bold tracking-tight text-lg">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="size-4" />
          </div>
          Tie-Sheet Maker
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
              <LayoutDashboard className="size-4" />
              <span className="hidden sm:inline">Go to Dashboard</span>
            </Button>
          ) : (
            <AuthControl />
          )}
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-6 pt-24 pb-32 text-center lg:pt-36 lg:pb-40">
          {/* Background Glow & 3D Scene */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto">
            <Suspense fallback={<div className="absolute left-1/2 top-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 opacity-30 blur-[100px] bg-gradient-to-b from-primary to-transparent pointer-events-none" />}>
              <HeroScene />
            </Suspense>
          </div>

          <div className="relative z-10 mx-auto max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 pointer-events-none">
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Organize Any Sport, <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">Effortlessly.</span>
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
              Create professional tournaments in minutes. Automatically generate fixtures, interactive brackets, and live standings for football, basketball, futsal, or any custom sport.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pointer-events-auto">
              <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto shadow-xl shadow-primary/25" onClick={handleCTA}>
                <Zap className="mr-2 size-5" />
                {user ? 'Go to Dashboard' : 'Create your first tournament'}
              </Button>
              {!user && (
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto" onClick={() => setAuthModalOpen(true)}>
                  Login to collaborate
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to run the show</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From local leagues to massive knockouts, Tie-Sheet Maker scales with your tournament.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard 
              icon={<GitFork />}
              title="Instant Brackets"
              description="Beautiful, interactive elimination brackets generated automatically from your entrants and seedings."
              className="lg:col-span-2 bg-gradient-to-br from-card to-primary/5"
            />
            <FeatureCard 
              icon={<Users />}
              title="Live Collaboration"
              description="Invite team members to help update scores and manage fixtures in real-time."
            />
            <FeatureCard 
              icon={<Shuffle />}
              title="Smart Draw Engine"
              description="Fully automated group stage generation, round-robins, and seeded draws."
            />
            <FeatureCard 
              icon={<Shield />}
              title="Multi-Sport Support"
              description="Built-in rules for Football, Basketball, Futsal, and Cricket—or define your own custom format."
              className="lg:col-span-2 bg-gradient-to-bl from-card to-purple-500/5"
            />
            <FeatureCard 
              icon={<Share2 />}
              title="Public Sharing"
              description="Share a beautiful read-only public view with players and fans instantly."
              className="md:col-span-2 lg:col-span-3 text-center items-center py-12"
            />
          </div>
        </section>
      </main>
      
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="size-4" />
          <span className="font-semibold text-foreground">Tie-Sheet Maker</span>
        </div>
        <p>© {new Date().getFullYear()} Budhanilkantha Youth Council. All rights reserved.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description, className }: { icon: React.ReactNode, title: string, description: string, className?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/50 ${className || ''}`}>
      <div className="mb-6 inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mb-3 text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}
