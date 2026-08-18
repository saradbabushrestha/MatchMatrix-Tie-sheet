import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ParticipantAvatar } from '@/components/shared/ParticipantChip'
import { emptyScore, normalizeScore, periodCount, setsToWin } from '@/engine/scoring'
import type { MatchScore, Participant, SportConfig } from '@/types'
import { cn } from '@/lib/utils'

/**
 * Score entry, driven entirely by the sport configuration.
 *
 * There is no `if (football)` here: the sport's `scoringType` selects one of
 * three input shapes, and its period config decides how many boxes appear and
 * what they are called.
 */
export function ScoreEntry({
  sport,
  bestOf,
  home,
  away,
  value,
  onChange,
}: {
  sport: SportConfig
  bestOf: number
  home: Participant | null
  away: Participant | null
  value: MatchScore | null
  onChange: (score: MatchScore) => void
}) {
  const count = periodCount(sport, bestOf)
  const [score, setScore] = useState<MatchScore>(() => value ?? emptyScore(sport, bestOf))

  // Re-seed when the caller switches match, or the sport's shape changes.
  useEffect(() => {
    setScore(value ?? emptyScore(sport, bestOf))
  }, [value, sport, bestOf])

  function push(next: MatchScore) {
    const normalized = normalizeScore(next, sport, bestOf)
    setScore(normalized)
    onChange(normalized)
  }

  function setSide(side: 'home' | 'away', patch: Partial<MatchScore['home']>) {
    push({ ...score, [side]: { ...score[side], ...patch } })
  }

  function setPeriod(side: 'home' | 'away', index: number, next: number) {
    const periods = score[side].periods.slice()
    periods[index] = Math.max(0, next)
    setSide(side, { periods })
  }

  const level = score.home.score === score.away.score
  const needsDecider = !sport.allowsDraw && level && sport.drawResolution !== 'none'

  return (
    <div className="space-y-5">
      {/* Headline scores */}
      {sport.scoringType === 'sets' ? (
        <SetsEntry
          sport={sport}
          count={count}
          bestOf={bestOf}
          home={home}
          away={away}
          score={score}
          onPeriod={setPeriod}
        />
      ) : sport.scoringType === 'innings' ? (
        <InningsEntry sport={sport} home={home} away={away} score={score} onSide={setSide} />
      ) : (
        <AggregateEntry
          sport={sport}
          count={count}
          home={home}
          away={away}
          score={score}
          onSide={setSide}
          onPeriod={setPeriod}
        />
      )}

      {/* Decider, only when the sport cannot end level and the score is level */}
      {needsDecider && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/8 p-3">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Level</Badge>
            <p className="text-sm font-medium">
              {sport.drawResolutionLabel} decides this match
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <NumberBox
              label={home?.shortName ?? 'Home'}
              value={score.decider?.home ?? 0}
              onChange={(n) =>
                push({
                  ...score,
                  decider: { home: n, away: score.decider?.away ?? 0 },
                })
              }
            />
            <span className="pt-5 text-muted-foreground">–</span>
            <NumberBox
              label={away?.shortName ?? 'Away'}
              value={score.decider?.away ?? 0}
              onChange={(n) =>
                push({
                  ...score,
                  decider: { home: score.decider?.home ?? 0, away: n },
                })
              }
            />
          </div>
        </div>
      )}

      {score.decider && !needsDecider && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => push({ ...score, decider: null })}
        >
          Clear the {sport.drawResolutionLabel.toLowerCase()} result
        </Button>
      )}
    </div>
  )
}

/* ── Aggregate: football, futsal, basketball, custom ─────────────────────── */

function AggregateEntry({
  sport,
  count,
  home,
  away,
  score,
  onSide,
  onPeriod,
}: {
  sport: SportConfig
  count: number
  home: Participant | null
  away: Participant | null
  score: MatchScore
  onSide: (side: 'home' | 'away', patch: Partial<MatchScore['home']>) => void
  onPeriod: (side: 'home' | 'away', index: number, next: number) => void
}) {
  const [showPeriods, setShowPeriods] = useState(
    () => score.home.periods.some((p) => p > 0) || score.away.periods.some((p) => p > 0),
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SideStepper
          participant={home}
          value={score.home.score}
          onChange={(score_) => onSide('home', { score: score_ })}
          disabled={showPeriods}
        />
        <span className="text-xl font-light text-muted-foreground">–</span>
        <SideStepper
          participant={away}
          value={score.away.score}
          onChange={(score_) => onSide('away', { score: score_ })}
          disabled={showPeriods}
        />
      </div>

      {count > 1 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPeriods((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showPeriods
              ? `Enter the total instead`
              : `Break the score down by ${sport.periods.label.toLowerCase()}`}
          </button>

          {showPeriods && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                The total is added up from the {sport.periods.label.toLowerCase()}s below.
              </p>
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <NumberBox
                    label={i === 0 ? (home?.shortName ?? 'Home') : ''}
                    value={score.home.periods[i] ?? 0}
                    onChange={(n) => onPeriod('home', i, n)}
                  />
                  <span className="min-w-[72px] pt-1 text-center text-xs font-medium text-muted-foreground">
                    {sport.periods.label} {i + 1}
                  </span>
                  <NumberBox
                    label={i === 0 ? (away?.shortName ?? 'Away') : ''}
                    value={score.away.periods[i] ?? 0}
                    onChange={(n) => onPeriod('away', i, n)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Sets: volleyball, badminton, tennis, table tennis, esports ──────────── */

function SetsEntry({
  sport,
  count,
  bestOf,
  home,
  away,
  score,
  onPeriod,
}: {
  sport: SportConfig
  count: number
  bestOf: number
  home: Participant | null
  away: Participant | null
  score: MatchScore
  onPeriod: (side: 'home' | 'away', index: number, next: number) => void
}) {
  const needed = setsToWin(sport, bestOf)
  const label = sport.periods.label
  const target = sport.periods.pointsPerSet

  // Once a side has enough sets, later boxes are dead — grey them out.
  const decidedAt = useMemo(() => {
    let hs = 0
    let as = 0
    for (let i = 0; i < count; i++) {
      const h = score.home.periods[i] ?? 0
      const a = score.away.periods[i] ?? 0
      if (h === 0 && a === 0) continue
      if (h > a) hs++
      else if (a > h) as++
      if (hs === needed || as === needed) return i
    }
    return null
  }, [score, count, needed])

  return (
    <div className="space-y-4">
      {/* Set tally, derived — not editable */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SideTally participant={home} value={score.home.score} winner={score.home.score >= needed} />
        <div className="text-center">
          <p className="text-xl font-light text-muted-foreground">–</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}s
          </p>
        </div>
        <SideTally participant={away} value={score.away.score} winner={score.away.score >= needed} />
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">
            {label} scores
            {target ? ` · first to ${target}` : ''}
          </p>
          <Badge variant="muted">
            Best of {count} · first to {needed}
          </Badge>
        </div>

        {Array.from({ length: count }, (_, i) => {
          const dead = decidedAt != null && i > decidedAt
          return (
            <div
              key={i}
              className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-3', dead && 'opacity-40')}
            >
              <NumberBox
                label={i === 0 ? (home?.shortName ?? 'Home') : ''}
                value={score.home.periods[i] ?? 0}
                onChange={(n) => onPeriod('home', i, n)}
                disabled={dead}
              />
              <span className="min-w-[72px] pt-1 text-center text-xs font-medium text-muted-foreground">
                {label} {i + 1}
              </span>
              <NumberBox
                label={i === 0 ? (away?.shortName ?? 'Away') : ''}
                value={score.away.periods[i] ?? 0}
                onChange={(n) => onPeriod('away', i, n)}
                disabled={dead}
              />
            </div>
          )
        })}

        <p className="text-xs text-muted-foreground">
          Leave a {label.toLowerCase()} at 0–0 if it was not played.
        </p>
      </div>
    </div>
  )
}

/* ── Innings: cricket ────────────────────────────────────────────────────── */

function InningsEntry({
  sport,
  home,
  away,
  score,
  onSide,
}: {
  sport: SportConfig
  home: Participant | null
  away: Participant | null
  score: MatchScore
  onSide: (side: 'home' | 'away', patch: Partial<MatchScore['home']>) => void
}) {
  const maxWickets = Math.max(1, sport.teamSize - 1)

  return (
    <div className="space-y-3">
      {(['home', 'away'] as const).map((side) => {
        const participant = side === 'home' ? home : away
        const value = score[side]
        return (
          <div key={side} className="rounded-lg border border-border p-3">
            <div className="mb-3 flex items-center gap-2">
              <ParticipantAvatar participant={participant} size="sm" />
              <p className="truncate text-sm font-semibold">
                {participant?.name ?? (side === 'home' ? 'Home' : 'Away')}
              </p>
              <span className="ml-auto text-lg font-bold tnum">
                {value.score}/{value.wickets ?? 0}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberBox
                label="Runs"
                value={value.score}
                onChange={(n) => onSide(side, { score: n })}
              />
              <NumberBox
                label="Wickets"
                value={value.wickets ?? 0}
                max={maxWickets}
                onChange={(n) => onSide(side, { wickets: Math.min(maxWickets, n) })}
              />
              <NumberBox
                label="Overs"
                value={value.overs ?? 0}
                step={0.1}
                onChange={(n) => onSide(side, { overs: n })}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Overs are used to work out net run rate in the standings.
            </p>
          </div>
        )
      })}
    </div>
  )
}

/* ── Small inputs ────────────────────────────────────────────────────────── */

function SideStepper({
  participant,
  value,
  onChange,
  disabled,
}: {
  participant: Participant | null
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-1.5">
        <ParticipantAvatar participant={participant} size="sm" />
        <span className="truncate text-xs font-medium">
          {participant?.shortName ?? '—'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          aria-label="Decrease score"
        >
          <Minus />
        </Button>
        <Input
          type="number"
          min={0}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-11 text-center text-xl font-bold tnum"
          aria-label={`${participant?.name ?? 'Side'} score`}
        />
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          aria-label="Increase score"
        >
          <Plus />
        </Button>
      </div>
    </div>
  )
}

function SideTally({
  participant,
  value,
  winner,
}: {
  participant: Participant | null
  value: number
  winner: boolean
}) {
  return (
    <div className="space-y-1 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <ParticipantAvatar participant={participant} size="sm" />
        <span className="truncate text-xs font-medium">{participant?.shortName ?? '—'}</span>
      </div>
      <p
        className={cn(
          'text-3xl font-bold tnum leading-none',
          winner ? 'text-primary' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function NumberBox({
  label,
  value,
  onChange,
  max,
  step,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      {label ? (
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      ) : (
        <span className="block h-[13px]" aria-hidden />
      )}
      <Input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0)
        }}
        className="h-9 text-center font-semibold tnum"
        aria-label={label || 'Score'}
      />
    </div>
  )
}
