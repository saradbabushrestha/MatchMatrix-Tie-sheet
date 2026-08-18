/**
 * Sport registry store.
 *
 * Holds the built-in sports plus any custom sports the organizer defines. Both
 * live in the same shape, so a custom sport is never a second-class citizen.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomSportDraft, SportConfig } from '@/types'
import { BUILT_IN_SPORTS } from '@/config/sports'
import { nowISO, slugify, uid } from '@/lib/utils'

interface SportState {
  /** Custom sports only — built-ins are merged in by the selectors. */
  customSports: SportConfig[]
  addSport: (draft: CustomSportDraft) => SportConfig
  updateSport: (id: string, patch: Partial<SportConfig>) => void
  removeSport: (id: string) => void
}

export const useSportStore = create<SportState>()(
  persist(
    (set) => ({
      customSports: [],

      addSport: (draft) => {
        const sport: SportConfig = {
          ...draft,
          id: `custom-${slugify(draft.name, false)}-${uid().slice(0, 4)}`,
          builtIn: false,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        }
        set((s) => ({ customSports: [...s.customSports, sport] }))
        return sport
      },

      updateSport: (id, patch) =>
        set((s) => ({
          customSports: s.customSports.map((sport) =>
            sport.id === id ? { ...sport, ...patch, updatedAt: nowISO() } : sport,
          ),
        })),

      removeSport: (id) =>
        set((s) => ({ customSports: s.customSports.filter((sport) => sport.id !== id) })),
    }),
    { name: 'tiesheet.sports.v1' },
  ),
)

/** Every available sport, built-in first. */
export function useAllSports(): SportConfig[] {
  const custom = useSportStore((s) => s.customSports)
  return [...BUILT_IN_SPORTS, ...custom]
}

/**
 * Look up a sport, falling back to football so a tournament whose custom sport
 * was deleted still renders instead of crashing.
 */
export function useSport(sportId: string | undefined): SportConfig {
  const custom = useSportStore((s) => s.customSports)
  return resolveSport(sportId, custom)
}

export function resolveSport(sportId: string | undefined, custom: SportConfig[] = []): SportConfig {
  const all = [...BUILT_IN_SPORTS, ...custom]
  return all.find((s) => s.id === sportId) ?? BUILT_IN_SPORTS[0]
}

/** Non-reactive read, for use inside services. */
export function getSport(sportId: string | undefined): SportConfig {
  return resolveSport(sportId, useSportStore.getState().customSports)
}
