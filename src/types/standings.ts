/** Standings types. */

import type { Participant } from './participant'
import type { StatKey } from './sport'

/** One row of a standings table. Every canonical stat is always computed. */
export interface StandingsRow {
  participant: Participant
  position: number
  played: number
  won: number
  drawn: number
  lost: number
  noResult: number
  scoreFor: number
  scoreAgainst: number
  scoreDiff: number
  setsFor: number
  setsAgainst: number
  setsDiff: number
  points: number
  /** 0–1. */
  winPct: number
  /** Cricket net run rate. */
  nrr: number
  /** Current run, positive for wins, negative for losses. */
  streak: number
  /** Most recent results, oldest first, capped at 5. */
  form: ('W' | 'D' | 'L' | 'N')[]
  /** True when this row is inside the qualification cut for its group. */
  qualified: boolean
}

/** A standings table — the whole league, or one group. */
export interface StandingsTable {
  /** Null for a single league-wide table. */
  groupId: string | null
  groupName: string | null
  rows: StandingsRow[]
  columns: StatKey[]
  /** How many top rows advance, for the qualification highlight. */
  advanceCount: number
}
