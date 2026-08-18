/**
 * Advancement.
 *
 * Rather than patching the next match when a result is entered, this module
 * recomputes *every* undecided slot from scratch on each change. That makes it
 * idempotent: correcting a first-round score months later cleanly rewrites
 * everything downstream instead of leaving a stale participant in the final.
 */

import type {
  FormatConfig,
  Group,
  Match,
  Participant,
  Round,
  SportConfig,
  StandingsTable,
} from '@/types'
import { isDecided, loserId, winnerId } from './scoring'
import { computeGroupStandings } from './standings'
import { nowISO } from '@/lib/utils'

/**
 * Recompute all fed slots.
 *
 * @param matches      current matches (not mutated)
 * @param participants used to resolve group qualifiers
 * @param groups       group definitions, for group-fed knockout slots
 */
export function propagateResults(
  matches: readonly Match[],
  participants: readonly Participant[],
  groups: readonly Group[],
  sport: SportConfig,
  config: FormatConfig,
): Match[] {
  const byId = new Map(matches.map((m) => [m.id, m]))

  // Group qualifiers, resolved only once every match in that group is done.
  const qualifiers = resolveGroupQualifiers(matches, participants, groups, sport, config)

  // Process in match-number order so upstream results are always available
  // before the matches they feed.
  const ordered = matches.slice().sort((a, b) => a.number - b.number)
  const result = new Map<string, Match>(ordered.map((m) => [m.id, { ...m }]))

  for (const match of ordered) {
    const current = result.get(match.id) as Match

    const nextHome = resolveSlot(current.homeSource, result, byId, qualifiers)
    const nextAway = resolveSlot(current.awaySource, result, byId, qualifiers)

    // Only fed slots are rewritten; directly assigned round-1 pairings and
    // manual edits are left exactly as the organizer set them.
    const homeId = current.homeSource ? nextHome : current.homeId
    const awayId = current.awaySource ? nextAway : current.awayId

    const changed = homeId !== current.homeId || awayId !== current.awayId

    if (changed) {
      const stale = current.status === 'completed' || current.status === 'walkover'
      result.set(match.id, {
        ...current,
        homeId,
        awayId,
        // A slot change invalidates any result that was recorded against the
        // old participants — clear it rather than keep a wrong scoreline.
        ...(stale
          ? { score: null, status: 'pending' as const, outcome: null, walkoverWinner: null }
          : {}),
        updatedAt: nowISO(),
      })
    }

    // Byes: one side empty in a first-round match means the occupant walks on.
    const settled = result.get(match.id) as Match
    if (settled.isBye) {
      const occupant = settled.homeId ?? settled.awayId
      if (occupant && settled.status !== 'completed') {
        result.set(match.id, {
          ...settled,
          status: 'completed',
          outcome: settled.homeId ? 'home' : 'away',
          updatedAt: nowISO(),
        })
      }
    }
  }

  return cancelUnneededResets(Array.from(result.values()).sort((a, b) => a.number - b.number))
}

function resolveSlot(
  source: Match['homeSource'],
  result: Map<string, Match>,
  original: Map<string, Match>,
  qualifiers: Map<string, string>,
): string | null {
  if (!source) return null

  if (source.kind === 'group') {
    if (!source.groupId || !source.groupPosition) return null
    return qualifiers.get(`${source.groupId}:${source.groupPosition}`) ?? null
  }

  if (!source.matchId) return null
  const feeder = result.get(source.matchId) ?? original.get(source.matchId)
  if (!feeder) return null

  // A bye match resolves immediately; anything else needs a decisive result.
  if (!isDecided(feeder)) return null

  return source.kind === 'winner' ? winnerId(feeder) : loserId(feeder)
}

/**
 * Map of `groupId:position` → participant id, for groups that have finished.
 *
 * A group is only allowed to feed the knockout once every one of its matches
 * has a result — releasing qualifiers early would let the bracket flip around
 * as later group games came in.
 */
export function resolveGroupQualifiers(
  matches: readonly Match[],
  participants: readonly Participant[],
  groups: readonly Group[],
  sport: SportConfig,
  config: FormatConfig,
): Map<string, string> {
  const out = new Map<string, string>()
  if (groups.length === 0) return out

  const tables: StandingsTable[] = computeGroupStandings(participants, matches, groups, sport, config)

  for (const group of groups) {
    const groupMatches = matches.filter((m) => m.groupId === group.id)
    if (groupMatches.length === 0) continue
    const allDone = groupMatches.every(
      (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result' || m.status === 'cancelled',
    )
    if (!allDone) continue

    const table = tables.find((t) => t.groupId === group.id)
    if (!table) continue
    table.rows.forEach((row, i) => {
      out.set(`${group.id}:${i + 1}`, row.participant.id)
    })
  }

  return out
}

/**
 * A grand-final reset is only played when the losers-bracket side wins the
 * first grand final. Otherwise it is marked cancelled so it greys out in the
 * bracket rather than sitting there looking pending forever.
 */
function cancelUnneededResets(matches: Match[]): Match[] {
  return matches.map((match) => {
    // A reset match is the one whose two slots are the winner and the loser of
    // the very same match — that shape only occurs for a grand-final reset.
    const feederId = match.homeSource?.matchId
    const isReset =
      match.homeSource?.kind === 'winner' &&
      match.awaySource?.kind === 'loser' &&
      feederId != null &&
      feederId === match.awaySource.matchId

    if (!isReset) return match

    const gf = matches.find((m) => m.id === feederId)
    if (!gf || !isDecided(gf)) return match

    // The winners-bracket side entered the grand final in the home slot.
    const wbSideWon = gf.outcome === 'home'
    if (wbSideWon && match.status !== 'cancelled') {
      return { ...match, status: 'cancelled' as const, homeId: null, awayId: null, updatedAt: nowISO() }
    }
    if (!wbSideWon && match.status === 'cancelled') {
      return { ...match, status: 'pending' as const, updatedAt: nowISO() }
    }
    return match
  })
}

/**
 * Final placings for a knockout tournament: champion, runner-up, and the
 * third-place result when that play-off was played.
 */
export interface Podium {
  champion: string | null
  runnerUp: string | null
  third: string | null
}

export function computePodium(matches: readonly Match[], rounds: readonly Round[]): Podium {
  const podium: Podium = { champion: null, runnerUp: null, third: null }

  // The decider is the last grand final if there is one, else the final.
  const finals = matches.filter((m) => {
    const round = rounds.find((r) => r.id === m.roundId)
    return round?.kind === 'grand_final' || (round?.kind === 'winners' && round.matchCount === 1)
  })

  const decider = finals
    .filter((m) => m.status !== 'cancelled')
    .sort((a, b) => b.number - a.number)[0]

  if (decider && isDecided(decider)) {
    podium.champion = winnerId(decider)
    podium.runnerUp = loserId(decider)
  }

  const thirdPlace = matches.find((m) => {
    const round = rounds.find((r) => r.id === m.roundId)
    return round?.kind === 'third_place'
  })
  if (thirdPlace && isDecided(thirdPlace)) podium.third = winnerId(thirdPlace)

  return podium
}

/** The round currently being played — the earliest with an unplayed match. */
export function currentRound(matches: readonly Match[], rounds: readonly Round[]): Round | null {
  const ordered = rounds.slice().sort((a, b) => a.position - b.position)
  for (const round of ordered) {
    const roundMatches = matches.filter((m) => m.roundId === round.id)
    if (roundMatches.length === 0) continue
    const pending = roundMatches.some(
      (m) => m.status === 'pending' || m.status === 'scheduled' || m.status === 'live',
    )
    if (pending) return round
  }
  return ordered[ordered.length - 1] ?? null
}
