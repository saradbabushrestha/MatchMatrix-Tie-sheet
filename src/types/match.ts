/** Match, score and result types. */

export type MatchStatus =
  | 'pending'
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'walkover'
  | 'no_result'

export type Side = 'home' | 'away'

/** Winner of a match, or the reason there isn't one. */
export type Outcome = Side | 'draw' | null

/** One side's score in a match. */
export interface SideScore {
  /**
   * The primary aggregate figure: goals, points, runs, or — for `sets`
   * scoring — the number of sets won (derived from `periods`).
   */
  score: number
  /** Per-period / per-set breakdown, index-aligned with the other side. */
  periods: number[]
  /** Cricket: wickets lost. */
  wickets: number | null
  /** Cricket: overs faced, used for net run rate. */
  overs: number | null
}

/** The full score of a match. */
export interface MatchScore {
  home: SideScore
  away: SideScore
  /** Penalties / super over, used only when the sport disallows draws. */
  decider: { home: number; away: number } | null
}

/**
 * How a bracket slot gets its participant. A slot is either directly assigned
 * (round 1, or a group qualifier) or fed by another match's winner/loser — the
 * latter is what lets the engine recompute the whole bracket from results.
 */
export interface SlotSource {
  kind: 'winner' | 'loser' | 'group'
  /** Feeding match, for winner/loser sources. */
  matchId?: string
  /** Group id and 1-based finishing position, for group sources. */
  groupId?: string
  groupPosition?: number
}

/** A single match. */
export interface Match {
  id: string
  tournamentId: string
  roundId: string
  /** Sequential, human-facing match number across the tournament. */
  number: number

  /** Participant ids; null while the slot is undecided. */
  homeId: string | null
  awayId: string | null
  /** Where each slot's participant comes from. Null for a fixed assignment. */
  homeSource: SlotSource | null
  awaySource: SlotSource | null

  /** Group id for group-stage matches. */
  groupId: string | null

  score: MatchScore | null
  status: MatchStatus
  /** Cached outcome so lists and brackets don't re-resolve on every render. */
  outcome: Outcome
  /** Set when a side won because the opponent forfeited. */
  walkoverWinner: Side | null

  /** ── Scheduling ───────────────────────────────────────────────── */
  /** ISO date 'YYYY-MM-DD'. */
  date: string | null
  /** 'HH:mm'. */
  time: string | null
  venueId: string | null
  refereeId: string | null
  officialIds: string[]

  /** Where the winner goes. */
  winnerTo: { matchId: string; slot: Side } | null
  /** Where the loser goes — double elimination drops, and 3rd-place playoffs. */
  loserTo: { matchId: string; slot: Side } | null

  /** Bracket layout hint: position within its round, 0-based. */
  position: number
  /** True when a slot is empty because the opponent had a bye. */
  isBye: boolean

  notes: string
  createdAt: string
  updatedAt: string
}

/** A conflict found while validating the schedule. */
export interface ScheduleConflict {
  id: string
  kind: 'venue' | 'participant' | 'official' | 'missing'
  severity: 'error' | 'warning'
  message: string
  matchIds: string[]
}
