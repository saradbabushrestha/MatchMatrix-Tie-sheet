/**
 * Sport configuration types.
 *
 * A sport is *data*, never code. Everything the tournament engine needs to know
 * about how a sport is played, scored and ranked lives in a `SportConfig`
 * record — which means a new sport (including a fully custom one defined by an
 * organizer at runtime) never requires a change to the engine.
 */

/** Whether a sport is contested by teams or by individual competitors. */
export type ParticipantType = 'team' | 'individual'

/**
 * How a match is scored. This drives score entry UI, winner resolution and the
 * default standings columns — it is the single most important sport switch.
 *
 * - `aggregate` — one number per side (football goals, basketball points).
 * - `sets`      — a series of games/sets; the winner is whoever wins the most
 *                 (badminton, tennis, table tennis, volleyball, esports maps).
 * - `innings`   — runs + wickets over a number of overs (cricket).
 */
export type ScoringType = 'aggregate' | 'sets' | 'innings'

/** Canonical, engine-computed statistic keys. */
export type StatKey =
  | 'played'
  | 'won'
  | 'drawn'
  | 'lost'
  | 'noResult'
  | 'scoreFor'
  | 'scoreAgainst'
  | 'scoreDiff'
  | 'setsFor'
  | 'setsAgainst'
  | 'setsDiff'
  | 'points'
  | 'winPct'
  | 'nrr'
  | 'streak'

/** A tiebreaker is a stat key plus a direction. Fully serializable. */
export interface Tiebreaker {
  key: StatKey | 'headToHead' | 'name' | 'seed'
  dir: 'asc' | 'desc'
}

/** Competition points awarded per result. */
export interface PointsRule {
  win: number
  draw: number
  loss: number
  /** Awarded for a walkover/forfeit win, defaults to `win` when null. */
  walkover?: number | null
  /** Awarded to each side when a match ends with no result (rain, etc.). */
  noResult?: number
}

/** Period / set structure of a match. */
export interface PeriodConfig {
  /**
   * Number of scoring segments in a match. For `sets` scoring this is the
   * maximum number of sets (i.e. best-of N); for `aggregate` it is halves or
   * quarters; for `innings` it is innings per side.
   */
  count: number
  /** Singular noun shown in the UI: 'Half', 'Quarter', 'Set', 'Game', 'Innings'. */
  label: string
  /** Minutes per period, when the sport is time-boxed. */
  durationMinutes: number | null
  /**
   * For `sets` scoring: sets needed to win the match. Derived as
   * `ceil(count / 2)` when null.
   */
  setsToWin?: number | null
  /** Target points within a single set/game (21 badminton, 11 TT, 25 volleyball). */
  pointsPerSet?: number | null
}

/**
 * The complete, serializable description of a sport.
 *
 * `builtIn` configs ship with the app; organizers can add their own with the
 * exact same shape, so custom sports are first-class rather than a special case.
 */
export interface SportConfig {
  id: string
  name: string
  /** Short label for dense UI (badges, table headers). */
  shortName: string
  /** Emoji used as a lightweight, dependency-free sport glyph. */
  icon: string
  /** Lucide icon name for chrome that wants a line icon instead of an emoji. */
  lucideIcon: string
  participantType: ParticipantType
  scoringType: ScoringType

  /** Players per team on the field/court at once. 1 for individual sports. */
  teamSize: number
  /** Maximum squad size including substitutes. */
  squadSize: number

  periods: PeriodConfig
  /** Total scheduled minutes including breaks — used for conflict detection. */
  matchDurationMinutes: number

  /** Can a match legitimately end level? False forces a decider. */
  allowsDraw: boolean
  /** How a level match is settled when draws are not allowed. */
  drawResolution: 'shootout' | 'extra_period' | 'super_over' | 'none'
  /** Label for the decider in score entry UI ('Penalties', 'Super Over'…). */
  drawResolutionLabel: string

  pointsRule: PointsRule
  /** Ordered standings columns, by canonical stat key. */
  standingsColumns: StatKey[]
  /** Ordered tiebreakers applied when competition points are level. */
  tiebreakers: Tiebreaker[]

  /** Noun for the primary score unit, singular/plural: ['goal','goals']. */
  scoreNoun: [string, string]
  /** Player position options offered in the roster editor. */
  positions: string[]
  /** Official roles this sport typically assigns to a match. */
  officialRoles: string[]

  builtIn: boolean
  createdAt?: string
  updatedAt?: string
}

/** Fields an organizer fills in when defining a custom sport. */
export type CustomSportDraft = Omit<SportConfig, 'id' | 'builtIn' | 'createdAt' | 'updatedAt'>
