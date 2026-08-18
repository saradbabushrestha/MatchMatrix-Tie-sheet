/** Tournament store — the tournaments themselves plus their non-structural settings. */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FormatConfig, FormatType, Tournament, TournamentSettings, TournamentStatus } from '@/types'
import { DEFAULT_FORMAT_CONFIG } from '@/config/formats'
import { DEFAULT_SETTINGS } from '@/engine/schedule'
import { nowISO, slugify, uid } from '@/lib/utils'
import { getSport } from './useSportStore'

export interface TournamentDraft {
  name: string
  description?: string
  sportId: string
  logoUrl?: string | null
  organizer?: string
  venue?: string
  location?: string
  startDate?: string | null
  endDate?: string | null
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  formatType: FormatType
  config?: Partial<FormatConfig>
}

interface TournamentState {
  tournaments: Tournament[]
  settings: Record<string, TournamentSettings>
  /** The tournament currently open in the dashboard. */
  activeId: string | null

  createTournament: (draft: TournamentDraft) => Tournament
  updateTournament: (id: string, patch: Partial<Tournament>) => void
  updateConfig: (id: string, patch: Partial<FormatConfig>) => void
  updateSettings: (id: string, patch: Partial<TournamentSettings>) => void
  setStatus: (id: string, status: TournamentStatus) => void
  removeTournament: (id: string) => void
  duplicateTournament: (id: string) => Tournament | null
  setActive: (id: string | null) => void
  /** Bulk-load, used by the seed-data importer. */
  loadTournaments: (tournaments: Tournament[], settings: TournamentSettings[]) => void
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      tournaments: [],
      settings: {},
      activeId: null,

      createTournament: (draft) => {
        const sport = getSport(draft.sportId)
        const id = uid()
        const ts = nowISO()

        const tournament: Tournament = {
          id,
          slug: slugify(draft.name),
          name: draft.name.trim(),
          description: draft.description?.trim() ?? '',
          sportId: draft.sportId,
          participantType: sport.participantType,
          logoUrl: draft.logoUrl ?? null,
          organizer: draft.organizer?.trim() ?? '',
          venue: draft.venue?.trim() ?? '',
          location: draft.location?.trim() ?? '',
          startDate: draft.startDate ?? null,
          endDate: draft.endDate ?? null,
          contactName: draft.contactName?.trim() ?? '',
          contactEmail: draft.contactEmail?.trim() ?? '',
          contactPhone: draft.contactPhone?.trim() ?? '',
          formatType: draft.formatType,
          config: { ...DEFAULT_FORMAT_CONFIG, ...draft.config },
          status: 'setup',
          fixturesGenerated: false,
          publicVisible: false,
          createdAt: ts,
          updatedAt: ts,
        }

        set((s) => ({
          tournaments: [tournament, ...s.tournaments],
          settings: { ...s.settings, [id]: { tournamentId: id, ...DEFAULT_SETTINGS } },
          activeId: id,
        }))

        return tournament
      },

      updateTournament: (id, patch) =>
        set((s) => ({
          tournaments: s.tournaments.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t,
          ),
        })),

      updateConfig: (id, patch) =>
        set((s) => ({
          tournaments: s.tournaments.map((t) =>
            t.id === id ? { ...t, config: { ...t.config, ...patch }, updatedAt: nowISO() } : t,
          ),
        })),

      updateSettings: (id, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            // `tournamentId` goes last so a stale patch cannot re-point the row.
            [id]: { ...DEFAULT_SETTINGS, ...s.settings[id], ...patch, tournamentId: id },
          },
        })),

      setStatus: (id, status) =>
        set((s) => ({
          tournaments: s.tournaments.map((t) =>
            t.id === id ? { ...t, status, updatedAt: nowISO() } : t,
          ),
        })),

      removeTournament: (id) =>
        set((s) => {
          const { [id]: _removed, ...rest } = s.settings
          return {
            tournaments: s.tournaments.filter((t) => t.id !== id),
            settings: rest,
            activeId: s.activeId === id ? null : s.activeId,
          }
        }),

      duplicateTournament: (id) => {
        const source = get().tournaments.find((t) => t.id === id)
        if (!source) return null
        const newId = uid()
        const ts = nowISO()
        const copy: Tournament = {
          ...source,
          id: newId,
          name: `${source.name} (copy)`,
          slug: slugify(`${source.name} copy`),
          status: 'setup',
          fixturesGenerated: false,
          publicVisible: false,
          createdAt: ts,
          updatedAt: ts,
        }
        set((s) => ({
          tournaments: [copy, ...s.tournaments],
          settings: {
            ...s.settings,
            [newId]: { ...(s.settings[id] ?? { tournamentId: id, ...DEFAULT_SETTINGS }), tournamentId: newId },
          },
        }))
        return copy
      },

      setActive: (id) => set({ activeId: id }),

      loadTournaments: (tournaments, settings) =>
        set((s) => ({
          tournaments: [...tournaments, ...s.tournaments],
          settings: {
            ...s.settings,
            ...Object.fromEntries(settings.map((x) => [x.tournamentId, x])),
          },
        })),
    }),
    { name: 'tiesheet.tournaments.v1' },
  ),
)

/** Settings for a tournament, with defaults filled in. */
export function useTournamentSettings(tournamentId: string | undefined): TournamentSettings {
  const settings = useTournamentStore((s) => (tournamentId ? s.settings[tournamentId] : undefined))
  return settings ?? { tournamentId: tournamentId ?? '', ...DEFAULT_SETTINGS }
}

export function useTournament(id: string | undefined): Tournament | undefined {
  return useTournamentStore((s) => s.tournaments.find((t) => t.id === id))
}

export function useTournamentBySlug(slug: string | undefined): Tournament | undefined {
  return useTournamentStore((s) => s.tournaments.find((t) => t.slug === slug))
}
