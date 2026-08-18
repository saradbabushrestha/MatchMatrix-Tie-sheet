/**
 * Tournament service.
 *
 * The single place where a user action fans out across several stores plus the
 * engine. Keeping this out of the stores means each store stays a dumb, easily
 * reasoned-about slice, and keeping it out of components means the same action
 * behaves identically wherever it is triggered from.
 */

import type {
  FormatConfig,
  Match,
  MatchScore,
  MatchStatus,
  Participant,
  Side,
  SportConfig,
  Tournament,
} from '@/types'
import {
  autoSchedule,
  generateFixtures,
  normalizeScore,
  propagateResults,
  resolveOutcome,
  validateFixtureGeneration,
  type AutoScheduleOptions,
  type ValidationResult,
} from '@/engine'
import { useMatchStore } from '@/stores/useMatchStore'
import { useTeamStore, playerToParticipant, teamToParticipant } from '@/stores/useTeamStore'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useVenueStore } from '@/stores/useVenueStore'
import { getSport } from '@/stores/useSportStore'
import { DEFAULT_SETTINGS } from '@/engine/schedule'
import { todayISO } from '@/lib/date'

/** Every participant of a tournament, whichever entity type it uses. */
export function getParticipants(tournament: Tournament): Participant[] {
  const { teams, players } = useTeamStore.getState()

  if (tournament.participantType === 'team') {
    return teams.filter((t) => t.tournamentId === tournament.id).map(teamToParticipant)
  }
  return players
    .filter((p) => p.tournamentId === tournament.id && p.teamId === null)
    .map(playerToParticipant)
}

/** Check whether the draw can be generated, without generating it. */
export function checkFixtures(tournament: Tournament): ValidationResult {
  const sport = getSport(tournament.sportId)
  const participants = getParticipants(tournament)
  return validateFixtureGeneration(tournament.formatType, participants, tournament.config, sport)
}

export interface GenerateResult {
  ok: boolean
  validation: ValidationResult
  matchCount: number
}

/**
 * Generate (or regenerate) the draw.
 *
 * Regenerating discards existing results — the caller is expected to have
 * confirmed that with the organizer first.
 */
export function generateTournamentFixtures(tournament: Tournament): GenerateResult {
  const sport = getSport(tournament.sportId)
  const participants = getParticipants(tournament)
  const validation = validateFixtureGeneration(
    tournament.formatType,
    participants,
    tournament.config,
    sport,
  )

  if (!validation.ok) return { ok: false, validation, matchCount: 0 }

  const fixtures = generateFixtures(
    tournament.id,
    tournament.formatType,
    participants,
    tournament.config,
  )

  useMatchStore
    .getState()
    .setFixtures(tournament.id, fixtures.rounds, fixtures.matches, fixtures.groups)

  // Group-stage draws assign teams to groups, so mirror that onto the teams.
  if (fixtures.groups.length > 0) {
    const assignments: { teamId: string; groupId: string | null }[] = []
    const seen = new Set<string>()
    for (const match of fixtures.matches) {
      if (!match.groupId) continue
      for (const id of [match.homeId, match.awayId]) {
        if (id && !seen.has(id)) {
          seen.add(id)
          assignments.push({ teamId: id, groupId: match.groupId })
        }
      }
    }
    // Anyone not in a group match (shouldn't happen) gets cleared.
    for (const p of participants) {
      if (!seen.has(p.id)) assignments.push({ teamId: p.id, groupId: null })
    }
    useTeamStore.getState().setGroups(assignments)
  }

  useTournamentStore.getState().updateTournament(tournament.id, {
    fixturesGenerated: true,
    status: tournament.status === 'setup' ? 'active' : tournament.status,
  })

  // Resolve byes and any immediately-known slots.
  refreshAdvancement(tournament.id)

  return { ok: true, validation, matchCount: fixtures.matches.length }
}

/**
 * Re-run the advancement pass for a tournament.
 *
 * Called after any result change. Idempotent by design, so calling it more often
 * than strictly necessary is always safe.
 */
export function refreshAdvancement(tournamentId: string): void {
  const tournament = useTournamentStore.getState().tournaments.find((t) => t.id === tournamentId)
  if (!tournament) return

  const sport = getSport(tournament.sportId)
  const { matches, groups } = useMatchStore.getState()
  const scoped = matches.filter((m) => m.tournamentId === tournamentId)
  const scopedGroups = groups.filter((g) => g.tournamentId === tournamentId)
  const participants = getParticipants(tournament)

  const updated = propagateResults(scoped, participants, scopedGroups, sport, tournament.config)
  useMatchStore.getState().replaceMatches(tournamentId, updated)

  maybeCompleteTournament(tournament, updated)
}

/** Mark a tournament complete once every match has been played. */
function maybeCompleteTournament(tournament: Tournament, matches: Match[]): void {
  if (matches.length === 0) return
  const outstanding = matches.filter(
    (m) => m.status === 'pending' || m.status === 'scheduled' || m.status === 'live',
  )
  const store = useTournamentStore.getState()

  if (outstanding.length === 0 && tournament.status !== 'completed') {
    store.setStatus(tournament.id, 'completed')
  } else if (outstanding.length > 0 && tournament.status === 'completed') {
    // A corrected result reopened the tournament.
    store.setStatus(tournament.id, 'active')
  }
}

export interface SaveResultInput {
  matchId: string
  score: MatchScore
  status?: MatchStatus
}

/**
 * Save a match result, then advance the bracket and refresh standings.
 * Returns the resolved outcome so the caller can report it.
 */
export function saveMatchResult(
  tournamentId: string,
  input: SaveResultInput,
): { ok: boolean; outcome: Match['outcome']; error?: string } {
  const tournament = useTournamentStore.getState().tournaments.find((t) => t.id === tournamentId)
  if (!tournament) return { ok: false, outcome: null, error: 'Tournament not found.' }

  const sport = getSport(tournament.sportId)
  const normalized = normalizeScore(input.score, sport, tournament.config.bestOf)
  const outcome = resolveOutcome(normalized, sport)

  const status: MatchStatus = input.status ?? 'completed'

  if (status === 'completed' && outcome === null && !sport.allowsDraw) {
    return {
      ok: false,
      outcome: null,
      error: `Scores are level and ${sport.name} cannot end in a draw. Record the ${
        sport.drawResolutionLabel || 'decider'
      } to settle it.`,
    }
  }

  useMatchStore.getState().setResult(input.matchId, normalized, status, outcome)
  refreshAdvancement(tournamentId)

  return { ok: true, outcome }
}

/** Award a match to one side because the other did not turn up. */
export function saveWalkover(tournamentId: string, matchId: string, winner: Side): void {
  useMatchStore.getState().setWalkover(matchId, winner)
  refreshAdvancement(tournamentId)
}

/** Record that a match produced no result (abandoned, rained off). */
export function saveNoResult(tournamentId: string, matchId: string): void {
  useMatchStore.getState().updateMatch(matchId, {
    status: 'no_result',
    outcome: null,
    score: null,
    walkoverWinner: null,
  })
  refreshAdvancement(tournamentId)
}

/** Undo a result, returning the match to its pre-match state. */
export function clearMatchResult(tournamentId: string, matchId: string): void {
  useMatchStore.getState().clearResult(matchId)
  refreshAdvancement(tournamentId)
}

/** Update scheduling fields on a match. */
export function scheduleMatch(
  matchId: string,
  patch: {
    date?: string | null
    time?: string | null
    venueId?: string | null
    refereeId?: string | null
    officialIds?: string[]
  },
): void {
  const store = useMatchStore.getState()
  const match = store.matches.find((m) => m.id === matchId)
  if (!match) return

  const nextDate = patch.date !== undefined ? patch.date : match.date
  // Getting a date is what turns a pending match into a scheduled one.
  const shouldSchedule = nextDate != null && match.status === 'pending'
  const shouldUnschedule = nextDate == null && match.status === 'scheduled'

  store.updateMatch(matchId, {
    ...patch,
    ...(shouldSchedule ? { status: 'scheduled' as const } : {}),
    ...(shouldUnschedule ? { status: 'pending' as const } : {}),
  })
}

/** Lay out the whole tournament across days and venues. */
export function autoScheduleTournament(
  tournament: Tournament,
  options?: { startDate?: string; skipScheduled?: boolean },
): number {
  const sport = getSport(tournament.sportId)
  const settings =
    useTournamentStore.getState().settings[tournament.id] ??
    ({ tournamentId: tournament.id, ...DEFAULT_SETTINGS } as const)
  const venues = useVenueStore.getState().venues.filter((v) => v.tournamentId === tournament.id)
  const matches = useMatchStore
    .getState()
    .matches.filter((m) => m.tournamentId === tournament.id)

  const config: AutoScheduleOptions = {
    startDate: options?.startDate ?? tournament.startDate ?? todayISO(),
    venues,
    settings,
    sport,
    skipScheduled: options?.skipScheduled ?? false,
  }

  const updated = autoSchedule(matches, config)
  useMatchStore.getState().replaceMatches(tournament.id, updated)

  return updated.filter((m) => m.date).length
}

/** Delete a tournament and everything hanging off it. */
export function deleteTournament(tournamentId: string): void {
  useMatchStore.getState().clearByTournament(tournamentId)
  useTeamStore.getState().removeByTournament(tournamentId)
  useVenueStore.getState().removeByTournament(tournamentId)
  useTournamentStore.getState().removeTournament(tournamentId)
}

/** Wipe the draw but keep teams, so the organizer can re-draw. */
export function resetFixtures(tournamentId: string): void {
  useMatchStore.getState().clearByTournament(tournamentId)
  useTournamentStore.getState().updateTournament(tournamentId, {
    fixturesGenerated: false,
    status: 'setup',
  })
}

/** Re-seed participants from an explicit order, then keep the draw in step. */
export function applySeedOrder(tournament: Tournament, orderedIds: string[]): void {
  useTeamStore
    .getState()
    .setSeeds(tournament.participantType === 'team' ? 'team' : 'player', orderedIds)
}

/** Effective points rule for display. */
export function pointsSummary(sport: SportConfig, config: FormatConfig): string {
  const win = config.pointsWin ?? sport.pointsRule.win
  const draw = config.pointsDraw ?? sport.pointsRule.draw
  const loss = config.pointsLoss ?? sport.pointsRule.loss
  const parts = [`${win} for a win`]
  if (sport.allowsDraw) parts.push(`${draw} for a draw`)
  parts.push(`${loss} for a loss`)
  return parts.join(', ')
}
