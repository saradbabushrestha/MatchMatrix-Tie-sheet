import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
} from '@/components/ui/table'
import { Hint } from '@/components/ui/controls'
import { ParticipantChip } from '@/components/shared/ParticipantChip'
import { FormPills } from '@/components/shared/StatusBadge'
import { STAT_META, statLabel } from '@/config/sports'
import { formatStat } from '@/engine/standings'
import type { SportConfig, StandingsTable as StandingsTableType, StatKey } from '@/types'
import { cn } from '@/lib/utils'

/**
 * A standings table whose columns come from the sport configuration.
 *
 * Football shows GF/GA/GD, basketball PF/PA/PD and a win percentage, cricket
 * NRR and no-results — all from `sport.standingsColumns`, with no branching here.
 */
export function StandingsTable({
  table,
  sport,
  showForm = true,
  compact = false,
  onSelectParticipant,
  className,
}: {
  table: StandingsTableType
  sport: SportConfig
  showForm?: boolean
  compact?: boolean
  onSelectParticipant?: (participantId: string) => void
  className?: string
}) {
  const columns = table.columns

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      {table.groupName && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <p className="text-sm font-semibold">{table.groupName}</p>
          {table.advanceCount > 0 && (
            <Badge variant="muted">Top {table.advanceCount} advance</Badge>
          )}
        </div>
      )}

      <TableScroller>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9 pr-1 text-center">#</TableHead>
              <TableHead className="min-w-[150px]">
                {sport.participantType === 'team' ? 'Team' : 'Player'}
              </TableHead>
              {columns.map((key) => (
                <TableHead key={key} className="w-12 text-right">
                  <Hint label={STAT_META[key].full}>
                    <span className="cursor-help">{statLabel(key, sport.id)}</span>
                  </Hint>
                </TableHead>
              ))}
              {showForm && !compact && (
                <TableHead className="w-24 text-right">
                  <Hint label="Last 5 results, oldest first">
                    <span className="cursor-help">Form</span>
                  </Hint>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {table.rows.map((row) => (
              <TableRow
                key={row.participant.id}
                className={cn(
                  row.qualified && 'bg-primary/5',
                  onSelectParticipant && 'cursor-pointer',
                )}
                onClick={() => onSelectParticipant?.(row.participant.id)}
              >
                <TableCell className="pr-1 text-center">
                  <span
                    className={cn(
                      'inline-flex size-6 items-center justify-center rounded text-xs font-bold tnum',
                      row.qualified
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground',
                    )}
                  >
                    {row.position}
                  </span>
                </TableCell>

                <TableCell>
                  <ParticipantChip
                    participant={row.participant}
                    size="sm"
                    bold
                    useShortName={compact}
                  />
                </TableCell>

                {columns.map((key) => (
                  <TableCell
                    key={key}
                    className={cn(
                      'text-right tnum',
                      STAT_META[key].emphasize ? 'font-bold' : 'text-muted-foreground',
                      diffTone(key, row[key] as number),
                    )}
                  >
                    {formatStat(row[key] as number, key)}
                  </TableCell>
                ))}

                {showForm && !compact && (
                  <TableCell>
                    <div className="flex justify-end">
                      <FormPills form={row.form} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {table.rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (showForm && !compact ? 3 : 2)}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No results yet — the table fills in as matches are played.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableScroller>

      {table.advanceCount > 0 && table.rows.length > 0 && (
        <div className="border-t border-border bg-muted/25 px-3 py-1.5">
          <p className="text-xs text-muted-foreground">
            <span className="mr-1 inline-block size-2 rounded-sm bg-primary/40" />
            Highlighted rows qualify for the knockout stage.
          </p>
        </div>
      )}
    </div>
  )
}

/** Colour the difference columns so a glance tells you who is up or down. */
function diffTone(key: StatKey, value: number): string | undefined {
  if (key !== 'scoreDiff' && key !== 'setsDiff' && key !== 'nrr') return undefined
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-destructive'
  return undefined
}

/** Mobile-friendly standings: a card per row instead of a wide table. */
export function StandingsCards({
  table,
  sport,
}: {
  table: StandingsTableType
  sport: SportConfig
}) {
  // Show the most meaningful three stats plus points on small screens.
  const primary = table.columns.filter((c) => c !== 'points').slice(0, 3)

  return (
    <div className="space-y-2">
      {table.groupName && <p className="text-sm font-semibold">{table.groupName}</p>}
      {table.rows.map((row) => (
        <div
          key={row.participant.id}
          className={cn(
            'flex items-center gap-3 rounded-lg border border-border p-3',
            row.qualified && 'border-primary/40 bg-primary/5',
          )}
        >
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded text-sm font-bold tnum',
              row.qualified ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            {row.position}
          </span>

          <div className="min-w-0 flex-1">
            <ParticipantChip participant={row.participant} size="sm" bold />
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground tnum">
              {primary.map((key) => (
                <span key={key}>
                  {statLabel(key, sport.id)} {formatStat(row[key] as number, key)}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tnum leading-none">{row.points}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pts</p>
          </div>
        </div>
      ))}
    </div>
  )
}
