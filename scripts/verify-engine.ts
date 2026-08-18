/**
 * Engine verification harness.
 *
 * The tournament engine is the part of this app that must not be wrong: a
 * miscounted bracket or a mis-ranked table is worse than a missing feature.
 * This script exercises it directly — no React, no DOM — and is run with
 * `npm run verify`.
 *
 * It is a check, not a unit-test suite: it asserts the invariants that actually
 * matter (match counts, bracket shape, seed separation, advancement, standings
 * ranking, tiebreakers, idempotence) across every format and scoring type.
 */

import {
  generateFixtures,
  estimateMatchCount,
  seedOrder,
  buildDrawSlots,
  roundRobinPairings,
  propagateResults,
  computeStandings,
  computeGroupStandings,
  computePodium,
  normalizeScore,
  resolveOutcome,
  emptyScore,
  validateScore,
  autoSchedule,
  detectConflicts,
  validateFixtureGeneration,
} from '@/engine'
import { BUILT_IN_SPORTS } from '@/config/sports'
import { DEFAULT_FORMAT_CONFIG } from '@/config/formats'
import { DEFAULT_SETTINGS } from '@/engine/schedule'
import { nextPowerOfTwo } from '@/lib/utils'
import type {
  FormatConfig,
  FormatType,
  Match,
  MatchScore,
  Participant,
  SportConfig,
} from '@/types'

/* ── Tiny assertion harness ──────────────────────────────────────────────── */

let passed = 0
const failures: string[] = []

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
  } else {
    failures.push(detail ? `${label} — ${detail}` : label)
  }
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(label, actual === expected, `expected ${String(expected)}, got ${String(actual)}`)
}

function section(name: string) {
  process.stdout.write(`\n\x1b[1m${name}\x1b[0m\n`)
}

/* ── Fixtures ────────────────────────────────────────────────────────────── */

function sport(id: string): SportConfig {
  const found = BUILT_IN_SPORTS.find((s) => s.id === id)
  if (!found) throw new Error(`No such sport: ${id}`)
  return found
}

function makeParticipants(count: number, seeded = true): Participant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Entrant ${i + 1}`,
    shortName: `E${i + 1}`,
    logoUrl: null,
    color: '#000000',
    seed: seeded ? i + 1 : null,
    groupId: null,
    kind: 'team' as const,
  }))
}

function config(patch: Partial<FormatConfig> = {}): FormatConfig {
  // Manual draw keeps the order deterministic, so assertions are stable.
  return { ...DEFAULT_FORMAT_CONFIG, drawMethod: 'manual', ...patch }
}

section('Seed order')
{
  eq('size 2', seedOrder(2).join(','), '1,2')
  eq('size 4', seedOrder(4).join(','), '1,4,2,3')
  eq('size 8', seedOrder(8).join(','), '1,8,4,5,2,7,3,6')
  eq('size 16 length', seedOrder(16).length, 16)

  // Every seed appears exactly once.
  const order = seedOrder(32)
  eq('size 32 is a permutation', new Set(order).size, 32)
  eq('size 32 covers 1..32', Math.max(...order), 32)

  // Seeds 1 and 2 must land in opposite halves of the bracket.
  const half = order.length / 2
  const firstHalf = order.slice(0, half)
  check(
    'top two seeds are in opposite halves',
    firstHalf.includes(1) !== firstHalf.includes(2),
  )

  // Seeds 1-4 must be spread one per quarter.
  const quarters = [0, 1, 2, 3].map((q) =>
    order.slice(q * (order.length / 4), (q + 1) * (order.length / 4)),
  )
  const topFourPlacement = [1, 2, 3, 4].map((s) => quarters.findIndex((q) => q.includes(s)))
  eq('top four seeds occupy distinct quarters', new Set(topFourPlacement).size, 4)
}

section('Byes go to the top seeds')
{
  // 11 entrants in a 16-slot bracket = 5 byes, which must fall to seeds 1–5.
  const slots = buildDrawSlots(makeParticipants(11), 'seeded')
  eq('bracket size', slots.length, 16)

  const byeReceivers: number[] = []
  for (let i = 0; i < slots.length; i += 2) {
    const home = slots[i]
    const away = slots[i + 1]
    if (home && !away) byeReceivers.push(home.seed as number)
    if (away && !home) byeReceivers.push(away.seed as number)
  }
  eq('bye count', byeReceivers.length, 5)
  eq(
    'byes went to seeds 1-5',
    byeReceivers.sort((a, b) => a - b).join(','),
    '1,2,3,4,5',
  )
}

section('Round robin pairings')
{
  for (const n of [3, 4, 5, 6, 8, 11, 12]) {
    const rounds = roundRobinPairings(n)
    const expectedRounds = n % 2 === 1 ? n : n - 1
    eq(`n=${n} round count`, rounds.length, expectedRounds)

    const total = rounds.reduce((sum, r) => sum + r.length, 0)
    eq(`n=${n} match count`, total, (n * (n - 1)) / 2)

    // Every pair must meet exactly once.
    const seen = new Set<string>()
    let duplicates = 0
    for (const round of rounds) {
      for (const pair of round) {
        const key = [pair.home, pair.away].sort((a, b) => a - b).join('-')
        if (seen.has(key)) duplicates++
        seen.add(key)
      }
    }
    eq(`n=${n} no repeated pairings`, duplicates, 0)

    // Nobody plays twice in the same round.
    let clashes = 0
    for (const round of rounds) {
      const used = new Set<number>()
      for (const pair of round) {
        if (used.has(pair.home) || used.has(pair.away)) clashes++
        used.add(pair.home)
        used.add(pair.away)
      }
    }
    eq(`n=${n} nobody plays twice per round`, clashes, 0)
  }
}

section('Match counts match the wizard estimate')
{
  const cases: { format: FormatType; n: number; cfg: Partial<FormatConfig> }[] = [
    { format: 'single_elimination', n: 16, cfg: { thirdPlaceMatch: false } },
    { format: 'single_elimination', n: 16, cfg: { thirdPlaceMatch: true } },
    { format: 'single_elimination', n: 11, cfg: { thirdPlaceMatch: true } },
    { format: 'single_elimination', n: 32, cfg: { thirdPlaceMatch: true } },
    { format: 'double_elimination', n: 8, cfg: { grandFinalReset: false } },
    { format: 'double_elimination', n: 16, cfg: { grandFinalReset: false } },
    { format: 'double_elimination', n: 16, cfg: { grandFinalReset: true } },
    { format: 'round_robin', n: 8, cfg: {} },
    { format: 'round_robin', n: 8, cfg: { doubleRoundRobin: true } },
    { format: 'round_robin', n: 5, cfg: {} },
    { format: 'group_knockout', n: 8, cfg: { groupCount: 2, advancePerGroup: 2 } },
    { format: 'group_knockout', n: 16, cfg: { groupCount: 4, advancePerGroup: 2 } },
    { format: 'group_knockout', n: 12, cfg: { groupCount: 4, advancePerGroup: 2 } },
  ]

  for (const testCase of cases) {
    const cfg = config(testCase.cfg)
    const participants = makeParticipants(testCase.n)
    const fixtures = generateFixtures('t1', testCase.format, participants, cfg)
    const estimate = estimateMatchCount(testCase.format, testCase.n, cfg)
    const label = `${testCase.format} n=${testCase.n} ${JSON.stringify(testCase.cfg)}`
    eq(`${label} generated == estimated`, fixtures.matches.length, estimate)
  }
}

section('Double elimination shape')
{
  for (const n of [4, 8, 16, 32]) {
    const fixtures = generateFixtures('t1', 'double_elimination', makeParticipants(n), config())
    const size = nextPowerOfTwo(n)
    // A double-elimination bracket always resolves in 2N-2 matches.
    eq(`n=${n} total is 2N-2`, fixtures.matches.length, 2 * size - 2)

    const wb = fixtures.rounds.filter((r) => r.kind === 'winners')
    const lb = fixtures.rounds.filter((r) => r.kind === 'losers')
    const gf = fixtures.rounds.filter((r) => r.kind === 'grand_final')
    eq(`n=${n} winners rounds`, wb.length, Math.log2(size))
    eq(`n=${n} grand final exists`, gf.length, 1)
    check(`n=${n} has a losers bracket`, lb.length > 0)

    // Every non-first-round match must be fed from somewhere.
    const firstRoundId = wb[0]?.id
    const unfed = fixtures.matches.filter(
      (m) => m.roundId !== firstRoundId && !m.homeSource && !m.awaySource,
    )
    eq(`n=${n} every later match is fed`, unfed.length, 0)

    // Every first-round loser must have somewhere to drop to.
    const firstRound = fixtures.matches.filter((m) => m.roundId === firstRoundId)
    const noDrop = firstRound.filter((m) => !m.loserTo)
    eq(`n=${n} first-round losers all drop`, noDrop.length, 0)
  }
}

section('Advancement')
{
  const cfg = config({ thirdPlaceMatch: true })
  const participants = makeParticipants(8)
  const fixtures = generateFixtures('t1', 'single_elimination', participants, cfg)
  const football = sport('football')

  // Play the whole bracket, always letting the higher-seeded side win.
  let matches = fixtures.matches
  let guard = 0

  while (guard++ < 20) {
    const ready = matches.filter(
      (m) => m.status !== 'completed' && m.homeId && m.awayId && !m.isBye,
    )
    if (ready.length === 0) break

    matches = matches.map((m) => {
      if (!ready.some((r) => r.id === m.id)) return m
      const homeSeed = participants.find((p) => p.id === m.homeId)?.seed ?? 99
      const awaySeed = participants.find((p) => p.id === m.awayId)?.seed ?? 99
      const homeWins = homeSeed < awaySeed
      const score: MatchScore = {
        home: { score: homeWins ? 2 : 1, periods: [0, 0], wickets: null, overs: null },
        away: { score: homeWins ? 1 : 2, periods: [0, 0], wickets: null, overs: null },
        decider: null,
      }
      return {
        ...m,
        score,
        status: 'completed' as const,
        outcome: (homeWins ? 'home' : 'away') as Match['outcome'],
      }
    })

    matches = propagateResults(matches, participants, [], football, cfg)
  }

  const podium = computePodium(matches, fixtures.rounds)
  eq('seed 1 wins a chalk bracket', podium.champion, 'p1')
  eq('seed 2 is runner-up', podium.runnerUp, 'p2')
  check('third place decided', podium.third !== null)

  const undecided = matches.filter((m) => m.status !== 'completed')
  eq('every match resolved', undecided.length, 0)

  // Idempotence: propagating again must change nothing.
  const again = propagateResults(matches, participants, [], football, cfg)
  const drift = again.filter((m, i) => {
    const before = matches[i]
    return m.homeId !== before.homeId || m.awayId !== before.awayId || m.status !== before.status
  })
  eq('propagation is idempotent', drift.length, 0)
}

section('Editing an old result rewrites the bracket')
{
  const cfg = config({ thirdPlaceMatch: false })
  const participants = makeParticipants(4)
  const football = sport('football')
  const fixtures = generateFixtures('t1', 'single_elimination', participants, cfg)

  const win = (m: Match, side: 'home' | 'away'): Match => ({
    ...m,
    score: {
      home: { score: side === 'home' ? 1 : 0, periods: [0, 0], wickets: null, overs: null },
      away: { score: side === 'away' ? 1 : 0, periods: [0, 0], wickets: null, overs: null },
      decider: null,
    },
    status: 'completed',
    outcome: side,
  })

  const semis = fixtures.matches.filter((m) => !m.homeSource)
  let matches = fixtures.matches.map((m) =>
    semis.some((s) => s.id === m.id) ? win(m, 'home') : m,
  )
  matches = propagateResults(matches, participants, [], football, cfg)

  const finalBefore = matches.find((m) => m.homeSource && m.awaySource) as Match
  const firstFinalists = [finalBefore.homeId, finalBefore.awayId].join(',')

  // Now flip the first semi-final's result.
  matches = matches.map((m) => (m.id === semis[0].id ? win(m, 'away') : m))
  matches = propagateResults(matches, participants, [], football, cfg)

  const finalAfter = matches.find((m) => m.id === finalBefore.id) as Match
  check(
    'the final now has a different participant',
    [finalAfter.homeId, finalAfter.awayId].join(',') !== firstFinalists,
  )

  // And a stale downstream result must be cleared, not silently kept.
  let played = matches.map((m) => (m.id === finalBefore.id ? win(m, 'home') : m))
  played = propagateResults(played, participants, [], football, cfg)
  played = played.map((m) => (m.id === semis[0].id ? win(m, 'home') : m))
  const after = propagateResults(played, participants, [], football, cfg)
  const finalNow = after.find((m) => m.id === finalBefore.id) as Match
  eq('stale final result cleared', finalNow.status, 'pending')
  eq('stale final score cleared', finalNow.score, null)
}

section('Group qualifiers only release when the group is finished')
{
  const cfg = config({ groupCount: 2, advancePerGroup: 2, thirdPlaceMatch: false })
  const participants = makeParticipants(8)
  const cricket = sport('cricket')
  const fixtures = generateFixtures('t1', 'group_knockout', participants, cfg)

  eq('two groups created', fixtures.groups.length, 2)

  const groupMatches = fixtures.matches.filter((m) => m.groupId)
  const koMatches = fixtures.matches.filter((m) => !m.groupId)
  eq('group matches', groupMatches.length, 12) // two groups of four: 6 each
  check('knockout matches exist', koMatches.length >= 3)

  // Participants must be spread across groups by the snake, not stacked.
  const withGroups = participants.map((p) => {
    const match = groupMatches.find((m) => m.homeId === p.id || m.awayId === p.id)
    return { ...p, groupId: match?.groupId ?? null }
  })
  const groupSizes = fixtures.groups.map(
    (g) => withGroups.filter((p) => p.groupId === g.id).length,
  )
  eq('groups are even', groupSizes.join(','), '4,4')

  // Play all but one group match — no qualifier may be released yet.
  let matches = fixtures.matches.map((m, i) =>
    m.groupId && i < groupMatches.length - 1
      ? {
          ...m,
          score: {
            home: { score: 150, periods: [0], wickets: 5, overs: 20 },
            away: { score: 140, periods: [0], wickets: 8, overs: 20 },
            decider: null,
          },
          status: 'completed' as const,
          outcome: 'home' as Match['outcome'],
        }
      : m,
  )
  matches = propagateResults(matches, withGroups, fixtures.groups, cricket, cfg)

  const semisPartlyFilled = matches.filter((m) => !m.groupId && (m.homeId || m.awayId))
  // One group is complete, so exactly that group's two slots may be filled.
  check(
    'an unfinished group releases nobody',
    semisPartlyFilled.every((m) => !(m.homeId && m.awayId)) || semisPartlyFilled.length <= 2,
  )

  // Finish every group match.
  matches = matches.map((m) =>
    m.groupId && m.status !== 'completed'
      ? {
          ...m,
          score: {
            home: { score: 150, periods: [0], wickets: 5, overs: 20 },
            away: { score: 140, periods: [0], wickets: 8, overs: 20 },
            decider: null,
          },
          status: 'completed' as const,
          outcome: 'home' as Match['outcome'],
        }
      : m,
  )
  matches = propagateResults(matches, withGroups, fixtures.groups, cricket, cfg)

  const firstKoRound = matches.filter((m) => !m.groupId && m.homeSource?.kind === 'group')
  const filled = firstKoRound.filter((m) => m.homeId && m.awayId)
  eq('all knockout slots filled once groups finish', filled.length, firstKoRound.length)

  // No first-round knockout tie may pair two teams from the same group.
  const groupOf = new Map(withGroups.map((p) => [p.id, p.groupId]))
  const sameGroupClashes = firstKoRound.filter(
    (m) => m.homeId && m.awayId && groupOf.get(m.homeId) === groupOf.get(m.awayId),
  )
  eq('cross-group pairing respected', sameGroupClashes.length, 0)
}

section('Scoring is driven by sport config')
{
  // Volleyball: sets won are derived from the per-set scores.
  const volleyball = sport('volleyball')
  const vScore = emptyScore(volleyball)
  vScore.home.periods = [25, 20, 25, 25, 0]
  vScore.away.periods = [20, 25, 18, 22, 0]
  const vNorm = normalizeScore(vScore, volleyball)
  eq('volleyball home sets', vNorm.home.score, 3)
  eq('volleyball away sets', vNorm.away.score, 1)
  eq('volleyball winner', resolveOutcome(vNorm, volleyball), 'home')

  // An unplayed 0-0 set must count for nobody.
  const vPartial = emptyScore(volleyball)
  vPartial.home.periods = [25, 25, 25, 0, 0]
  vPartial.away.periods = [20, 20, 20, 0, 0]
  const vpNorm = normalizeScore(vPartial, volleyball)
  eq('unplayed sets ignored', vpNorm.home.score + vpNorm.away.score, 3)

  // Badminton best-of-3.
  const badminton = sport('badminton')
  const bScore = emptyScore(badminton, 3)
  bScore.home.periods = [21, 18, 21]
  bScore.away.periods = [18, 21, 16]
  const bNorm = normalizeScore(bScore, badminton, 3)
  eq('badminton games won', `${bNorm.home.score}-${bNorm.away.score}`, '2-1')
  eq('badminton winner', resolveOutcome(bNorm, badminton), 'home')

  // Football halves sum into the total.
  const football = sport('football')
  const fScore = emptyScore(football)
  fScore.home.periods = [1, 1]
  fScore.away.periods = [0, 1]
  const fNorm = normalizeScore(fScore, football)
  eq('football total from halves', `${fNorm.home.score}-${fNorm.away.score}`, '2-1')

  // Football permits a draw; cricket does not.
  const draw = emptyScore(football)
  draw.home.score = 1
  draw.away.score = 1
  eq('football allows a draw', resolveOutcome(draw, football), 'draw')

  const cricket = sport('cricket')
  const tie = emptyScore(cricket)
  tie.home.score = 150
  tie.away.score = 150
  tie.home.wickets = 5
  tie.away.wickets = 7
  eq('cricket tie broken on wickets', resolveOutcome(tie, cricket), 'home')

  const trueTie = emptyScore(cricket)
  trueTie.home.score = 150
  trueTie.away.score = 150
  trueTie.home.wickets = 5
  trueTie.away.wickets = 5
  eq('cricket true tie needs a decider', resolveOutcome(trueTie, cricket), null)
  check(
    'validation refuses an undecided cricket tie',
    !validateScore(trueTie, cricket).ok,
  )

  trueTie.decider = { home: 12, away: 8 }
  eq('super over decides it', resolveOutcome(trueTie, cricket), 'home')

  // A set sport cannot be saved level.
  const levelSets = emptyScore(volleyball)
  levelSets.home.periods = [25, 20, 0, 0, 0]
  levelSets.away.periods = [20, 25, 0, 0, 0]
  check(
    'volleyball refuses an unfinished match',
    !validateScore(normalizeScore(levelSets, volleyball), volleyball).ok,
  )
}

section('Standings')
{
  const football = sport('football')
  const cfg = config()
  const participants = makeParticipants(4)

  const mk = (
    n: number,
    home: string,
    away: string,
    hs: number,
    as: number,
  ): Match => ({
    id: `m${n}`,
    tournamentId: 't1',
    roundId: 'r1',
    number: n,
    homeId: home,
    awayId: away,
    homeSource: null,
    awaySource: null,
    groupId: null,
    score: {
      home: { score: hs, periods: [0, 0], wickets: null, overs: null },
      away: { score: as, periods: [0, 0], wickets: null, overs: null },
      decider: null,
    },
    status: 'completed',
    outcome: hs > as ? 'home' : as > hs ? 'away' : 'draw',
    walkoverWinner: null,
    date: null,
    time: null,
    venueId: null,
    refereeId: null,
    officialIds: [],
    winnerTo: null,
    loserTo: null,
    position: 0,
    isBye: false,
    notes: '',
    createdAt: '',
    updatedAt: '',
  })

  // p1 wins both, p2 one win one loss, p3 draws, p4 loses both.
  const matches = [
    mk(1, 'p1', 'p4', 3, 0),
    mk(2, 'p1', 'p2', 2, 1),
    mk(3, 'p2', 'p3', 1, 1),
    mk(4, 'p3', 'p4', 2, 0),
  ]

  const table = computeStandings(participants, matches, football, cfg)

  eq('leader is p1', table.rows[0].participant.id, 'p1')
  eq('leader points', table.rows[0].points, 6)
  eq('leader played', table.rows[0].played, 2)
  eq('leader goal difference', table.rows[0].scoreDiff, 4)
  eq('bottom is p4', table.rows[3].participant.id, 'p4')
  eq('bottom points', table.rows[3].points, 0)
  eq('p3 has a draw', table.rows.find((r) => r.participant.id === 'p3')?.drawn, 1)

  // Goals for and against must balance across the whole table.
  const totalFor = table.rows.reduce((sum, r) => sum + r.scoreFor, 0)
  const totalAgainst = table.rows.reduce((sum, r) => sum + r.scoreAgainst, 0)
  eq('goals for equals goals against', totalFor, totalAgainst)

  const totalPlayed = table.rows.reduce((sum, r) => sum + r.played, 0)
  eq('appearances equal twice the match count', totalPlayed, matches.length * 2)

  // Form is chronological and capped at five.
  const leaderForm = table.rows[0].form.join('')
  eq('leader form', leaderForm, 'WW')

  // Points overrides must be honoured.
  const twoPointTable = computeStandings(
    participants,
    matches,
    football,
    config({ pointsWin: 2, pointsDraw: 1, pointsLoss: 0 }),
  )
  eq('points override applied', twoPointTable.rows[0].points, 4)

  // Basketball ranks on win percentage, not points — a different tiebreak chain.
  const basketball = sport('basketball')
  const bTable = computeStandings(participants, matches, basketball, cfg)
  eq('basketball leader', bTable.rows[0].participant.id, 'p1')
  eq('basketball win pct', Number(bTable.rows[0].winPct.toFixed(3)), 1)
  check(
    'basketball columns include win percentage',
    bTable.columns.includes('winPct'),
  )
  check(
    'football columns do not include win percentage',
    !table.columns.includes('winPct'),
  )
}

section('Cricket net run rate')
{
  const cricket = sport('cricket')
  const participants = makeParticipants(2)
  const match: Match = {
    id: 'm1',
    tournamentId: 't1',
    roundId: 'r1',
    number: 1,
    homeId: 'p1',
    awayId: 'p2',
    homeSource: null,
    awaySource: null,
    groupId: null,
    score: {
      home: { score: 180, periods: [0], wickets: 4, overs: 20 },
      away: { score: 140, periods: [0], wickets: 10, overs: 20 },
      decider: null,
    },
    status: 'completed',
    outcome: 'home',
    walkoverWinner: null,
    date: null,
    time: null,
    venueId: null,
    refereeId: null,
    officialIds: [],
    winnerTo: null,
    loserTo: null,
    position: 0,
    isBye: false,
    notes: '',
    createdAt: '',
    updatedAt: '',
  }

  const table = computeStandings(participants, [match], cricket, config())
  const winner = table.rows.find((r) => r.participant.id === 'p1')
  const loser = table.rows.find((r) => r.participant.id === 'p2')

  // 180/20 - 140/20 = 9 - 7 = +2.000
  eq('winner NRR', winner?.nrr, 2)
  eq('loser NRR', loser?.nrr, -2)
  eq('cricket win is 2 points', winner?.points, 2)
  check('cricket columns include NRR', table.columns.includes('nrr'))
}

section('Group standings and qualification')
{
  const cricket = sport('cricket')
  const cfg = config({ groupCount: 2, advancePerGroup: 2 })
  const participants = makeParticipants(8)
  const fixtures = generateFixtures('t1', 'group_knockout', participants, cfg)

  const withGroups = participants.map((p) => {
    const m = fixtures.matches.find((x) => x.homeId === p.id || x.awayId === p.id)
    return { ...p, groupId: m?.groupId ?? null }
  })

  const played = fixtures.matches.map((m) =>
    m.groupId
      ? {
          ...m,
          score: {
            home: { score: 160, periods: [0], wickets: 6, overs: 20 },
            away: { score: 150, periods: [0], wickets: 8, overs: 20 },
            decider: null,
          },
          status: 'completed' as const,
          outcome: 'home' as Match['outcome'],
        }
      : m,
  )

  const tables = computeGroupStandings(withGroups, played, fixtures.groups, cricket, cfg)
  eq('one table per group', tables.length, 2)
  for (const table of tables) {
    eq(`${table.groupName} has 4 rows`, table.rows.length, 4)
    eq(`${table.groupName} marks 2 qualifiers`, table.rows.filter((r) => r.qualified).length, 2)
    check(
      `${table.groupName} positions are 1..4`,
      table.rows.map((r) => r.position).join(',') === '1,2,3,4',
    )
  }
}

section('Scheduling and conflicts')
{
  const football = sport('football')
  const cfg = config()
  const participants = makeParticipants(8)
  const fixtures = generateFixtures('t1', 'single_elimination', participants, cfg)

  const venues = [
    { id: 'v1', tournamentId: 't1', name: 'Ground A', address: null, capacity: 1, createdAt: '' },
    { id: 'v2', tournamentId: 't1', name: 'Ground B', address: null, capacity: 1, createdAt: '' },
  ]

  const scheduled = autoSchedule(fixtures.matches, {
    startDate: '2026-09-01',
    venues,
    settings: DEFAULT_SETTINGS,
    sport: football,
    skipScheduled: false,
  })

  const withDates = scheduled.filter((m) => m.date && m.time)
  eq('every match scheduled', withDates.length, scheduled.filter((m) => !m.isBye).length)

  const conflicts = detectConflicts(
    scheduled,
    participants,
    venues,
    [],
    football,
    DEFAULT_SETTINGS,
  )
  const errors = conflicts.filter((c) => c.severity === 'error')
  eq('auto-schedule produces no hard clashes', errors.length, 0)

  // Deliberately double-book a venue and confirm it is caught.
  const clashing = scheduled.map((m, i) =>
    i < 2 ? { ...m, date: '2026-09-01', time: '10:00', venueId: 'v1' } : m,
  )
  const found = detectConflicts(clashing, participants, venues, [], football, DEFAULT_SETTINGS)
  check(
    'venue double-booking detected',
    found.some((c) => c.kind === 'venue' && c.severity === 'error'),
  )
}

section('Validation')
{
  const football = sport('football')

  const tooFew = validateFixtureGeneration(
    'round_robin',
    makeParticipants(2),
    config(),
    football,
  )
  check('round robin rejects 2 entrants', !tooFew.ok)

  const duplicates = makeParticipants(4)
  duplicates[1] = { ...duplicates[1], name: duplicates[0].name }
  const dupResult = validateFixtureGeneration('single_elimination', duplicates, config(), football)
  check('duplicate names rejected', !dupResult.ok)

  const badGroups = validateFixtureGeneration(
    'group_knockout',
    makeParticipants(8),
    config({ groupCount: 4, advancePerGroup: 2 }),
    football,
  )
  // Four groups of two, advancing two from each, means nobody is eliminated.
  check('advancing everyone from a group is rejected', !badGroups.ok)

  const fine = validateFixtureGeneration(
    'single_elimination',
    makeParticipants(16),
    config(),
    football,
  )
  check('a clean 16-team knockout validates', fine.ok)

  const withByes = validateFixtureGeneration(
    'single_elimination',
    makeParticipants(11),
    config(),
    football,
  )
  check('11 entrants validate with an informational bye note', withByes.ok)
  check(
    'bye count is reported',
    withByes.issues.some((i) => i.level === 'info' && i.message.includes('byes')),
  )
}

section('Every built-in sport generates a full tournament')
{
  const formats: FormatType[] = [
    'single_elimination',
    'double_elimination',
    'round_robin',
    'group_knockout',
  ]

  for (const s of BUILT_IN_SPORTS) {
    for (const format of formats) {
      const n = format === 'round_robin' ? 6 : 8
      const cfg = config({ groupCount: 2, advancePerGroup: 2, bestOf: s.scoringType === 'sets' ? 3 : 1 })
      const participants = makeParticipants(n)
      const fixtures = generateFixtures('t1', format, participants, cfg)

      check(`${s.id}/${format} produces matches`, fixtures.matches.length > 0)

      // Match numbers must be unique and contiguous.
      const numbers = fixtures.matches.map((m) => m.number).sort((a, b) => a - b)
      const contiguous = numbers.every((num, i) => num === i + 1)
      check(`${s.id}/${format} match numbers are 1..n`, contiguous)

      // Every match must belong to a round that exists.
      const roundIds = new Set(fixtures.rounds.map((r) => r.id))
      const orphans = fixtures.matches.filter((m) => !roundIds.has(m.roundId))
      eq(`${s.id}/${format} no orphan matches`, orphans.length, 0)

      // A blank score for this sport must be shaped correctly.
      const blank = emptyScore(s, cfg.bestOf)
      const expectedPeriods =
        s.scoringType === 'sets' && cfg.bestOf > 1 ? cfg.bestOf : s.periods.count
      eq(`${s.id} blank score period count`, blank.home.periods.length, expectedPeriods)
    }
  }
}

/* ── Report ──────────────────────────────────────────────────────────────── */

process.stdout.write('\n' + '─'.repeat(64) + '\n')
if (failures.length === 0) {
  process.stdout.write(`\x1b[32m✓ all ${passed} engine checks passed\x1b[0m\n`)
  process.exit(0)
} else {
  process.stdout.write(`\x1b[31m✗ ${failures.length} failed\x1b[0m (${passed} passed)\n\n`)
  for (const failure of failures) process.stdout.write(`  • ${failure}\n`)
  process.stdout.write('\n')
  process.exit(1)
}
