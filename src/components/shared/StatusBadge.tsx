import { Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MatchStatus, TournamentStatus } from '@/types'
import { cn } from '@/lib/utils'

const MATCH_STATUS: Record<
  MatchStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'muted' | 'success' | 'warning' | 'destructive' | 'live' }
> = {
  pending: { label: 'Not scheduled', variant: 'muted' },
  scheduled: { label: 'Scheduled', variant: 'outline' },
  live: { label: 'Live', variant: 'live' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
  walkover: { label: 'Walkover', variant: 'warning' },
  no_result: { label: 'No result', variant: 'warning' },
}

export function MatchStatusBadge({
  status,
  className,
  compact = false,
}: {
  status: MatchStatus
  className?: string
  compact?: boolean
}) {
  const meta = MATCH_STATUS[status]
  return (
    <Badge variant={meta.variant} className={cn(status === 'live' && 'animate-pulse', className)}>
      {status === 'live' && <Radio className="size-3" />}
      {compact && status === 'pending' ? 'TBD' : meta.label}
    </Badge>
  )
}

const TOURNAMENT_STATUS: Record<
  TournamentStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'muted' | 'success' | 'warning' }
> = {
  draft: { label: 'Draft', variant: 'muted' },
  setup: { label: 'Setting up', variant: 'warning' },
  active: { label: 'In progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
}

export function TournamentStatusBadge({
  status,
  className,
}: {
  status: TournamentStatus
  className?: string
}) {
  const meta = TOURNAMENT_STATUS[status]
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  )
}

/** W / D / L / N pills for a standings form column. */
export function FormPills({ form }: { form: ('W' | 'D' | 'L' | 'N')[] }) {
  if (form.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  const styles = {
    W: 'bg-success/15 text-success',
    D: 'bg-muted text-muted-foreground',
    L: 'bg-destructive/15 text-destructive',
    N: 'bg-warning/15 text-warning',
  } as const

  return (
    <span className="flex items-center gap-1">
      {form.map((f, i) => (
        <span
          key={i}
          className={cn(
            'flex size-4 items-center justify-center rounded text-[9px] font-bold',
            styles[f],
          )}
          title={{ W: 'Win', D: 'Draw', L: 'Loss', N: 'No result' }[f]}
        >
          {f}
        </span>
      ))}
    </span>
  )
}
