/** Tournament and format configuration types. */

import type { ParticipantType } from './sport'

/**
 * Structural family of a tournament. The bracket/fixture generator dispatches
 * on this one value; everything else is driven by `FormatConfig`.
 */
export type FormatType =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'group_knockout'

export type TournamentStatus = 'draft' | 'setup' | 'active' | 'completed'

/** How participants are placed into the initial fixtures. */
export type DrawMethod = 'random' | 'seeded' | 'manual'

/**
 * All tunable knobs of a tournament's structure, in one serializable record.
 *
 * Not every field applies to every format — the wizard only surfaces the
 * relevant ones, and the generator ignores the rest. Keeping them in a single
 * flat shape means adding a format never migrates the stored data.
 */
export interface FormatConfig {
  /** ── Elimination ─────────────────────────────────────────────── */
  /** Play a 3rd-place playoff between the losing semi-finalists. */
  thirdPlaceMatch: boolean
  /**
   * Seeds ranked within the top N cannot meet before this round index
   * (0 = no protection, 1 = not in round 1, 2 = not before round 2…).
   */
  seedProtectionRounds: number
  /** Double elimination only: replay the grand final if the LB side wins it. */
  grandFinalReset: boolean

  /** ── Round robin ──────────────────────────────────────────────── */
  /** Everyone plays everyone twice (home and away). */
  doubleRoundRobin: boolean

  /** ── Group stage ──────────────────────────────────────────────── */
  groupCount: number
  /** How many teams from each group progress to the knockout stage. */
  advancePerGroup: number
  /** Groups play each other twice. */
  groupDoubleRoundRobin: boolean

  /** ── Match format ─────────────────────────────────────────────── */
  /**
   * Sets/games needed to decide a match: 1 (single game), 3, 5 or 7.
   * Overrides the sport's own period count when set.
   */
  bestOf: 1 | 3 | 5 | 7

  /** ── Points (overrides the sport defaults when not null) ──────── */
  pointsWin: number | null
  pointsDraw: number | null
  pointsLoss: number | null

  /** ── Draw ─────────────────────────────────────────────────────── */
  drawMethod: DrawMethod
}

/** A tournament. */
export interface Tournament {
  id: string
  /** URL-safe identifier used by the public page. */
  slug: string
  name: string
  description: string
  sportId: string
  /** Cached from the sport at creation time so lists render without a lookup. */
  participantType: ParticipantType
  /** Data URL or remote URL. */
  logoUrl: string | null

  organizer: string
  venue: string
  location: string
  startDate: string | null
  endDate: string | null
  contactName: string
  contactEmail: string
  contactPhone: string

  formatType: FormatType
  config: FormatConfig

  status: TournamentStatus
  /** True once fixtures have been generated at least once. */
  fixturesGenerated: boolean
  /** Whether the public page is reachable. */
  publicVisible: boolean

  createdAt: string
  updatedAt: string
}

/** A stage of a tournament — a group phase or a knockout round. */
export type RoundKind = 'group' | 'winners' | 'losers' | 'grand_final' | 'third_place' | 'league'

/**
 * A round groups the matches played at the same depth of the tournament.
 * Rounds are generated, never authored by hand.
 */
export interface Round {
  id: string
  tournamentId: string
  /** Human name: 'Round of 16', 'Quarter Final', 'Matchday 3', 'Losers Round 2'. */
  name: string
  shortName: string
  kind: RoundKind
  /** 0-based ordering across the whole tournament. */
  position: number
  /** For elimination rounds: how many matches this round contains. */
  matchCount: number
}

/** Free-form per-tournament settings that are not structural. */
export interface TournamentSettings {
  tournamentId: string
  /** Minutes between consecutive matches at the same venue. */
  matchGapMinutes: number
  /** Minimum rest for a participant between two of their matches. */
  minRestMinutes: number
  /** Earliest kick-off used by the auto-scheduler, 'HH:mm'. */
  dayStartTime: string
  /** Latest kick-off used by the auto-scheduler, 'HH:mm'. */
  dayEndTime: string
  /** Matches scheduled per day when auto-scheduling. */
  matchesPerDay: number
}
