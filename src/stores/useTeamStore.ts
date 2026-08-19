/**
 * Team and player store.
 *
 * Individual-sport competitors are stored as players with a null `teamId`, so
 * one store serves both participant types.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Participant, Player, Team } from '@/types'
import { colorFor, guessShortName, nowISO, uid } from '@/lib/utils'
import { createSupabaseStorage } from '@/lib/supabaseStorage'

export interface TeamDraft {
  tournamentId: string
  name: string
  shortName?: string
  logoUrl?: string | null
  color?: string
  coach?: string | null
  manager?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  seed?: number | null
  groupId?: string | null
  notes?: string | null
}

export interface PlayerDraft {
  tournamentId: string
  teamId: string | null
  name: string
  jerseyNumber?: number | null
  position?: string | null
  photoUrl?: string | null
  isCaptain?: boolean
  phone?: string | null
  email?: string | null
  seed?: number | null
  notes?: string | null
}

interface TeamState {
  teams: Team[]
  players: Player[]

  addTeam: (draft: TeamDraft) => Team
  addTeams: (drafts: TeamDraft[]) => Team[]
  updateTeam: (id: string, patch: Partial<Team>) => void
  removeTeam: (id: string) => void
  duplicateTeam: (id: string) => Team | null
  reorderTeams: (tournamentId: string, orderedIds: string[]) => void

  addPlayer: (draft: PlayerDraft) => Player
  addPlayers: (drafts: PlayerDraft[]) => Player[]
  updatePlayer: (id: string, patch: Partial<Player>) => void
  removePlayer: (id: string) => void

  /** Assign seeds from an ordered id list. */
  setSeeds: (kind: 'team' | 'player', orderedIds: string[]) => void
  /** Clear every seed for a tournament. */
  clearSeeds: (tournamentId: string) => void
  /** Assign group membership in bulk after a draw. */
  setGroups: (assignments: { teamId: string; groupId: string | null }[]) => void

  removeByTournament: (tournamentId: string) => void
  loadTeams: (teams: Team[], players: Player[]) => void
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      teams: [],
      players: [],

      addTeam: (draft) => {
        const team = buildTeam(draft)
        set((s) => ({ teams: [...s.teams, team] }))
        return team
      },

      addTeams: (drafts) => {
        const built = drafts.map(buildTeam)
        set((s) => ({ teams: [...s.teams, ...built] }))
        return built
      },

      updateTeam: (id, patch) =>
        set((s) => ({
          teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t)),
        })),

      removeTeam: (id) =>
        set((s) => ({
          teams: s.teams.filter((t) => t.id !== id),
          // Squad members go with the team.
          players: s.players.filter((p) => p.teamId !== id),
        })),

      duplicateTeam: (id) => {
        const source = get().teams.find((t) => t.id === id)
        if (!source) return null
        const copy = buildTeam({
          tournamentId: source.tournamentId,
          name: `${source.name} (copy)`,
          shortName: source.shortName,
          logoUrl: source.logoUrl,
          color: source.color,
          coach: source.coach,
          manager: source.manager,
          contactPhone: source.contactPhone,
          contactEmail: source.contactEmail,
          groupId: source.groupId,
          notes: source.notes,
        })
        const squad = get()
          .players.filter((p) => p.teamId === id)
          .map((p) => buildPlayer({ ...p, teamId: copy.id }))

        set((s) => ({ teams: [...s.teams, copy], players: [...s.players, ...squad] }))
        return copy
      },

      reorderTeams: (tournamentId, orderedIds) =>
        set((s) => {
          const index = new Map(orderedIds.map((id, i) => [id, i]))
          const inTournament = s.teams.filter((t) => t.tournamentId === tournamentId)
          const others = s.teams.filter((t) => t.tournamentId !== tournamentId)
          const sorted = inTournament
            .slice()
            .sort((a, b) => (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0))
          return { teams: [...others, ...sorted] }
        }),

      addPlayer: (draft) => {
        const player = buildPlayer(draft)
        set((s) => ({ players: [...s.players, player] }))
        return player
      },

      addPlayers: (drafts) => {
        const built = drafts.map(buildPlayer)
        set((s) => ({ players: [...s.players, ...built] }))
        return built
      },

      updatePlayer: (id, patch) =>
        set((s) => ({
          players: s.players.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowISO() } : p)),
        })),

      removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.id !== id) })),

      setSeeds: (kind, orderedIds) =>
        set((s) => {
          const seeds = new Map(orderedIds.map((id, i) => [id, i + 1]))
          if (kind === 'team') {
            return {
              teams: s.teams.map((t) => (seeds.has(t.id) ? { ...t, seed: seeds.get(t.id) as number } : t)),
            }
          }
          return {
            players: s.players.map((p) =>
              seeds.has(p.id) ? { ...p, seed: seeds.get(p.id) as number } : p,
            ),
          }
        }),

      clearSeeds: (tournamentId) =>
        set((s) => ({
          teams: s.teams.map((t) => (t.tournamentId === tournamentId ? { ...t, seed: null } : t)),
          players: s.players.map((p) =>
            p.tournamentId === tournamentId ? { ...p, seed: null } : p,
          ),
        })),

      setGroups: (assignments) =>
        set((s) => {
          const map = new Map(assignments.map((a) => [a.teamId, a.groupId]))
          return {
            teams: s.teams.map((t) => (map.has(t.id) ? { ...t, groupId: map.get(t.id) ?? null } : t)),
          }
        }),

      removeByTournament: (tournamentId) =>
        set((s) => ({
          teams: s.teams.filter((t) => t.tournamentId !== tournamentId),
          players: s.players.filter((p) => p.tournamentId !== tournamentId),
        })),

      loadTeams: (teams, players) =>
        set((s) => ({ teams: [...s.teams, ...teams], players: [...s.players, ...players] })),
    }),
    { 
      name: 'tiesheet.teams.v1',
      storage: createSupabaseStorage<TeamState>('tiesheet.teams.v1')
    },
  ),
)

function buildTeam(draft: TeamDraft): Team {
  const ts = nowISO()
  const name = draft.name.trim()
  return {
    id: uid(),
    tournamentId: draft.tournamentId,
    name,
    shortName: draft.shortName?.trim() || guessShortName(name),
    logoUrl: draft.logoUrl ?? null,
    color: draft.color ?? colorFor(name),
    coach: draft.coach ?? null,
    manager: draft.manager ?? null,
    contactPhone: draft.contactPhone ?? null,
    contactEmail: draft.contactEmail ?? null,
    seed: draft.seed ?? null,
    groupId: draft.groupId ?? null,
    notes: draft.notes ?? null,
    createdAt: ts,
    updatedAt: ts,
  }
}

function buildPlayer(draft: PlayerDraft): Player {
  const ts = nowISO()
  return {
    id: uid(),
    tournamentId: draft.tournamentId,
    teamId: draft.teamId,
    name: draft.name.trim(),
    jerseyNumber: draft.jerseyNumber ?? null,
    position: draft.position ?? null,
    photoUrl: draft.photoUrl ?? null,
    isCaptain: draft.isCaptain ?? false,
    phone: draft.phone ?? null,
    email: draft.email ?? null,
    seed: draft.seed ?? null,
    notes: draft.notes ?? null,
    createdAt: ts,
    updatedAt: ts,
  }
}

/** Project a team into the engine's participant shape. */
export function teamToParticipant(team: Team): Participant {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    logoUrl: team.logoUrl,
    color: team.color,
    seed: team.seed,
    groupId: team.groupId,
    kind: 'team',
  }
}

/** Project an individual competitor into the engine's participant shape. */
export function playerToParticipant(player: Player): Participant {
  return {
    id: player.id,
    name: player.name,
    shortName: guessShortName(player.name),
    logoUrl: player.photoUrl,
    color: colorFor(player.name),
    seed: player.seed,
    groupId: null,
    kind: 'player',
  }
}
