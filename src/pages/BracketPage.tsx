import { useRef, useState } from 'react'
import { FileImage, FileText, Loader2, Maximize2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/shared/StatCard'
import { BracketCanvas } from '@/components/bracket/BracketCanvas'
import { hasBracketRounds } from '@/components/bracket/layout'
import { MatchPanel } from '@/components/matches/MatchPanel'
import { PrintableTieSheet } from '@/components/bracket/PrintableTieSheet'
import { useTournamentPage, NeedsFixtures, type TournamentViewProps } from '@/hooks/useTournamentPage'
import { useStandings } from '@/hooks/useTournamentData'
import { exportPDF, exportPNG } from '@/services/exportService'
import { entrantLabel } from '@/engine/validation'
import { slugify } from '@/lib/utils'
import type { Match } from '@/types'

/** The interactive tie sheet. */
export function BracketPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <BracketView tournament={page.tournament} data={page.data} />
}

function BracketView({ tournament, data }: TournamentViewProps) {
  const [openMatch, setOpenMatch] = useState<Match | null>(null)
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)
  const standings = useStandings(data)

  const { rounds, matches, sport, groups } = data

  async function handlePNG() {
    if (!captureRef.current) return
    setExporting('png')
    try {
      // Match the surrounding theme so the image does not look pasted in.
      const dark = document.documentElement.classList.contains('dark')
      await exportPNG(captureRef.current, `${slugify(tournament.name, false)}-bracket`, {
        background: dark ? '#0e1117' : '#ffffff',
        scale: 2,
      })
      toast.success('Bracket saved as PNG')
    } catch (error) {
      toast.error('Could not export the image', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(null)
    }
  }

  function handlePDF() {
    setExporting('pdf')
    try {
      exportPDF({ ...data, standings }, { paper: 'a3', orientation: 'landscape', targets: ['tiesheet'] })
      toast.success('Tie sheet PDF saved')
    } catch (error) {
      toast.error('Could not export the PDF', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setExporting(null)
    }
  }

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tie Sheet" />
        <NeedsFixtures
          tournamentId={tournament.id}
          hasEntrants={data.participants.length > 0}
          label={entrantLabel(sport)}
        />
      </div>
    )
  }

  if (!hasBracketRounds(rounds)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tie Sheet" />
        <EmptyState
          icon={<FileText />}
          title="This format has no bracket"
          description="Round robin tournaments are decided on the standings table rather than a knockout bracket."
          action={{
            label: 'View standings',
            onClick: () => window.location.assign(`#/t/${tournament.id}/standings`),
          }}
        />
      </div>
    )
  }

  const groupStagePending =
    groups.length > 0 &&
    matches.some((m) => m.groupId && (m.status === 'pending' || m.status === 'scheduled'))

  return (
    <div className="space-y-4">
      <PageHeader
        className="no-print"
        title="Tie Sheet"
        badge={
          groupStagePending ? (
            <Badge variant="warning">Group stage in progress</Badge>
          ) : undefined
        }
        description={
          groupStagePending
            ? 'Knockout slots fill in as each group finishes.'
            : 'Click any match to enter a result — winners advance automatically.'
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setFullscreen((v) => !v)}>
              <Maximize2 />
              <span className="hidden sm:inline">{fullscreen ? 'Exit' : 'Fullscreen'}</span>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button variant="outline" onClick={handlePNG} disabled={exporting !== null}>
              {exporting === 'png' ? <Loader2 className="animate-spin" /> : <FileImage />}
              <span className="hidden sm:inline">PNG</span>
            </Button>
            <Button onClick={handlePDF} disabled={exporting !== null}>
              {exporting === 'pdf' ? <Loader2 className="animate-spin" /> : <FileText />}
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </>
        }
      />

      <div
        className={
          fullscreen
            ? 'fixed inset-0 z-40 bg-background'
            : 'no-print h-[calc(100vh-260px)] min-h-[440px] overflow-hidden rounded-lg border border-border'
        }
      >
        {fullscreen && (
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="truncate font-semibold">{tournament.name}</p>
            <Button variant="outline" size="sm" onClick={() => setFullscreen(false)}>
              Exit fullscreen
            </Button>
          </div>
        )}
        <div className={fullscreen ? 'h-[calc(100%-45px)]' : 'size-full'}>
          <BracketCanvas data={data} onOpenMatch={setOpenMatch} captureRef={captureRef} />
        </div>
      </div>

      {/* Print-only layout — the canvas cannot paginate, so paper gets a table. */}
      <PrintableTieSheet tournament={tournament} data={data} />

      <p className="no-print text-center text-xs text-muted-foreground">
        Drag to pan, scroll to zoom. Dashed lines are losers-bracket drops.
      </p>

      <MatchPanel
        match={openMatch}
        data={data}
        open={openMatch !== null}
        onOpenChange={(open) => !open && setOpenMatch(null)}
      />
    </div>
  )
}
