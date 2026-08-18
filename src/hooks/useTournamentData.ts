/**
 * Derived-data hooks.
 *
 * Components read tournament data through these rather than reaching into
 * several stores and recombining by hand — one place to memoise, one place to
 * get the scoping right.
 */

import { useMemo } from 'react'
import type {
  Group,
  Match,
  Official,
  Participant,
  Player,
  Round,
  SportConfig,
  StandingsTable,
  Team,
  Tournament,
  Venue,
} from '@/types'
import {
  computeGroupStandings,
  computeStandings,
  computePodium,
  currentRound,
  detectConflicts,
  topPerformers,
  type Leader,
  type Podium,
} from '@/engine'
import { useMatchStore } from '@/stores/useMatchStore'
import { playerToParticipant, teamToParticipant, useTeamStore } from '@/stores/useTeamStore'
import { useSport } from '@/stores/useSportStore'
import { useTournamentSettings } from '@/stores/useTournamentStore'
import { useVenueStore } from '@/stores/useVenueStore'
import { getFormat } from '@/config/formats'

/** Everything a tournament screen needs, in one call. */
export interface TournamentData {
  tournament: Tournament
  sport: SportConfig
  participants: Participant[]
  participantMap: Map<string, Participant>
  teams: Team[]
  players: Player[]
  rounds: Round[]
  matches: Match[]
  groups: Group[]
  venues: Venue[]
  officials: Official[]
}

export function useTournamentData(tournament: Tournament): TournamentData {
  const sport = useSport(tournament.sportId)
  const allTeams = useTeamStore((s) => s.teams)
  const allPlayers = useTeamStore((s) => s.players)
  const allRounds = useMatchStore((s) => s.rounds)
  const allMatches = useMatchStore((s) => s.matches)
  const allGroups = useMatchStore((s) => s.groups)
  const allVenues = useVenueStore((s) => s.venues)
  const allOfficials = useVenueStore((s) => s.officials)

  return useMemo(() => {
    const teams = allTeams.filter((t) => t.tournamentId === tournament.id)
    const players = allPlayers.filter((p) => p.tournamentId === tournament.id)

    const participants =
      tournament.participantType === 'team'
        ? teams.map(teamToParticipant)
        : players.filter((p) => p.teamId === null).map(playerToParticipant)

    return {
      tournament,
      sport,
      participants,
      participantMap: new Map(participants.map((p) => [p.id, p])),
      teams,
      players,
      rounds: allRounds
        .filter((r) => r.tournamentId === tournament.id)
        .sort((a, b) => a.position - b.position),
      matches: allMatches
        .filter((m) => m.tournamentId === tournament.id)
        .sort((a, b) => a.number - b.number),
      groups: allGroups
        .filter((g) => g.tournamentId === tournament.id)
        .sort((a, b) => a.position - b.position),
      venues: allVenues.filter((v) => v.tournamentId === tournament.id),
      officials: allOfficials.filter((o) => o.tournamentId === tournament.id),
    }
  }, [tournament, sport, allTeams, allPlayers, allRounds, allMatches, allGroups, allVenues, allOfficials])
}

/** League table, or one table per group when the format has groups. */
export function useStandings(data: TournamentData): StandingsTable[] {
  const { tournament, sport, participants, matches, groups } = data

  return useMemo(() => {
    if (groups.length > 0) {
      return computeGroupStandings(participants, matches, groups, sport, tournament.config)
    }
    const format = getFormat(tournament.formatType)
    if (!format.hasStandings) return []
    return [computeStandings(participants, matches, sport, tournament.config)]
  }, [tournament.config, tournament.formatType, sport, participants, matches, groups])
}

/**
 * A standings table for any format, even knockouts.
 *
 * Knockouts have no official table, but organizers still want a "who did what"
 * summary, so this computes one from whatever has been played.
 */
export function useSummaryStandings(data: TournamentData): StandingsTable {
  const { tournament, sport, participants, matches } = data
  return useMemo(
    () => computeStandings(participants, matches, sport, tournament.config),
    [participants, matches, sport, tournament.config],
  )
}

export interface TournamentStats {
  teamCount: number
  playerCount: number
  matchCount: number
  completed: number
  upcoming: number
  live: number
  progress: number
  currentRound: Round | null
  nextMatch: Match | null
  recentMatches: Match[]
  upcomingMatches: Match[]
  podium: Podium
  leaders: Leader[]
}

export function useTournamentStats(data: TournamentData): TournamentStats {
  const { matches, rounds, teams, players } = data
  const summary = useSummaryStandings(data)

  return useMemo(() => {
    const playable = matches.filter((m) => !m.isBye && m.status !== 'cancelled')
    const completed = playable.filter(
      (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
    )
    const live = playable.filter((m) => m.status === 'live')
    const upcoming = playable.filter((m) => m.status === 'pending' || m.status === 'scheduled')

    // Next match: earliest scheduled with both slots known, else any ready match.
    const scheduled = upcoming
      .filter((m) => m.date)
      .sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`))
    const ready = upcoming.filter((m) => m.homeId && m.awayId)
    const nextMatch = scheduled[0] ?? ready[0] ?? null

    return {
      teamCount: teams.length,
      playerCount: players.length,
      matchCount: playable.length,
      completed: completed.length,
      upcoming: upcoming.length,
      live: live.length,
      progress: playable.length > 0 ? completed.length / playable.length : 0,
      currentRound: currentRound(matches, rounds),
      nextMatch,
      recentMatches: completed.slice(-5).reverse(),
      upcomingMatches: scheduled.slice(0, 5),
      podium: computePodium(matches, rounds),
      leaders: topPerformers(summary, data.sport),
    }
  }, [matches, rounds, teams, players, summary, data.sport])
}

/** Schedule conflicts for the whole tournament. */
export function useConflicts(data: TournamentData) {
  const settings = useTournamentSettings(data.tournament.id)
  return useMemo(
    () =>
      detectConflicts(
        data.matches,
        data.participants,
        data.venues,
        data.officials,
        data.sport,
        settings,
      ),
    [data.matches, data.participants, data.venues, data.officials, data.sport, settings],
  )
}

/** Squad members of a team, ordered by jersey number then name. */
export function useSquad(players: Player[], teamId: string): Player[] {
  return useMemo(
    () =>
      players
        .filter((p) => p.teamId === teamId)
        .sort((a, b) => {
          const an = a.jerseyNumber ?? 999
          const bn = b.jerseyNumber ?? 999
          return an - bn || a.name.localeCompare(b.name)
        }),
    [players, teamId],
  )
}

/** Group matches into their rounds, in round order. */
export function useMatchesByRound(data: TournamentData): { round: Round; matches: Match[] }[] {
  return useMemo(
    () =>
      data.rounds.map((round) => ({
        round,
        matches: data.matches
          .filter((m) => m.roundId === round.id)
          .sort((a, b) => a.position - b.position || a.number - b.number),
      })),
    [data.rounds, data.matches],
  )
}
