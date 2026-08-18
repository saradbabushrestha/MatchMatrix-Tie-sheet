/**
 * Scoring: creating, normalising and resolving match scores.
 *
 * This module is the only place that understands `ScoringType`. Everything
 * downstream — brackets, standings, exports — works from the resolved outcome
 * and the canonical `score` numbers, so no other file branches on sport.
 */

import type { Match, MatchScore, Outcome, Side, SideScore, SportConfig } from '@/types'

/** How many periods/sets a match has, honouring a tournament best-of override. */
export function periodCount(sport: SportConfig, bestOf?: number): number {
  if (sport.scoringType === 'sets' && bestOf && bestOf > 1) return bestOf
  if (sport.scoringType === 'sets' && bestOf === 1) return 1
  return sport.periods.count
}

/** Sets required to win, honouring a best-of override. */
export function setsToWin(sport: SportConfig, bestOf?: number): number {
  const count = periodCount(sport, bestOf)
  if (sport.periods.setsToWin && !bestOf) return sport.periods.setsToWin
  return Math.ceil(count / 2)
}

export function emptySideScore(periods: number): SideScore {
  return { score: 0, periods: Array.from({ length: periods }, () => 0), wickets: null, overs: null }
}

export function emptyScore(sport: SportConfig, bestOf?: number): MatchScore {
  const periods = periodCount(sport, bestOf)
  const base: MatchScore = {
    home: emptySideScore(periods),
    away: emptySideScore(periods),
    decider: null,
  }
  if (sport.scoringType === 'innings') {
    base.home.wickets = 0
    base.away.wickets = 0
    base.home.overs = 0
    base.away.overs = 0
  }
  return base
}

/**
 * Recompute derived fields so the stored score is always self-consistent.
 *
 * For set-based sports the aggregate `score` *is* the number of sets won, so it
 * is always derived from the per-set numbers rather than typed in — that is
 * what makes a volleyball match show "3 - 1" while badminton shows every game.
 */
export function normalizeScore(
  score: MatchScore,
  sport: SportConfig,
  bestOf?: number,
): MatchScore {
  const count = periodCount(sport, bestOf)

  const fit = (side: SideScore): SideScore => ({
    ...side,
    periods: Array.from({ length: count }, (_, i) => side.periods[i] ?? 0),
  })

  const home = fit(score.home)
  const away = fit(score.away)

  if (sport.scoringType === 'sets') {
    let hs = 0
    let as = 0
    for (let i = 0; i < count; i++) {
      // A set with 0–0 was never played; it must not count for either side.
      if (home.periods[i] === 0 && away.periods[i] === 0) continue
      if (home.periods[i] > away.periods[i]) hs++
      else if (away.periods[i] > home.periods[i]) as++
    }
    home.score = hs
    away.score = as
  } else if (sport.periods.count > 1 && sport.scoringType === 'aggregate') {
    // Halves/quarters sum to the final score when any period has been entered.
    const hasPeriods = home.periods.some((p) => p > 0) || away.periods.some((p) => p > 0)
    if (hasPeriods) {
      home.score = home.periods.reduce((a, b) => a + b, 0)
      away.score = away.periods.reduce((a, b) => a + b, 0)
    }
  }

  return { home, away, decider: score.decider }
}

/**
 * Who won. Returns 'draw' only when the sport permits it; when it does not and
 * the scores are level, returns null so the UI can insist on a decider.
 */
export function resolveOutcome(score: MatchScore | null, sport: SportConfig): Outcome {
  if (!score) return null
  const { home, away } = score

  if (home.score > away.score) return 'home'
  if (away.score > home.score) return 'away'

  // Level on the primary metric.
  if (sport.scoringType === 'innings' && home.wickets != null && away.wickets != null) {
    // Same runs: fewer wickets lost wins, matching normal cricket practice.
    if (home.wickets < away.wickets) return 'home'
    if (away.wickets < home.wickets) return 'away'
  }

  if (score.decider) {
    if (score.decider.home > score.decider.away) return 'home'
    if (score.decider.away > score.decider.home) return 'away'
  }

  return sport.allowsDraw ? 'draw' : null
}

/** Total sets won by each side — used by set-ratio tiebreakers. */
export function setsWon(score: MatchScore | null, sport: SportConfig): { home: number; away: number } {
  if (!score) return { home: 0, away: 0 }
  if (sport.scoringType !== 'sets') return { home: 0, away: 0 }
  return { home: score.home.score, away: score.away.score }
}

/** Total points scored across all sets — the "points for" of a set sport. */
export function rawPointsFor(score: MatchScore | null): { home: number; away: number } {
  if (!score) return { home: 0, away: 0 }
  return {
    home: score.home.periods.reduce((a, b) => a + b, 0),
    away: score.away.periods.reduce((a, b) => a + b, 0),
  }
}

/**
 * The headline score string for a match, formatted the way the sport is read.
 *
 *   football   → '2 - 1'
 *   basketball → '82 - 76'
 *   cricket    → '164/7 - 160/9'
 *   volleyball → '3 - 1'
 *   badminton  → '2 - 1'   (with the game scores shown separately)
 */
export function formatScoreline(score: MatchScore | null, sport: SportConfig): string {
  if (!score) return 'vs'
  if (sport.scoringType === 'innings') {
    return `${formatInnings(score.home)} - ${formatInnings(score.away)}`
  }
  const base = `${score.home.score} - ${score.away.score}`
  if (score.decider) return `${base} (${score.decider.home}-${score.decider.away} ${sport.drawResolutionLabel || 'dec'})`
  return base
}

export function formatInnings(side: SideScore): string {
  if (side.wickets == null) return String(side.score)
  return `${side.score}/${side.wickets}`
}

/** Per-set breakdown, e.g. ['21-18', '18-21', '21-16']. Empty for non-set sports. */
export function formatSetBreakdown(score: MatchScore | null, sport: SportConfig): string[] {
  if (!score || sport.scoringType !== 'sets') return []
  const out: string[] = []
  for (let i = 0; i < score.home.periods.length; i++) {
    const h = score.home.periods[i]
    const a = score.away.periods[i]
    if (h === 0 && a === 0) continue
    out.push(`${h}-${a}`)
  }
  return out
}

/** Is the score complete enough to be saved as a final result? */
export function validateScore(
  score: MatchScore,
  sport: SportConfig,
  bestOf?: number,
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const { home, away } = score

  const negatives = [...home.periods, ...away.periods, home.score, away.score].some((n) => n < 0)
  if (negatives) errors.push('Scores cannot be negative.')

  if (!Number.isFinite(home.score) || !Number.isFinite(away.score)) {
    errors.push('Scores must be numbers.')
  }

  if (sport.scoringType === 'sets') {
    const needed = setsToWin(sport, bestOf)
    const max = Math.max(home.score, away.score)
    if (max < needed) {
      errors.push(
        `Not enough ${sport.periods.label.toLowerCase()}s won yet — a winner needs ${needed}.`,
      )
    }
    if (home.score === away.score) {
      errors.push(`A ${sport.periods.label.toLowerCase()} tally cannot end level.`)
    }
    const playedSets = score.home.periods.filter((h, i) => h > 0 || score.away.periods[i] > 0).length
    if (playedSets === 0) errors.push(`Enter at least one ${sport.periods.label.toLowerCase()} score.`)
  }

  if (sport.scoringType === 'innings') {
    if (home.wickets != null && home.wickets > sport.teamSize - 1) {
      errors.push(`A side cannot lose more than ${sport.teamSize - 1} wickets.`)
    }
    if (away.wickets != null && away.wickets > sport.teamSize - 1) {
      errors.push(`A side cannot lose more than ${sport.teamSize - 1} wickets.`)
    }
  }

  if (!sport.allowsDraw && resolveOutcome(score, sport) === null) {
    errors.push(
      sport.drawResolution === 'none'
        ? 'This sport cannot end level — one side must win.'
        : `Scores are level. Enter the ${sport.drawResolutionLabel.toLowerCase()} result to decide the match.`,
    )
  }

  return { ok: errors.length === 0, errors }
}

/** The participant id of the winner, or null. */
export function winnerId(match: Match): string | null {
  if (match.walkoverWinner) return match.walkoverWinner === 'home' ? match.homeId : match.awayId
  if (match.outcome === 'home') return match.homeId
  if (match.outcome === 'away') return match.awayId
  return null
}

/** The participant id of the loser, or null. */
export function loserId(match: Match): string | null {
  if (match.walkoverWinner) return match.walkoverWinner === 'home' ? match.awayId : match.homeId
  if (match.outcome === 'home') return match.awayId
  if (match.outcome === 'away') return match.homeId
  return null
}

/** Has this match produced a decisive winner? */
export function isDecided(match: Match): boolean {
  if (match.status === 'walkover') return match.walkoverWinner != null
  if (match.status !== 'completed') return false
  return match.outcome === 'home' || match.outcome === 'away'
}

/** Does this match count towards standings? */
export function countsForStandings(match: Match): boolean {
  return (
    (match.status === 'completed' || match.status === 'walkover' || match.status === 'no_result') &&
    match.homeId != null &&
    match.awayId != null
  )
}

export const OTHER_SIDE: Record<Side, Side> = { home: 'away', away: 'home' }
