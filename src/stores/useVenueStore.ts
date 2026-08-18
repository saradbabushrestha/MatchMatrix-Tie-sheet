/** Venue and official store. */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Official, Venue } from '@/types'
import { nowISO, uid } from '@/lib/utils'

interface VenueState {
  venues: Venue[]
  officials: Official[]

  addVenue: (draft: { tournamentId: string; name: string; address?: string; capacity?: number }) => Venue
  updateVenue: (id: string, patch: Partial<Venue>) => void
  removeVenue: (id: string) => void

  addOfficial: (draft: { tournamentId: string; name: string; role: string; phone?: string }) => Official
  updateOfficial: (id: string, patch: Partial<Official>) => void
  removeOfficial: (id: string) => void

  removeByTournament: (tournamentId: string) => void
  loadVenues: (venues: Venue[], officials: Official[]) => void
}

export const useVenueStore = create<VenueState>()(
  persist(
    (set) => ({
      venues: [],
      officials: [],

      addVenue: (draft) => {
        const venue: Venue = {
          id: uid(),
          tournamentId: draft.tournamentId,
          name: draft.name.trim(),
          address: draft.address?.trim() ?? null,
          capacity: draft.capacity ?? 1,
          createdAt: nowISO(),
        }
        set((s) => ({ venues: [...s.venues, venue] }))
        return venue
      },

      updateVenue: (id, patch) =>
        set((s) => ({ venues: s.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

      removeVenue: (id) => set((s) => ({ venues: s.venues.filter((v) => v.id !== id) })),

      addOfficial: (draft) => {
        const official: Official = {
          id: uid(),
          tournamentId: draft.tournamentId,
          name: draft.name.trim(),
          role: draft.role,
          phone: draft.phone?.trim() ?? null,
          createdAt: nowISO(),
        }
        set((s) => ({ officials: [...s.officials, official] }))
        return official
      },

      updateOfficial: (id, patch) =>
        set((s) => ({ officials: s.officials.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),

      removeOfficial: (id) => set((s) => ({ officials: s.officials.filter((o) => o.id !== id) })),

      removeByTournament: (tournamentId) =>
        set((s) => ({
          venues: s.venues.filter((v) => v.tournamentId !== tournamentId),
          officials: s.officials.filter((o) => o.tournamentId !== tournamentId),
        })),

      loadVenues: (venues, officials) =>
        set((s) => ({ venues: [...s.venues, ...venues], officials: [...s.officials, ...officials] })),
    }),
    { name: 'tiesheet.venues.v1' },
  ),
)
