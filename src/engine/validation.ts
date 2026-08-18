/**
 * Validation.
 *
 * Errors block an action and explain what to fix; warnings let the organizer
 * proceed with their eyes open. Nothing here throws — the UI decides how to
 * present each issue.
 */

import type {
  FormatConfig,
  FormatType,
  Match,
  Participant,
  Player,
  SportConfig,
  Team,
} from '@/types'
import { getFormat } from '@/config/formats'
import { nextPowerOfTwo } from '@/lib/utils'

export interface Issue {
  level: 'error' | 'warning' | 'info'
  message: string
  /** What the organizer should do about it. */
  hint?: string
  /** Ids of the entities involved, for highlighting. */
  refs?: string[]
}

export interface ValidationResult {
  ok: boolean
  issues: Issue[]
}

function result(issues: Issue[]): ValidationResult {
  return { ok: !issues.some((i) => i.level === 'error'), issues }
}

/** Can fixtures be generated for this tournament right now? */
export function validateFixtureGeneration(
  formatType: FormatType,
  participants: readonly Participant[],
  config: FormatConfig,
  sport: SportConfig,
): ValidationResult {
  const issues: Issue[] = []
  const format = getFormat(formatType)
  const n = participants.length

  if (n < format.minParticipants) {
    issues.push({
      level: 'error',
      message: `${format.name} needs at least ${format.minParticipants} ${entrantWord(sport, format.minParticipants)}.`,
      hint: `You currently have ${n}. Add ${format.minParticipants - n} more to continue.`,
    })
  }

  if (n > format.maxParticipants) {
    issues.push({
      level: 'error',
      message: `${format.name} supports up to ${format.maxParticipants} ${entrantWord(sport, 2)}.`,
      hint: `You have ${n}. Remove some entrants or pick a different format.`,
    })
  }

  // Duplicate names are the single most common real-world data problem.
  const seen = new Map<string, number>()
  for (const p of participants) {
    const key = p.name.trim().toLowerCase()
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const dupes = Array.from(seen.entries()).filter(([, count]) => count > 1)
  if (dupes.length > 0) {
    issues.push({
      level: 'error',
      message: `Duplicate ${entrantWord(sport, 2)}: ${dupes.map(([name]) => `"${name}"`).join(', ')}.`,
      hint: 'Give each entrant a unique name so results cannot be attributed to the wrong one.',
    })
  }

  const unnamed = participants.filter((p) => !p.name.trim())
  if (unnamed.length > 0) {
    issues.push({
      level: 'error',
      message: `${unnamed.length} ${entrantWord(sport, unnamed.length)} ${unnamed.length === 1 ? 'has' : 'have'} no name.`,
      hint: 'Every entrant needs a name before fixtures can be generated.',
    })
  }

  if (format.hasBracket && n >= 2) {
    const size = nextPowerOfTwo(n)
    const byes = size - n
    if (byes > 0) {
      issues.push({
        level: 'info',
        message: `${byes} ${byes === 1 ? 'bye' : 'byes'} will be awarded in round one.`,
        hint: `A ${size}-slot bracket fits ${n} entrants, so the top ${byes} ${byes === 1 ? 'seed skips' : 'seeds skip'} the first round.`,
      })
    }
  }

  if (formatType === 'round_robin' && n >= 2) {
    const legs = config.doubleRoundRobin ? 2 : 1
    const total = ((n * (n - 1)) / 2) * legs
    if (total > 60) {
      issues.push({
        level: 'warning',
        message: `That is ${total} matches to play.`,
        hint: 'Consider groups + knockout instead, or turn off the double round robin.',
      })
    }
  }

  if (formatType === 'group_knockout') {
    if (config.groupCount < 1) {
      issues.push({ level: 'error', message: 'You need at least one group.' })
    }
    if (config.groupCount * 2 > n) {
      issues.push({
        level: 'error',
        message: `${config.groupCount} groups need at least ${config.groupCount * 2} entrants.`,
        hint: `You have ${n}. Reduce the group count or add more entrants.`,
      })
    }
    const smallestGroup = Math.floor(n / Math.max(1, config.groupCount))
    if (config.advancePerGroup >= smallestGroup && smallestGroup > 0) {
      issues.push({
        level: 'error',
        message: `You cannot advance ${config.advancePerGroup} from a group of ${smallestGroup}.`,
        hint: 'Advance fewer per group, or use fewer groups so each one is bigger.',
      })
    }
    const qualifiers = config.groupCount * config.advancePerGroup
    if (qualifiers >= 2 && nextPowerOfTwo(qualifiers) !== qualifiers) {
      issues.push({
        level: 'warning',
        message: `${qualifiers} qualifiers means byes in the knockout stage.`,
        hint: `Advancing ${nextPowerOfTwo(qualifiers) === qualifiers * 2 ? 'more' : 'fewer'} per group would give a clean bracket.`,
      })
    }
    if (n % config.groupCount !== 0) {
      issues.push({
        level: 'warning',
        message: 'Groups will be uneven in size.',
        hint: `${n} entrants across ${config.groupCount} groups leaves ${n % config.groupCount} group(s) one larger.`,
      })
    }
  }

  if (n % 2 === 1 && formatType === 'round_robin') {
    issues.push({
      level: 'info',
      message: 'With an odd number of entrants, one sits out each matchday.',
      hint: 'The rest day rotates so nobody sits out twice before everyone has once.',
    })
  }

  return result(issues)
}

/** Team-level checks run in the team manager. */
export function validateTeam(
  team: Pick<Team, 'id' | 'name'>,
  existing: readonly Team[],
  players: readonly Player[],
  sport: SportConfig,
): ValidationResult {
  const issues: Issue[] = []

  if (!team.name.trim()) {
    issues.push({ level: 'error', message: 'A team needs a name.' })
  }

  const clash = existing.find(
    (t) => t.id !== team.id && t.name.trim().toLowerCase() === team.name.trim().toLowerCase(),
  )
  if (clash) {
    issues.push({
      level: 'error',
      message: `Another team is already called "${clash.name}".`,
      hint: 'Team names must be unique within a tournament.',
    })
  }

  const squad = players.filter((p) => p.teamId === team.id)

  if (squad.length > 0 && squad.length < sport.teamSize) {
    issues.push({
      level: 'warning',
      message: `Only ${squad.length} of ${sport.teamSize} players added.`,
      hint: `${sport.name} is played ${sport.teamSize}-a-side.`,
    })
  }

  if (squad.length > sport.squadSize) {
    issues.push({
      level: 'warning',
      message: `Squad of ${squad.length} exceeds the usual maximum of ${sport.squadSize}.`,
    })
  }

  // Duplicate jersey numbers within a squad.
  const numbers = new Map<number, string[]>()
  for (const p of squad) {
    if (p.jerseyNumber == null) continue
    const list = numbers.get(p.jerseyNumber) ?? []
    list.push(p.name)
    numbers.set(p.jerseyNumber, list)
  }
  for (const [number, names] of numbers) {
    if (names.length > 1) {
      issues.push({
        level: 'error',
        message: `Jersey #${number} is used by ${names.join(' and ')}.`,
        hint: 'Two players in a squad cannot share a number.',
      })
    }
  }

  const captains = squad.filter((p) => p.isCaptain)
  if (captains.length > 1) {
    issues.push({
      level: 'warning',
      message: `${captains.length} players are marked as captain.`,
      hint: 'Usually there is just one.',
    })
  }

  const dupNames = new Map<string, number>()
  for (const p of squad) {
    const key = p.name.trim().toLowerCase()
    dupNames.set(key, (dupNames.get(key) ?? 0) + 1)
  }
  const repeated = Array.from(dupNames.entries()).filter(([, c]) => c > 1)
  if (repeated.length > 0) {
    issues.push({
      level: 'warning',
      message: `Repeated player names: ${repeated.map(([n]) => n).join(', ')}.`,
      hint: 'Add a middle name or initial to tell them apart on the tie sheet.',
    })
  }

  return result(issues)
}

/** Checks run before a tournament is published publicly. */
export function validatePublish(
  matches: readonly Match[],
  participants: readonly Participant[],
): ValidationResult {
  const issues: Issue[] = []

  if (matches.length === 0) {
    issues.push({
      level: 'error',
      message: 'No fixtures have been generated yet.',
      hint: 'Generate the draw first — a public page with no fixtures is not much use.',
    })
  }

  const unscheduled = matches.filter((m) => !m.date && m.status === 'pending' && !m.isBye)
  if (unscheduled.length > 0) {
    issues.push({
      level: 'warning',
      message: `${unscheduled.length} of ${matches.length} matches have no date.`,
      hint: 'Visitors will see "Not scheduled" for those.',
    })
  }

  if (participants.length === 0) {
    issues.push({ level: 'error', message: 'There are no entrants to show.' })
  }

  return result(issues)
}

/** 'team'/'teams' or 'player'/'players', depending on the sport. */
export function entrantWord(sport: SportConfig, count: number): string {
  const singular = sport.participantType === 'team' ? 'team' : 'player'
  return count === 1 ? singular : `${singular}s`
}

/** Capitalised entrant noun for headings. */
export function entrantLabel(sport: SportConfig, plural = true): string {
  if (sport.participantType === 'team') return plural ? 'Teams' : 'Team'
  return plural ? 'Players' : 'Player'
}
