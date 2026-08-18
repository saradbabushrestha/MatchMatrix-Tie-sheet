/**
 * Fixture generation.
 *
 * Every generator returns plain `Round[]` and `Match[]` arrays with the
 * winner/loser wiring already in place. Nothing here reads a store or touches
 * React, so the whole engine is testable in isolation.
 */

import type {
  FormatConfig,
  Group,
  Match,
  MatchStatus,
  Participant,
  Round,
  RoundKind,
  Side,
  SlotSource,
} from '@/types'
import { alphaLabel, nextPowerOfTwo, uid, nowISO } from '@/lib/utils'
import { buildDrawSlots, snakeIntoGroups, orderParticipants } from './seeding'

export interface Fixtures {
  rounds: Round[]
  matches: Match[]
  groups: Group[]
}

/** Names for elimination rounds, chosen by how many matches the round holds. */
export function roundName(matchesInRound: number, kind: RoundKind = 'winners'): { name: string; short: string } {
  if (kind === 'third_place') return { name: 'Third Place Play-off', short: '3rd' }
  if (kind === 'grand_final') return { name: 'Grand Final', short: 'GF' }

  const prefix = kind === 'losers' ? 'Losers ' : ''
  switch (matchesInRound) {
    case 1:
      return kind === 'losers'
        ? { name: 'Losers Final', short: 'LF' }
        : { name: 'Final', short: 'F' }
    case 2:
      return { name: `${prefix}Semi Final`, short: kind === 'losers' ? 'LSF' : 'SF' }
    case 4:
      return { name: `${prefix}Quarter Final`, short: kind === 'losers' ? 'LQF' : 'QF' }
    default: {
      const teams = matchesInRound * 2
      return { name: `${prefix}Round of ${teams}`, short: `R${teams}` }
    }
  }
}

function makeRound(
  tournamentId: string,
  name: string,
  shortName: string,
  kind: RoundKind,
  position: number,
  matchCount: number,
): Round {
  return { id: uid(), tournamentId, name, shortName, kind, position, matchCount }
}

interface MatchSeed {
  tournamentId: string
  roundId: string
  number: number
  position: number
  homeId?: string | null
  awayId?: string | null
  homeSource?: SlotSource | null
  awaySource?: SlotSource | null
  groupId?: string | null
  isBye?: boolean
  status?: MatchStatus
}

function makeMatch(seed: MatchSeed): Match {
  const ts = nowISO()
  return {
    id: uid(),
    tournamentId: seed.tournamentId,
    roundId: seed.roundId,
    number: seed.number,
    homeId: seed.homeId ?? null,
    awayId: seed.awayId ?? null,
    homeSource: seed.homeSource ?? null,
    awaySource: seed.awaySource ?? null,
    groupId: seed.groupId ?? null,
    score: null,
    status: seed.status ?? 'pending',
    outcome: null,
    walkoverWinner: null,
    date: null,
    time: null,
    venueId: null,
    refereeId: null,
    officialIds: [],
    winnerTo: null,
    loserTo: null,
    position: seed.position,
    isBye: seed.isBye ?? false,
    notes: '',
    createdAt: ts,
    updatedAt: ts,
  }
}

/* ────────────────────────────── single elimination ─────────────────────────── */

/**
 * Build a single-elimination bracket.
 *
 * Byes are resolved immediately: a first-round match with one empty slot is
 * marked `isBye` and its occupant is wired straight through to round two, so
 * the organizer never has to record a fake result.
 */
export function generateSingleElimination(
  tournamentId: string,
  participants: readonly Participant[],
  config: FormatConfig,
  startNumber = 1,
): Fixtures {
  if (participants.length < 2) return { rounds: [], matches: [], groups: [] }

  const slots = buildDrawSlots(participants, config.drawMethod)
  const size = slots.length
  const roundCount = Math.log2(size)

  const rounds: Round[] = []
  const matches: Match[] = []
  let matchNumber = startNumber

  // Round 1 from the draw slots, then each subsequent round half the size.
  let previousRoundMatches: Match[] = []

  for (let r = 0; r < roundCount; r++) {
    const matchesInRound = size / 2 ** (r + 1)
    const { name, short } = roundName(matchesInRound, 'winners')
    const round = makeRound(tournamentId, name, short, 'winners', r, matchesInRound)
    rounds.push(round)

    const roundMatches: Match[] = []
    for (let i = 0; i < matchesInRound; i++) {
      if (r === 0) {
        const home = slots[i * 2]
        const away = slots[i * 2 + 1]
        const isBye = (home == null) !== (away == null)
        roundMatches.push(
          makeMatch({
            tournamentId,
            roundId: round.id,
            number: matchNumber++,
            position: i,
            homeId: home?.id ?? null,
            awayId: away?.id ?? null,
            isBye,
            status: isBye ? 'completed' : 'pending',
          }),
        )
      } else {
        const feedA = previousRoundMatches[i * 2]
        const feedB = previousRoundMatches[i * 2 + 1]
        roundMatches.push(
          makeMatch({
            tournamentId,
            roundId: round.id,
            number: matchNumber++,
            position: i,
            homeSource: feedA ? { kind: 'winner', matchId: feedA.id } : null,
            awaySource: feedB ? { kind: 'winner', matchId: feedB.id } : null,
          }),
        )
      }
    }

    // Wire the previous round's winners into this round.
    previousRoundMatches.forEach((m, i) => {
      const target = roundMatches[Math.floor(i / 2)]
      if (target) m.winnerTo = { matchId: target.id, slot: i % 2 === 0 ? 'home' : 'away' }
    })

    matches.push(...roundMatches)
    previousRoundMatches = roundMatches
  }

  // Third-place play-off, fed by the two beaten semi-finalists.
  if (config.thirdPlaceMatch && roundCount >= 2) {
    const semis = matches.filter((m) => {
      const round = rounds.find((r) => r.id === m.roundId)
      return round?.matchCount === 2 && round.kind === 'winners'
    })
    if (semis.length === 2) {
      const { name, short } = roundName(1, 'third_place')
      const round = makeRound(tournamentId, name, short, 'third_place', roundCount, 1)
      rounds.push(round)
      const third = makeMatch({
        tournamentId,
        roundId: round.id,
        number: matchNumber++,
        position: 0,
        homeSource: { kind: 'loser', matchId: semis[0].id },
        awaySource: { kind: 'loser', matchId: semis[1].id },
      })
      semis[0].loserTo = { matchId: third.id, slot: 'home' }
      semis[1].loserTo = { matchId: third.id, slot: 'away' }
      matches.push(third)
    }
  }

  return { rounds, matches, groups: [] }
}

/* ────────────────────────────── double elimination ─────────────────────────── */

/**
 * Build a double-elimination bracket.
 *
 * The losers bracket alternates *major* rounds (survivors meet fresh dropdowns
 * from the winners bracket) with *minor* rounds (survivors meet each other).
 * Total matches always come to 2N-2, plus an optional grand-final reset.
 */
export function generateDoubleElimination(
  tournamentId: string,
  participants: readonly Participant[],
  config: FormatConfig,
  startNumber = 1,
): Fixtures {
  if (participants.length < 4) {
    return generateSingleElimination(tournamentId, participants, config, startNumber)
  }

  const slots = buildDrawSlots(participants, config.drawMethod)
  const size = slots.length
  const wbRoundCount = Math.log2(size)

  const rounds: Round[] = []
  const matches: Match[] = []
  let matchNumber = startNumber
  let position = 0

  /* Winners bracket — identical in shape to a single-elimination draw. */
  const wbRounds: Match[][] = []
  let previous: Match[] = []

  for (let r = 0; r < wbRoundCount; r++) {
    const count = size / 2 ** (r + 1)
    const isWbFinal = count === 1
    const label = isWbFinal
      ? { name: 'Winners Final', short: 'WF' }
      : roundName(count, 'winners')
    const round = makeRound(tournamentId, label.name, label.short, 'winners', position++, count)
    rounds.push(round)

    const roundMatches: Match[] = []
    for (let i = 0; i < count; i++) {
      if (r === 0) {
        const home = slots[i * 2]
        const away = slots[i * 2 + 1]
        const isBye = (home == null) !== (away == null)
        roundMatches.push(
          makeMatch({
            tournamentId,
            roundId: round.id,
            number: matchNumber++,
            position: i,
            homeId: home?.id ?? null,
            awayId: away?.id ?? null,
            isBye,
            status: isBye ? 'completed' : 'pending',
          }),
        )
      } else {
        const a = previous[i * 2]
        const b = previous[i * 2 + 1]
        roundMatches.push(
          makeMatch({
            tournamentId,
            roundId: round.id,
            number: matchNumber++,
            position: i,
            homeSource: a ? { kind: 'winner', matchId: a.id } : null,
            awaySource: b ? { kind: 'winner', matchId: b.id } : null,
          }),
        )
      }
    }
    previous.forEach((m, i) => {
      const target = roundMatches[Math.floor(i / 2)]
      if (target) m.winnerTo = { matchId: target.id, slot: i % 2 === 0 ? 'home' : 'away' }
    })

    matches.push(...roundMatches)
    wbRounds.push(roundMatches)
    previous = roundMatches
  }

  /* Losers bracket. */
  const lbRounds: Match[][] = []
  let lbIndex = 1

  const addLbRound = (count: number, build: (i: number) => MatchSeed): Match[] => {
    const round = makeRound(
      tournamentId,
      count === 1 && lbIndex > 1 ? 'Losers Final' : `Losers Round ${lbIndex}`,
      count === 1 && lbIndex > 1 ? 'LF' : `LR${lbIndex}`,
      'losers',
      position++,
      count,
    )
    rounds.push(round)
    lbIndex++
    const built = Array.from({ length: count }, (_, i) => makeMatch({ ...build(i), roundId: round.id }))
    matches.push(...built)
    lbRounds.push(built)
    return built
  }

  // LR1: losers of WB round 1 pair off.
  const wb1 = wbRounds[0]
  let lbPrevious = addLbRound(wb1.length / 2, (i) => ({
    tournamentId,
    roundId: '',
    number: matchNumber++,
    position: i,
    homeSource: { kind: 'loser', matchId: wb1[i * 2].id },
    awaySource: { kind: 'loser', matchId: wb1[i * 2 + 1].id },
  }))
  wb1.forEach((m, i) => {
    const target = lbPrevious[Math.floor(i / 2)]
    if (target) m.loserTo = { matchId: target.id, slot: i % 2 === 0 ? 'home' : 'away' }
  })

  for (let k = 1; k < wbRoundCount; k++) {
    const dropdowns = wbRounds[k]

    // Major round: LB survivors face this winners round's losers.
    const major = addLbRound(dropdowns.length, (i) => ({
      tournamentId,
      roundId: '',
      number: matchNumber++,
      position: i,
      homeSource: { kind: 'winner', matchId: lbPrevious[i].id },
      awaySource: { kind: 'loser', matchId: dropdowns[i].id },
    }))
    lbPrevious.forEach((m, i) => {
      if (major[i]) m.winnerTo = { matchId: major[i].id, slot: 'home' }
    })
    dropdowns.forEach((m, i) => {
      if (major[i]) m.loserTo = { matchId: major[i].id, slot: 'away' }
    })
    lbPrevious = major

    // Minor round: halve the survivors, unless only one remains.
    if (lbPrevious.length > 1) {
      const source = lbPrevious
      const minor = addLbRound(source.length / 2, (i) => ({
        tournamentId,
        roundId: '',
        number: matchNumber++,
        position: i,
        homeSource: { kind: 'winner', matchId: source[i * 2].id },
        awaySource: { kind: 'winner', matchId: source[i * 2 + 1].id },
      }))
      source.forEach((m, i) => {
        const target = minor[Math.floor(i / 2)]
        if (target) m.winnerTo = { matchId: target.id, slot: i % 2 === 0 ? 'home' : 'away' }
      })
      lbPrevious = minor
    }
  }

  /* Grand final: winners-bracket champion vs losers-bracket survivor. */
  const wbFinal = wbRounds[wbRounds.length - 1][0]
  const lbFinal = lbPrevious[0]

  const gfRound = makeRound(tournamentId, 'Grand Final', 'GF', 'grand_final', position++, 1)
  rounds.push(gfRound)
  const grandFinal = makeMatch({
    tournamentId,
    roundId: gfRound.id,
    number: matchNumber++,
    position: 0,
    homeSource: { kind: 'winner', matchId: wbFinal.id },
    awaySource: { kind: 'winner', matchId: lbFinal.id },
  })
  wbFinal.winnerTo = { matchId: grandFinal.id, slot: 'home' }
  lbFinal.winnerTo = { matchId: grandFinal.id, slot: 'away' }
  matches.push(grandFinal)

  if (config.grandFinalReset) {
    const resetRound = makeRound(tournamentId, 'Grand Final (Reset)', 'GF2', 'grand_final', position++, 1)
    rounds.push(resetRound)
    // Only played if the losers-bracket side wins the first grand final; the
    // advancement pass cancels it otherwise.
    matches.push(
      makeMatch({
        tournamentId,
        roundId: resetRound.id,
        number: matchNumber++,
        position: 0,
        homeSource: { kind: 'winner', matchId: grandFinal.id },
        awaySource: { kind: 'loser', matchId: grandFinal.id },
      }),
    )
  }

  return { rounds, matches, groups: [] }
}

/* ─────────────────────────────── round robin ───────────────────────────────── */

/**
 * Circle-method round robin.
 *
 * With an odd entry count a "bye" placeholder rotates through, so exactly one
 * participant rests each matchday instead of the same one every time.
 */
export function roundRobinPairings(count: number): { home: number; away: number }[][] {
  const isOdd = count % 2 === 1
  const n = isOdd ? count + 1 : count
  const BYE = -1

  const ids = Array.from({ length: n }, (_, i) => (isOdd && i === n - 1 ? BYE : i))
  const rounds: { home: number; away: number }[][] = []

  for (let r = 0; r < n - 1; r++) {
    const pairs: { home: number; away: number }[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]
      const b = ids[n - 1 - i]
      if (a === BYE || b === BYE) continue
      // Alternate home/away by round so fixtures are balanced.
      pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a })
    }
    rounds.push(pairs)

    // Rotate all but the first element.
    const fixed = ids[0]
    const rest = ids.slice(1)
    rest.unshift(rest.pop() as number)
    ids.splice(0, ids.length, fixed, ...rest)
  }

  return rounds
}

export function generateRoundRobin(
  tournamentId: string,
  participants: readonly Participant[],
  config: FormatConfig,
  startNumber = 1,
  groupId: string | null = null,
  roundOffset = 0,
  roundLabel = 'Matchday',
): Fixtures {
  if (participants.length < 2) return { rounds: [], matches: [], groups: [] }

  const ordered = orderParticipants(participants, config.drawMethod === 'manual' ? 'manual' : 'seeded')
  const legs = config.doubleRoundRobin || config.groupDoubleRoundRobin ? 2 : 1
  const base = roundRobinPairings(ordered.length)

  const rounds: Round[] = []
  const matches: Match[] = []
  let matchNumber = startNumber
  let roundIndex = 0

  for (let leg = 0; leg < legs; leg++) {
    for (const pairs of base) {
      const suffix = legs === 2 ? ` (Leg ${leg + 1})` : ''
      const round = makeRound(
        tournamentId,
        `${roundLabel} ${roundIndex + 1}${suffix}`,
        `MD${roundIndex + 1}`,
        groupId ? 'group' : 'league',
        roundOffset + roundIndex,
        pairs.length,
      )
      rounds.push(round)

      pairs.forEach((pair, i) => {
        // Reverse the venue in the second leg.
        const homeIdx = leg === 0 ? pair.home : pair.away
        const awayIdx = leg === 0 ? pair.away : pair.home
        matches.push(
          makeMatch({
            tournamentId,
            roundId: round.id,
            number: matchNumber++,
            position: i,
            homeId: ordered[homeIdx].id,
            awayId: ordered[awayIdx].id,
            groupId,
          }),
        )
      })

      roundIndex++
    }
  }

  return { rounds, matches, groups: [] }
}

/* ───────────────────────────── group + knockout ────────────────────────────── */

/**
 * Build the group stage plus an empty knockout bracket whose slots are fed by
 * group finishing positions. The knockout fills itself in as groups complete.
 */
export function generateGroupKnockout(
  tournamentId: string,
  participants: readonly Participant[],
  config: FormatConfig,
): Fixtures {
  const groupCount = Math.max(1, Math.min(config.groupCount, Math.floor(participants.length / 2)))
  const advance = Math.max(1, config.advancePerGroup)

  const ordered = orderParticipants(participants, config.drawMethod)
  const buckets = snakeIntoGroups(ordered, groupCount)

  const groups: Group[] = buckets.map((_, i) => ({
    id: uid(),
    tournamentId,
    name: `Group ${alphaLabel(i)}`,
    position: i,
    createdAt: nowISO(),
  }))

  const rounds: Round[] = []
  const matches: Match[] = []
  let matchNumber = 1
  let roundOffset = 0

  // Group fixtures, one round-robin per group.
  buckets.forEach((bucket, i) => {
    const withGroup = bucket.map((p) => ({ ...p, groupId: groups[i].id }))
    const fx = generateRoundRobin(
      tournamentId,
      withGroup,
      config,
      matchNumber,
      groups[i].id,
      roundOffset,
      `Group ${alphaLabel(i)} · Matchday`,
    )
    rounds.push(...fx.rounds)
    matches.push(...fx.matches)
    matchNumber += fx.matches.length
    roundOffset += fx.rounds.length
  })

  // Knockout bracket sized to the qualifier count, with group-fed round 1.
  const qualifierCount = groupCount * advance
  if (qualifierCount >= 2) {
    const bracketSize = nextPowerOfTwo(qualifierCount)
    const koRoundCount = Math.log2(bracketSize)

    // Slot sources: A1 vs B2, B1 vs A2, C1 vs D2, … then deeper positions.
    const sources: (SlotSource | null)[] = []
    for (let g = 0; g < groupCount; g++) {
      const partner = g % 2 === 0 ? g + 1 : g - 1
      const opponentGroup = groups[partner] ?? groups[g]
      sources.push({ kind: 'group', groupId: groups[g].id, groupPosition: 1 })
      sources.push({ kind: 'group', groupId: opponentGroup.id, groupPosition: 2 })
    }
    for (let pos = 3; pos <= advance; pos++) {
      for (let g = 0; g < groupCount; g++) {
        sources.push({ kind: 'group', groupId: groups[g].id, groupPosition: pos })
      }
    }
    while (sources.length < bracketSize) sources.push(null)

    let previous: Match[] = []
    for (let r = 0; r < koRoundCount; r++) {
      const count = bracketSize / 2 ** (r + 1)
      const { name, short } = roundName(count, 'winners')
      const round = makeRound(tournamentId, name, short, 'winners', roundOffset + r, count)
      rounds.push(round)

      const roundMatches: Match[] = []
      for (let i = 0; i < count; i++) {
        if (r === 0) {
          roundMatches.push(
            makeMatch({
              tournamentId,
              roundId: round.id,
              number: matchNumber++,
              position: i,
              homeSource: sources[i * 2],
              awaySource: sources[i * 2 + 1],
            }),
          )
        } else {
          const a = previous[i * 2]
          const b = previous[i * 2 + 1]
          roundMatches.push(
            makeMatch({
              tournamentId,
              roundId: round.id,
              number: matchNumber++,
              position: i,
              homeSource: a ? { kind: 'winner', matchId: a.id } : null,
              awaySource: b ? { kind: 'winner', matchId: b.id } : null,
            }),
          )
        }
      }
      previous.forEach((m, i) => {
        const target = roundMatches[Math.floor(i / 2)]
        if (target) m.winnerTo = { matchId: target.id, slot: i % 2 === 0 ? 'home' : 'away' }
      })
      matches.push(...roundMatches)
      previous = roundMatches
    }

    if (config.thirdPlaceMatch && koRoundCount >= 2) {
      const semis = matches.filter((m) => {
        const round = rounds.find((r) => r.id === m.roundId)
        return round?.kind === 'winners' && round.matchCount === 2
      })
      if (semis.length === 2) {
        const round = makeRound(
          tournamentId,
          'Third Place Play-off',
          '3rd',
          'third_place',
          roundOffset + koRoundCount,
          1,
        )
        rounds.push(round)
        const third = makeMatch({
          tournamentId,
          roundId: round.id,
          number: matchNumber++,
          position: 0,
          homeSource: { kind: 'loser', matchId: semis[0].id },
          awaySource: { kind: 'loser', matchId: semis[1].id },
        })
        semis[0].loserTo = { matchId: third.id, slot: 'home' }
        semis[1].loserTo = { matchId: third.id, slot: 'away' }
        matches.push(third)
      }
    }
  }

  return { rounds, matches, groups }
}

/** Dispatch to the right generator for a format. */
export function generateFixtures(
  tournamentId: string,
  formatType: string,
  participants: readonly Participant[],
  config: FormatConfig,
): Fixtures {
  switch (formatType) {
    case 'single_elimination':
      return generateSingleElimination(tournamentId, participants, config)
    case 'double_elimination':
      return generateDoubleElimination(tournamentId, participants, config)
    case 'round_robin':
      return generateRoundRobin(tournamentId, participants, config)
    case 'group_knockout':
      return generateGroupKnockout(tournamentId, participants, config)
    default:
      throw new Error(`Unknown tournament format: ${formatType}`)
  }
}

/** How many matches a format will produce, for the wizard's preview. */
export function estimateMatchCount(
  formatType: string,
  participantCount: number,
  config: FormatConfig,
): number {
  const n = participantCount
  if (n < 2) return 0

  switch (formatType) {
    case 'single_elimination': {
      const base = nextPowerOfTwo(n) - 1
      return base + (config.thirdPlaceMatch && n >= 4 ? 1 : 0)
    }
    case 'double_elimination': {
      const size = nextPowerOfTwo(n)
      return 2 * size - 2 + (config.grandFinalReset ? 1 : 0)
    }
    case 'round_robin': {
      const legs = config.doubleRoundRobin ? 2 : 1
      return ((n * (n - 1)) / 2) * legs
    }
    case 'group_knockout': {
      const groupCount = Math.max(1, Math.min(config.groupCount, Math.floor(n / 2)))
      const legs = config.groupDoubleRoundRobin ? 2 : 1
      const perGroup = Math.floor(n / groupCount)
      const remainder = n % groupCount
      let groupMatches = 0
      for (let i = 0; i < groupCount; i++) {
        const size = perGroup + (i < remainder ? 1 : 0)
        groupMatches += ((size * (size - 1)) / 2) * legs
      }
      const qualifiers = groupCount * Math.max(1, config.advancePerGroup)
      const ko = qualifiers >= 2 ? nextPowerOfTwo(qualifiers) - 1 : 0
      return groupMatches + ko + (config.thirdPlaceMatch && qualifiers >= 4 ? 1 : 0)
    }
    default:
      return 0
  }
}

export const SIDES: Side[] = ['home', 'away']
