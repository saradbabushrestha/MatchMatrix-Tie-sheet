import { cn } from '@/lib/utils'
import type { Match, SportConfig } from '@/types'
import { formatScoreline, formatSetBreakdown, formatInnings } from '@/engine'

/**
 * A match scoreline, rendered the way its sport is normally read.
 *
 * The shape comes entirely from `sport.scoringType`, so cricket shows 164/7,
 * badminton shows every game, and football shows a plain 2 - 1 — with no
 * sport-specific branching anywhere outside this component.
 */
export function ScoreDisplay({
  match,
  sport,
  size = 'md',
  showBreakdown = true,
  className,
}: {
  match: Match
  sport: SportConfig
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showBreakdown?: boolean
  className?: string
}) {
  const played =
    match.status === 'completed' || match.status === 'live' || match.status === 'walkover'

  if (match.status === 'walkover') {
    return (
      <span className={cn('text-xs font-medium uppercase tracking-wide text-warning', className)}>
        W/O
      </span>
    )
  }

  if (match.status === 'no_result') {
    return (
      <span className={cn('text-xs font-medium uppercase tracking-wide text-warning', className)}>
        No result
      </span>
    )
  }

  if (!played || !match.score) {
    return (
      <span className={cn('text-xs font-medium text-muted-foreground', className)}>vs</span>
    )
  }

  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-3xl',
  } as const

  const breakdown = showBreakdown ? formatSetBreakdown(match.score, sport) : []

  return (
    <span className={cn('flex flex-col items-center gap-0.5', className)}>
      <span className={cn('font-bold tnum leading-none', sizes[size])}>
        {formatScoreline(match.score, sport)}
      </span>
      {breakdown.length > 1 && (
        <span className="text-[10px] font-medium text-muted-foreground tnum">
          {breakdown.join('  ')}
        </span>
      )}
    </span>
  )
}

/** One side's score, for the two-column match card layout. */
export function SideScoreValue({
  match,
  side,
  sport,
  className,
}: {
  match: Match
  side: 'home' | 'away'
  sport: SportConfig
  className?: string
}) {
  if (match.status === 'walkover') {
    return (
      <span className={cn('text-sm font-semibold tnum', className)}>
        {match.walkoverWinner === side ? 'W' : 'L'}
      </span>
    )
  }

  if (!match.score || (match.status !== 'completed' && match.status !== 'live')) {
    return <span className={cn('text-sm text-muted-foreground', className)}>–</span>
  }

  const sideScore = match.score[side]
  const text =
    sport.scoringType === 'innings' ? formatInnings(sideScore) : String(sideScore.score)

  return <span className={cn('font-bold tnum', className)}>{text}</span>
}
