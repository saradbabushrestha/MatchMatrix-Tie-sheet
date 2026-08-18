import { useState } from 'react'
import { BarChart3, Download, Info, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, SectionTitle } from '@/components/shared/StatCard'
import { Callout } from '@/components/shared/IssueNote'
import { StandingsCards, StandingsTable } from '@/components/standings/StandingsTable'
import {
  useTournamentPage,
  NeedsFixtures,
  type TournamentViewProps,
} from '@/hooks/useTournamentPage'
import { useStandings, useSummaryStandings } from '@/hooks/useTournamentData'
import { exportCSV } from '@/services/exportService'
import { pointsSummary } from '@/services/tournamentService'
import { entrantLabel } from '@/engine/validation'
import { getFormat } from '@/config/formats'
import { STAT_META } from '@/config/sports'

/** Standings — a league table, or one table per group. */
export function StandingsPage() {
  const page = useTournamentPage()
  if (!page.ready) return page.fallback
  return <StandingsView tournament={page.tournament} data={page.data} />
}

function StandingsView({ tournament, data }: TournamentViewProps) {
  const standings = useStandings(data)
  const summary = useSummaryStandings(data)
  const [view, setView] = useState<'table' | 'cards'>('table')
  const { sport, matches, groups } = data
  const format = getFormat(tournament.formatType)

  if (matches.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Standings" />
        <NeedsFixtures
          tournamentId={tournament.id}
          hasEntrants={data.participants.length > 0}
          label={entrantLabel(sport)}
        />
      </div>
    )
  }

  // Knockouts have no official table, but a summary is still useful.
  const tables = standings.length > 0 ? standings : [summary]
  const isSummaryOnly = standings.length === 0

  const played = matches.filter(
    (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
  ).length

  const tiebreakerText = sport.tiebreakers
    .slice(0, 4)
    .map((tb) => {
      if (tb.key === 'headToHead') return 'head-to-head'
      if (tb.key === 'name') return 'name'
      if (tb.key === 'seed') return 'seed'
      return STAT_META[tb.key].full.toLowerCase()
    })
    .join(', then ')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standings"
        badge={isSummaryOnly ? <Badge variant="muted">Unofficial summary</Badge> : undefined}
        description={`${played} of ${matches.filter((m) => !m.isBye).length} matches counted`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  exportCSV({ ...data, standings: tables }, 'standings')
                  toast.success('Standings exported')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Export failed')
                }
              }}
            >
              <Download />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </>
        }
      />

      {isSummaryOnly && (
        <Callout title={`${format.name} is decided by the bracket`}>
          There is no official league table for this format. The summary below is worked out from the
          results played so far, which is handy for seeing form at a glance.
        </Callout>
      )}

      {played === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="No results yet"
          description="The table fills in as soon as you enter the first result."
          action={{
            label: 'Enter results',
            onClick: () => window.location.assign(`#/t/${tournament.id}/fixtures`),
          }}
        />
      ) : (
        <>
          {/* Mobile gets a card view; the table stays available for both. */}
          <div className="sm:hidden">
            <Tabs value={view} onValueChange={(v) => setView(v as 'table' | 'cards')}>
              <TabsList>
                <TabsTrigger value="cards">Cards</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-6">
            {tables.map((table) => (
              <div key={table.groupId ?? 'league'} className="space-y-2">
                {tables.length > 1 && table.groupName && (
                  <SectionTitle>{table.groupName}</SectionTitle>
                )}
                {/* Mobile: cards or table, the organizer's choice. */}
                <div className="sm:hidden">
                  {view === 'cards' ? (
                    <StandingsCards table={table} sport={sport} />
                  ) : (
                    <StandingsTable table={table} sport={sport} compact />
                  )}
                </div>
                {/* Wide screens and print always get the full table. */}
                <div className="hidden sm:block">
                  <StandingsTable table={table} sport={sport} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">How this table is ranked</p>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {format.hasStandings && <li>Points: {pointsSummary(sport, tournament.config)}.</li>}
              <li>Order of tiebreakers: {tiebreakerText}.</li>
              {groups.length > 0 && (
                <li>
                  The top {tournament.config.advancePerGroup} from each group advance to the knockout
                  stage.
                </li>
              )}
              {sport.scoringType === 'sets' && (
                <li>
                  {sport.periods.label}s won and lost decide matches; total points act as a finer
                  tiebreaker.
                </li>
              )}
              {sport.scoringType === 'innings' && (
                <li>
                  Net run rate is runs scored per over minus runs conceded per over, across all
                  matches.
                </li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
