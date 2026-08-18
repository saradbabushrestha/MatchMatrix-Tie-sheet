import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Clock, MapPin, Trophy } from 'lucide-react'
import type { Match, Participant, SportConfig } from '@/types'
import { ParticipantAvatar } from '@/components/shared/ParticipantChip'
import { formatDateShort, formatTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import { NODE_HEIGHT, NODE_WIDTH } from './layout'

export interface MatchNodeData extends Record<string, unknown> {
  match: Match
  home: Participant | null
  away: Participant | null
  sport: SportConfig
  roundName: string
  venueName: string | null
  isChampionMatch: boolean
  onOpen: (match: Match) => void
}

export type MatchFlowNode = Node<MatchNodeData, 'match'>

/**
 * One match card in the bracket.
 *
 * Shows both sides with logo and score, the match number, and enough schedule
 * detail to be useful at a glance. Clicking opens the full match panel.
 */
export const MatchNode = memo(function MatchNode({ data, selected }: NodeProps<MatchFlowNode>) {
  const { match, home, away, sport, venueName, isChampionMatch, onOpen } = data

  const homeWon = match.outcome === 'home' || match.walkoverWinner === 'home'
  const awayWon = match.outcome === 'away' || match.walkoverWinner === 'away'
  const isLive = match.status === 'live'
  const isCancelled = match.status === 'cancelled'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(match)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(match)
        }
      }}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left shadow-card transition-all',
        'hover:border-primary/60 hover:shadow-pop',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
        isCancelled && 'opacity-45',
        isLive && 'border-destructive/60',
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />

      {/* Card header: match number and status */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-2 py-1">
        <span className="text-[10px] font-bold text-muted-foreground tnum">#{match.number}</span>
        {isChampionMatch && <Trophy className="size-3 text-warning" />}
        <span className="flex-1" />
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
            Live
          </span>
        )}
        {match.status === 'walkover' && (
          <span className="text-[10px] font-bold uppercase text-warning">W/O</span>
        )}
        {match.status === 'no_result' && (
          <span className="text-[10px] font-bold uppercase text-warning">No result</span>
        )}
        {match.isBye && (
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Bye</span>
        )}
        {match.date && !isLive && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {formatDateShort(match.date)}
            {match.time && ` · ${formatTime(match.time)}`}
          </span>
        )}
      </div>

      {/* Sides */}
      <div className="flex-1 divide-y divide-border/60">
        <SideRow
          participant={home}
          match={match}
          side="home"
          sport={sport}
          won={homeWon}
          lost={awayWon}
        />
        <SideRow
          participant={away}
          match={match}
          side="away"
          sport={sport}
          won={awayWon}
          lost={homeWon}
        />
      </div>

      {/* Footer: venue, only when there is one and space allows */}
      {venueName && (
        <div className="flex items-center gap-1 border-t border-border bg-muted/25 px-2 py-0.5">
          <MapPin className="size-2.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-[10px] text-muted-foreground">{venueName}</span>
        </div>
      )}

      {!match.date && !venueName && match.status === 'pending' && !match.isBye && (
        <div className="flex items-center gap-1 border-t border-border bg-muted/25 px-2 py-0.5">
          <Clock className="size-2.5 shrink-0 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Not scheduled</span>
        </div>
      )}
    </div>
  )
})

function SideRow({
  participant,
  match,
  side,
  sport,
  won,
  lost,
}: {
  participant: Participant | null
  match: Match
  side: 'home' | 'away'
  sport: SportConfig
  won: boolean
  lost: boolean
}) {
  const played = match.status === 'completed' || match.status === 'live'
  const value = match.score?.[side]

  const scoreText =
    match.status === 'walkover'
      ? match.walkoverWinner === side
        ? 'W'
        : 'L'
      : played && value
        ? sport.scoringType === 'innings'
          ? `${value.score}/${value.wickets ?? 0}`
          : String(value.score)
        : '–'

  // Set sports show the game scores under the tally, which is how they read.
  const breakdown =
    sport.scoringType === 'sets' && played && match.score
      ? match.score[side].periods
          .map((p, i) => ({ p, other: match.score?.[side === 'home' ? 'away' : 'home'].periods[i] ?? 0 }))
          .filter((x) => x.p > 0 || x.other > 0)
          .map((x) => x.p)
      : []

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1.5',
        won && 'bg-primary/6',
        lost && 'opacity-60',
      )}
    >
      <ParticipantAvatar participant={participant} size="xs" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs',
          won ? 'font-bold' : 'font-medium',
          !participant && 'italic text-muted-foreground',
        )}
      >
        {participant?.name ?? 'TBD'}
      </span>

      {participant?.seed != null && (
        <span className="shrink-0 text-[9px] font-semibold text-muted-foreground tnum">
          {participant.seed}
        </span>
      )}

      {breakdown.length > 0 && (
        <span className="shrink-0 text-[9px] text-muted-foreground tnum">
          {breakdown.join(' ')}
        </span>
      )}

      <span
        className={cn(
          'w-7 shrink-0 text-right text-xs tnum',
          won ? 'font-bold text-foreground' : 'font-medium text-muted-foreground',
        )}
      >
        {scoreText}
      </span>
    </div>
  )
}
