/**
 * The tournament format registry.
 *
 * Like sports, formats are data. Each entry describes what the format needs
 * from the organizer and what constraints it places on the participant count,
 * so the wizard can validate and explain itself without special-casing.
 */

import type { FormatConfig, FormatType } from '@/types'

/** Which `FormatConfig` fields a format actually uses. */
export type ConfigField =
  | 'thirdPlaceMatch'
  | 'seedProtectionRounds'
  | 'grandFinalReset'
  | 'doubleRoundRobin'
  | 'groupCount'
  | 'advancePerGroup'
  | 'groupDoubleRoundRobin'
  | 'bestOf'
  | 'points'
  | 'drawMethod'

export interface TournamentFormat {
  id: FormatType
  name: string
  tagline: string
  description: string
  icon: string
  lucideIcon: string
  /** Which config knobs to surface in the wizard. */
  fields: ConfigField[]
  minParticipants: number
  maxParticipants: number
  /** Does this format produce a standings table? */
  hasStandings: boolean
  /** Does this format produce a bracket? */
  hasBracket: boolean
  /** Plain-language notes shown as help text in the wizard. */
  notes: string[]
}

export const TOURNAMENT_FORMATS: TournamentFormat[] = [
  {
    id: 'single_elimination',
    name: 'Knockout',
    tagline: 'Single elimination',
    description:
      'Lose once and you are out. The fastest way to find a winner — ideal for one-day events and large entry lists.',
    icon: '🏆',
    lucideIcon: 'Trophy',
    fields: ['thirdPlaceMatch', 'seedProtectionRounds', 'bestOf', 'drawMethod'],
    minParticipants: 2,
    maxParticipants: 128,
    hasStandings: false,
    hasBracket: true,
    notes: [
      'Byes are given to the top seeds automatically when the entry count is not a power of two.',
      'Rounds are named for you: Round of 32, Round of 16, Quarter Final, Semi Final, Final.',
    ],
  },
  {
    id: 'double_elimination',
    name: 'Double Elimination',
    tagline: 'Winners & losers brackets',
    description:
      'Every entrant gets a second life. Losers drop into a second bracket and can still reach the grand final.',
    icon: '♻️',
    lucideIcon: 'GitFork',
    fields: ['grandFinalReset', 'seedProtectionRounds', 'bestOf', 'drawMethod'],
    minParticipants: 4,
    maxParticipants: 64,
    hasStandings: false,
    hasBracket: true,
    notes: [
      'Roughly twice as many matches as a straight knockout — budget the extra time.',
      'A grand final reset gives the losers-bracket winner a decider if they win the first grand final.',
    ],
  },
  {
    id: 'round_robin',
    name: 'Round Robin',
    tagline: 'League format',
    description:
      'Everyone plays everyone. The fairest format, ranked on a points table — best for smaller entry lists.',
    icon: '🔄',
    lucideIcon: 'RefreshCw',
    fields: ['doubleRoundRobin', 'points', 'bestOf'],
    minParticipants: 3,
    maxParticipants: 24,
    hasStandings: true,
    hasBracket: false,
    notes: [
      'Match count grows quickly: 8 entrants is 28 matches, 12 is 66.',
      'Fixtures are generated with the circle method so nobody sits out twice in a row.',
    ],
  },
  {
    id: 'group_knockout',
    name: 'Groups + Knockout',
    tagline: 'World-Cup style',
    description:
      'Groups play a mini league, then the top finishers cross over into a knockout bracket to decide the title.',
    icon: '🏆',
    lucideIcon: 'LayoutGrid',
    fields: [
      'groupCount',
      'advancePerGroup',
      'groupDoubleRoundRobin',
      'thirdPlaceMatch',
      'points',
      'bestOf',
      'drawMethod',
    ],
    minParticipants: 4,
    maxParticipants: 64,
    hasStandings: true,
    hasBracket: true,
    notes: [
      'Group winners are drawn against runners-up from a different group in the first knockout round.',
      'The knockout bracket appears automatically once every group match has a result.',
    ],
  },
]

export function getFormat(id: FormatType): TournamentFormat {
  const found = TOURNAMENT_FORMATS.find((f) => f.id === id)
  if (!found) throw new Error(`Unknown tournament format: ${id}`)
  return found
}

/** Sensible defaults for a brand-new tournament. */
export const DEFAULT_FORMAT_CONFIG: FormatConfig = {
  thirdPlaceMatch: true,
  seedProtectionRounds: 0,
  grandFinalReset: false,
  doubleRoundRobin: false,
  groupCount: 4,
  advancePerGroup: 2,
  groupDoubleRoundRobin: false,
  bestOf: 1,
  pointsWin: null,
  pointsDraw: null,
  pointsLoss: null,
  drawMethod: 'seeded',
}

/** Best-of choices offered for match format, with plain-language labels. */
export const BEST_OF_OPTIONS: { value: 1 | 3 | 5 | 7; label: string; hint: string }[] = [
  { value: 1, label: 'Single game', hint: 'One game decides the match' },
  { value: 3, label: 'Best of 3', hint: 'First to 2 wins' },
  { value: 5, label: 'Best of 5', hint: 'First to 3 wins' },
  { value: 7, label: 'Best of 7', hint: 'First to 4 wins' },
]

/** Draw method choices. */
export const DRAW_METHODS: { value: 'random' | 'seeded' | 'manual'; label: string; hint: string }[] = [
  { value: 'seeded', label: 'Seeded draw', hint: 'Strongest entrants kept apart until later rounds' },
  { value: 'random', label: 'Random draw', hint: 'Shuffle everyone into the bracket' },
  { value: 'manual', label: 'Manual draw', hint: 'You choose every matchup yourself' },
]
