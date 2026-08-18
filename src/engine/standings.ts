/**
 * Standings computation.
 *
 * Every canonical statistic is computed for every sport — it is cheap, and it
 * means a sport config only has to *choose* which columns to show and which
 * order to break ties in. No sport-specific code paths.
 */

import type {
  FormatConfig,
  Group,
  Match,
  Participant,
  SportConfig,
  StandingsRow,
  StandingsTable,
  StatKey,
  Tiebreaker,
} from '@/types'
import { countsForStandings, rawPointsFor } from './scoring'

function blankRow(participant: Participant): StandingsRow {
  return {
    participant,
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    noResult: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    scoreDiff: 0,
    setsFor: 0,
    setsAgainst: 0,
    setsDiff: 0,
    points: 0,
    winPct: 0,
    nrr: 0,
    streak: 0,
    form: [],
    qualified: false,
  }
}

/** Effective points rule, with tournament overrides applied. */
export function effectivePoints(sport: SportConfig, config: FormatConfig) {
  return {
    win: config.pointsWin ?? sport.pointsRule.win,
    draw: config.pointsDraw ?? sport.pointsRule.draw,
    loss: config.pointsLoss ?? sport.pointsRule.loss,
    noResult: sport.pointsRule.noResult ?? 0,
    walkover: sport.pointsRule.walkover ?? config.pointsWin ?? sport.pointsRule.win,
  }
}

/**
 * Compute a standings table.
 *
 * Only completed/walkover/no-result matches with both slots filled count, so a
 * half-played league ranks correctly rather than showing everyone on zero.
 */
export function computeStandings(
  participants: readonly Participant[],
  matches: readonly Match[],
  sport: SportConfig,
  config: FormatConfig,
  options: { groupId?: string | null; advanceCount?: number } = {},
): StandingsTable {
  const pts = effectivePoints(sport, config)
  const rows = new Map<string, StandingsRow>()
  for (const p of participants) rows.set(p.id, blankRow(p))

  const relevant = matches
    .filter(countsForStandings)
    .filter((m) => (options.groupId === undefined ? true : m.groupId === (options.groupId ?? null)))
    // Chronological where possible, so `form` and `streak` are meaningful.
    .sort((a, b) => a.number - b.number)

  // Cricket net run rate needs runs and overs on both sides of the ledger.
  const nrrAcc = new Map<string, { runsFor: number; oversFor: number; runsAgainst: number; oversAgainst: number }>()
  const h2h = new Map<string, Map<string, number>>()

  for (const match of relevant) {
    const home = rows.get(match.homeId as string)
    const away = rows.get(match.awayId as string)
    if (!home || !away) continue

    if (match.status === 'no_result') {
      home.played++
      away.played++
      home.noResult++
      away.noResult++
      home.points += pts.noResult
      away.points += pts.noResult
      home.form.push('N')
      away.form.push('N')
      continue
    }

    const score = match.score
    const homeScore = score?.home.score ?? 0
    const awayScore = score?.away.score ?? 0

    home.played++
    away.played++

    if (sport.scoringType === 'sets') {
      // Sets won are the primary metric; raw points feed the finer tiebreakers.
      home.setsFor += homeScore
      home.setsAgainst += awayScore
      away.setsFor += awayScore
      away.setsAgainst += homeScore
      const raw = rawPointsFor(score)
      home.scoreFor += raw.home
      home.scoreAgainst += raw.away
      away.scoreFor += raw.away
      away.scoreAgainst += raw.home
    } else {
      home.scoreFor += homeScore
      home.scoreAgainst += awayScore
      away.scoreFor += awayScore
      away.scoreAgainst += homeScore
    }

    if (sport.scoringType === 'innings' && score) {
      const acc = (id: string) =>
        nrrAcc.get(id) ?? { runsFor: 0, oversFor: 0, runsAgainst: 0, oversAgainst: 0 }
      const ha = acc(home.participant.id)
      const aa = acc(away.participant.id)
      ha.runsFor += score.home.score
      ha.oversFor += score.home.overs ?? 0
      ha.runsAgainst += score.away.score
      ha.oversAgainst += score.away.overs ?? 0
      aa.runsFor += score.away.score
      aa.oversFor += score.away.overs ?? 0
      aa.runsAgainst += score.home.score
      aa.oversAgainst += score.home.overs ?? 0
      nrrAcc.set(home.participant.id, ha)
      nrrAcc.set(away.participant.id, aa)
    }

    const winner = match.walkoverWinner ?? match.outcome
    const awardPoints = match.status === 'walkover' ? pts.walkover : pts.win

    if (winner === 'home') {
      home.won++
      away.lost++
      home.points += awardPoints
      away.points += pts.loss
      home.form.push('W')
      away.form.push('L')
      home.streak = home.streak >= 0 ? home.streak + 1 : 1
      away.streak = away.streak <= 0 ? away.streak - 1 : -1
      bumpH2H(h2h, home.participant.id, away.participant.id, 1)
    } else if (winner === 'away') {
      away.won++
      home.lost++
      away.points += awardPoints
      home.points += pts.loss
      away.form.push('W')
      home.form.push('L')
      away.streak = away.streak >= 0 ? away.streak + 1 : 1
      home.streak = home.streak <= 0 ? home.streak - 1 : -1
      bumpH2H(h2h, away.participant.id, home.participant.id, 1)
    } else {
      home.drawn++
      away.drawn++
      home.points += pts.draw
      away.points += pts.draw
      home.form.push('D')
      away.form.push('D')
      home.streak = 0
      away.streak = 0
    }
  }

  // Derived figures.
  for (const row of rows.values()) {
    row.scoreDiff = row.scoreFor - row.scoreAgainst
    row.setsDiff = row.setsFor - row.setsAgainst
    row.winPct = row.played > 0 ? row.won / row.played : 0
    row.form = row.form.slice(-5)

    const acc = nrrAcc.get(row.participant.id)
    if (acc) {
      const scoringRate = acc.oversFor > 0 ? acc.runsFor / acc.oversFor : 0
      const concededRate = acc.oversAgainst > 0 ? acc.runsAgainst / acc.oversAgainst : 0
      row.nrr = Number((scoringRate - concededRate).toFixed(3))
    }
  }

  const sorted = rankRows(Array.from(rows.values()), sport.tiebreakers, h2h)
  sorted.forEach((row, i) => {
    row.position = i + 1
    row.qualified = options.advanceCount ? i < options.advanceCount : false
  })

  return {
    groupId: options.groupId ?? null,
    groupName: null,
    rows: sorted,
    columns: sport.standingsColumns,
    advanceCount: options.advanceCount ?? 0,
  }
}

function bumpH2H(map: Map<string, Map<string, number>>, winner: string, loser: string, by: number) {
  const inner = map.get(winner) ?? new Map<string, number>()
  inner.set(loser, (inner.get(loser) ?? 0) + by)
  map.set(winner, inner)
}

/** Apply the sport's tiebreaker chain. */
export function rankRows(
  rows: StandingsRow[],
  tiebreakers: readonly Tiebreaker[],
  h2h: Map<string, Map<string, number>>,
): StandingsRow[] {
  return rows.slice().sort((a, b) => {
    for (const tb of tiebreakers) {
      const result = compareBy(a, b, tb, h2h)
      if (result !== 0) return result
    }
    return a.participant.name.localeCompare(b.participant.name)
  })
}

function compareBy(
  a: StandingsRow,
  b: StandingsRow,
  tb: Tiebreaker,
  h2h: Map<string, Map<string, number>>,
): number {
  const dir = tb.dir === 'asc' ? 1 : -1

  if (tb.key === 'name') {
    return a.participant.name.localeCompare(b.participant.name) * dir
  }
  if (tb.key === 'seed') {
    const as = a.participant.seed ?? Number.MAX_SAFE_INTEGER
    const bs = b.participant.seed ?? Number.MAX_SAFE_INTEGER
    return (as - bs) * dir
  }
  if (tb.key === 'headToHead') {
    const aWins = h2h.get(a.participant.id)?.get(b.participant.id) ?? 0
    const bWins = h2h.get(b.participant.id)?.get(a.participant.id) ?? 0
    return (aWins - bWins) * dir
  }

  const av = a[tb.key as keyof StandingsRow] as number
  const bv = b[tb.key as keyof StandingsRow] as number
  if (typeof av !== 'number' || typeof bv !== 'number') return 0
  return (av - bv) * dir
}

/** Compute one table per group, in group order. */
export function computeGroupStandings(
  participants: readonly Participant[],
  matches: readonly Match[],
  groups: readonly Group[],
  sport: SportConfig,
  config: FormatConfig,
): StandingsTable[] {
  return groups
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((group) => {
      const members = participants.filter((p) => p.groupId === group.id)
      const table = computeStandings(members, matches, sport, config, {
        groupId: group.id,
        advanceCount: config.advancePerGroup,
      })
      return { ...table, groupName: group.name }
    })
}

/** Format a stat value the way its column expects. */
export function formatStat(value: number, key: StatKey): string {
  switch (key) {
    case 'scoreDiff':
    case 'setsDiff':
    case 'streak':
      return value > 0 ? `+${value}` : String(value)
    case 'winPct':
      return value.toFixed(3).replace(/^0/, '')
    case 'nrr':
      return value > 0 ? `+${value.toFixed(3)}` : value.toFixed(3)
    default:
      return String(value)
  }
}

/**
 * Top performers for the dashboard: best attack, best defence, longest streak.
 * Derived from standings so it works for any sport without extra bookkeeping.
 */
export interface Leader {
  label: string
  participant: Participant
  value: string
}

export function topPerformers(table: StandingsTable, sport: SportConfig): Leader[] {
  const played = table.rows.filter((r) => r.played > 0)
  if (played.length === 0) return []

  const out: Leader[] = []
  const nounPlural = sport.scoreNoun[1]

  const bestAttack = played.reduce((best, r) => (r.scoreFor > best.scoreFor ? r : best))
  out.push({
    label: `Most ${nounPlural}`,
    participant: bestAttack.participant,
    value: `${bestAttack.scoreFor}`,
  })

  const bestDefence = played.reduce((best, r) => (r.scoreAgainst < best.scoreAgainst ? r : best))
  out.push({
    label: `Fewest ${nounPlural} conceded`,
    participant: bestDefence.participant,
    value: `${bestDefence.scoreAgainst}`,
  })

  const bestStreak = played.reduce((best, r) => (r.streak > best.streak ? r : best))
  if (bestStreak.streak > 1) {
    out.push({
      label: 'Longest win streak',
      participant: bestStreak.participant,
      value: `${bestStreak.streak} wins`,
    })
  }

  return out
}
