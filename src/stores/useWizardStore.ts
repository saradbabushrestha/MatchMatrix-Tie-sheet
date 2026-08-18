/**
 * Wizard store.
 *
 * The tournament builder's draft state, kept apart from the saved tournaments
 * so an abandoned wizard never pollutes the real data. Persisted so a
 * half-finished setup survives an accidental reload.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FormatConfig, FormatType } from '@/types'
import { DEFAULT_FORMAT_CONFIG } from '@/config/formats'

export type WizardStep = 0 | 1 | 2 | 3

/** One entrant typed into the wizard — a team, or an individual competitor. */
export interface DraftEntrant {
  /** Local-only key, replaced by a real id on save. */
  key: string
  name: string
  shortName: string
  seed: number | null
}

export interface WizardInfo {
  name: string
  description: string
  sportId: string
  logoUrl: string | null
  organizer: string
  venue: string
  location: string
  startDate: string | null
  endDate: string | null
  contactName: string
  contactEmail: string
  contactPhone: string
}

interface WizardState {
  step: WizardStep
  info: WizardInfo
  formatType: FormatType
  config: FormatConfig
  entrants: DraftEntrant[]

  setStep: (step: WizardStep) => void
  next: () => void
  back: () => void

  setInfo: (patch: Partial<WizardInfo>) => void
  setFormat: (formatType: FormatType) => void
  setConfig: (patch: Partial<FormatConfig>) => void

  addEntrant: (name: string) => void
  addEntrants: (names: string[]) => void
  updateEntrant: (key: string, patch: Partial<DraftEntrant>) => void
  removeEntrant: (key: string) => void
  moveEntrant: (key: string, direction: -1 | 1) => void
  shuffleEntrants: () => void
  clearEntrants: () => void

  reset: () => void
}

const emptyInfo: WizardInfo = {
  name: '',
  description: '',
  sportId: 'football',
  logoUrl: null,
  organizer: '',
  venue: '',
  location: '',
  startDate: null,
  endDate: null,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
}

let keyCounter = 0
function nextKey(): string {
  keyCounter += 1
  return `draft-${keyCounter}-${Math.random().toString(36).slice(2, 7)}`
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      step: 0,
      info: emptyInfo,
      formatType: 'single_elimination',
      config: DEFAULT_FORMAT_CONFIG,
      entrants: [],

      setStep: (step) => set({ step }),
      next: () => set((s) => ({ step: Math.min(3, s.step + 1) as WizardStep })),
      back: () => set((s) => ({ step: Math.max(0, s.step - 1) as WizardStep })),

      setInfo: (patch) => set((s) => ({ info: { ...s.info, ...patch } })),
      setFormat: (formatType) => set({ formatType }),
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      addEntrant: (name) =>
        set((s) => ({
          entrants: [...s.entrants, { key: nextKey(), name: name.trim(), shortName: '', seed: null }],
        })),

      addEntrants: (names) =>
        set((s) => ({
          entrants: [
            ...s.entrants,
            ...names
              .map((n) => n.trim())
              .filter(Boolean)
              .map((name) => ({ key: nextKey(), name, shortName: '', seed: null })),
          ],
        })),

      updateEntrant: (key, patch) =>
        set((s) => ({
          entrants: s.entrants.map((e) => (e.key === key ? { ...e, ...patch } : e)),
        })),

      removeEntrant: (key) => set((s) => ({ entrants: s.entrants.filter((e) => e.key !== key) })),

      moveEntrant: (key, direction) =>
        set((s) => {
          const index = s.entrants.findIndex((e) => e.key === key)
          const target = index + direction
          if (index < 0 || target < 0 || target >= s.entrants.length) return s
          const next = s.entrants.slice()
          ;[next[index], next[target]] = [next[target], next[index]]
          return { entrants: next }
        }),

      shuffleEntrants: () =>
        set((s) => {
          const next = s.entrants.slice()
          for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[next[i], next[j]] = [next[j], next[i]]
          }
          return { entrants: next }
        }),

      clearEntrants: () => set({ entrants: [] }),

      reset: () =>
        set({
          step: 0,
          info: emptyInfo,
          formatType: 'single_elimination',
          config: DEFAULT_FORMAT_CONFIG,
          entrants: [],
        }),
    }),
    { name: 'tiesheet.wizard.v1' },
  ),
)
