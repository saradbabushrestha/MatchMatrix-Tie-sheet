/**
 * Match store — rounds, matches and groups.
 *
 * Writes go through `setFixtures` / `updateMatch`; the advancement pass that
 * keeps brackets consistent lives in the tournament service, which calls back
 * into `replaceMatches` with the recomputed set.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Group, Match, MatchScore, MatchStatus, Round, Side } from '@/types'
import { nowISO } from '@/lib/utils'

interface MatchState {
  rounds: Round[]
  matches: Match[]
  groups: Group[]

  /** Replace every fixture for a tournament — used when (re)generating a draw. */
  setFixtures: (tournamentId: string, rounds: Round[], matches: Match[], groups: Group[]) => void
  /** Swap in a recomputed match set for a tournament. */
  replaceMatches: (tournamentId: string, matches: Match[]) => void

  updateMatch: (id: string, patch: Partial<Match>) => void
  updateMatches: (patches: { id: string; patch: Partial<Match> }[]) => void

  setResult: (id: string, score: MatchScore, status: MatchStatus, outcome: Match['outcome']) => void
  setWalkover: (id: string, winner: Side) => void
  clearResult: (id: string) => void

  /** Manually swap the two participants of a match. */
  swapSides: (id: string) => void
  /** Manually place a participant into a slot (manual draw editing). */
  assignSlot: (id: string, slot: Side, participantId: string | null) => void
  /** Exchange the occupants of two slots across two matches. */
  swapParticipants: (aMatchId: string, aSlot: Side, bMatchId: string, bSlot: Side) => void

  clearByTournament: (tournamentId: string) => void
  loadFixtures: (rounds: Round[], matches: Match[], groups: Group[]) => void
}

export const useMatchStore = create<MatchState>()(
  persist(
    (set) => ({
      rounds: [],
      matches: [],
      groups: [],

      setFixtures: (tournamentId, rounds, matches, groups) =>
        set((s) => ({
          rounds: [...s.rounds.filter((r) => r.tournamentId !== tournamentId), ...rounds],
          matches: [...s.matches.filter((m) => m.tournamentId !== tournamentId), ...matches],
          groups: [...s.groups.filter((g) => g.tournamentId !== tournamentId), ...groups],
        })),

      replaceMatches: (tournamentId, matches) =>
        set((s) => ({
          matches: [...s.matches.filter((m) => m.tournamentId !== tournamentId), ...matches],
        })),

      updateMatch: (id, patch) =>
        set((s) => ({
          matches: s.matches.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: nowISO() } : m)),
        })),

      updateMatches: (patches) =>
        set((s) => {
          const map = new Map(patches.map((p) => [p.id, p.patch]))
          return {
            matches: s.matches.map((m) =>
              map.has(m.id) ? { ...m, ...map.get(m.id), updatedAt: nowISO() } : m,
            ),
          }
        }),

      setResult: (id, score, status, outcome) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id
              ? { ...m, score, status, outcome, walkoverWinner: null, updatedAt: nowISO() }
              : m,
          ),
        })),

      setWalkover: (id, winner) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: 'walkover' as const,
                  walkoverWinner: winner,
                  outcome: winner,
                  score: null,
                  updatedAt: nowISO(),
                }
              : m,
          ),
        })),

      clearResult: (id) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id
              ? {
                  ...m,
                  score: null,
                  outcome: null,
                  walkoverWinner: null,
                  status: m.date ? ('scheduled' as const) : ('pending' as const),
                  updatedAt: nowISO(),
                }
              : m,
          ),
        })),

      swapSides: (id) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id
              ? {
                  ...m,
                  homeId: m.awayId,
                  awayId: m.homeId,
                  homeSource: m.awaySource,
                  awaySource: m.homeSource,
                  // A recorded result belongs to the old arrangement.
                  score: null,
                  outcome: null,
                  status: m.status === 'completed' ? ('pending' as const) : m.status,
                  updatedAt: nowISO(),
                }
              : m,
          ),
        })),

      assignSlot: (id, slot, participantId) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id
              ? {
                  ...m,
                  [slot === 'home' ? 'homeId' : 'awayId']: participantId,
                  // A hand-placed participant is no longer fed by a result.
                  [slot === 'home' ? 'homeSource' : 'awaySource']: null,
                  updatedAt: nowISO(),
                }
              : m,
          ),
        })),

      swapParticipants: (aMatchId, aSlot, bMatchId, bSlot) =>
        set((s) => {
          const a = s.matches.find((m) => m.id === aMatchId)
          const b = s.matches.find((m) => m.id === bMatchId)
          if (!a || !b) return s

          const aKey = aSlot === 'home' ? 'homeId' : 'awayId'
          const bKey = bSlot === 'home' ? 'homeId' : 'awayId'
          const aValue = a[aKey]
          const bValue = b[bKey]

          return {
            matches: s.matches.map((m) => {
              if (m.id === aMatchId && m.id === bMatchId) {
                // Both slots are in the same match.
                return { ...m, [aKey]: bValue, [bKey]: aValue, updatedAt: nowISO() }
              }
              if (m.id === aMatchId) return { ...m, [aKey]: bValue, updatedAt: nowISO() }
              if (m.id === bMatchId) return { ...m, [bKey]: aValue, updatedAt: nowISO() }
              return m
            }),
          }
        }),

      clearByTournament: (tournamentId) =>
        set((s) => ({
          rounds: s.rounds.filter((r) => r.tournamentId !== tournamentId),
          matches: s.matches.filter((m) => m.tournamentId !== tournamentId),
          groups: s.groups.filter((g) => g.tournamentId !== tournamentId),
        })),

      loadFixtures: (rounds, matches, groups) =>
        set((s) => ({
          rounds: [...s.rounds, ...rounds],
          matches: [...s.matches, ...matches],
          groups: [...s.groups, ...groups],
        })),
    }),
    { name: 'tiesheet.matches.v1' },
  ),
)
