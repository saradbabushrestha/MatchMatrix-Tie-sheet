/**
 * Demo tournaments.
 *
 * Built by driving the real stores and engine rather than by hand-authoring
 * JSON — so the seeded brackets, standings and advancement are exactly what the
 * app would produce, and the demo can never drift out of sync with the code.
 */

import type { FormatType, MatchScore, Tournament } from '@/types'
import { useTournamentStore } from '@/stores/useTournamentStore'
import { useTeamStore } from '@/stores/useTeamStore'
import { useMatchStore } from '@/stores/useMatchStore'
import { useVenueStore } from '@/stores/useVenueStore'
import { getSport } from '@/stores/useSportStore'
import {
  autoScheduleTournament,
  generateTournamentFixtures,
  saveMatchResult,
} from '@/services/tournamentService'
import { emptyScore, periodCount } from '@/engine/scoring'
import { toISODate } from '@/lib/date'

/* ── Sample rosters ───────────────────────────────────────────────────────── */

const FOOTBALL_TEAMS = [
  'Budhanilkantha FC', 'Kirtipur United', 'Boudha Warriors', 'Thamel City',
  'Patan Royals', 'Bhaktapur Eleven', 'Lalitpur Lions', 'Chabahil Stars',
  'Maharajgunj FC', 'Balaju Rangers', 'Swayambhu Athletic', 'Jorpati Rovers',
  'Gokarna Green', 'Tokha Titans', 'Sundarijal Sporting', 'Naxal Nomads',
]

const CRICKET_TEAMS = [
  'Kathmandu Kings', 'Pokhara Rhinos', 'Chitwan Tigers', 'Biratnagar Warriors',
  'Lalitpur Patriots', 'Bhairahawa Gladiators', 'Janakpur Royals', 'Dhangadhi Stars',
]

const BASKETBALL_TEAMS = [
  'Golden Gate Hoops', 'Nepal Police Club', 'Tribhuvan Army', 'Mahabir Ballers',
  'Sherpa Slammers', 'Everest Dunkers', 'Himalayan Heat', 'Kathmandu Kobras',
]

const BADMINTON_PLAYERS = [
  'Sarad Shrestha', 'Anita Rai', 'Bimal Karki', 'Puja Sharma',
  'Nabin Gurung', 'Sita Tamang', 'Rajesh Thapa', 'Manisha Adhikari',
  'Dipesh Magar', 'Kabita Bhandari', 'Suman Lama', 'Rekha Chaudhary',
  'Hari Poudel', 'Sunita Basnet', 'Arjun Bhattarai', 'Nisha Maharjan',
  'Kiran Dahal', 'Laxmi Neupane', 'Prakash Joshi', 'Sabina Khadka',
  'Rohit Shakya', 'Deepa Pandey', 'Bikash Subedi', 'Asmita Ghimire',
  'Sanjay Bista', 'Pratima Acharya', 'Umesh Regmi', 'Sarita Koirala',
  'Naresh Pun', 'Bhawana Sapkota', 'Gopal Bhusal', 'Ritu Malla',
]

const FIRST_NAMES = [
  'Ram', 'Hari', 'Bikash', 'Suman', 'Nabin', 'Kiran', 'Rajesh', 'Dipesh',
  'Anil', 'Sunil', 'Prakash', 'Rohit', 'Sanjay', 'Umesh', 'Naresh', 'Gopal',
  'Binod', 'Kumar', 'Manoj', 'Deepak', 'Santosh', 'Arjun', 'Pawan', 'Nirajan',
]

const LAST_NAMES = [
  'Shrestha', 'Thapa', 'Rai', 'Gurung', 'Tamang', 'Magar', 'Karki', 'Lama',
  'Adhikari', 'Poudel', 'Basnet', 'Bhattarai', 'Maharjan', 'Dahal', 'Joshi',
]

/** Deterministic pseudo-random, so the demo data is identical on every load. */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function playerName(random: () => number): string {
  const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]
  return `${first} ${last}`
}

function daysFromNow(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return toISODate(d)
}

/* ── Result filling ───────────────────────────────────────────────────────── */

/**
 * Build a plausible score for a sport.
 *
 * Reads the sport config for its shape, so a new sport gets sensible demo
 * results without this function learning about it.
 */
function inventScore(sportId: string, bestOf: number, random: () => number): MatchScore {
  const sport = getSport(sportId)
  const score = emptyScore(sport, bestOf)
  const count = periodCount(sport, bestOf)

  if (sport.scoringType === 'sets') {
    const target = sport.periods.pointsPerSet ?? 21
    const needed = Math.ceil(count / 2)
    // Decide a winner, then fill sets until they reach the required total.
    const homeWins = random() > 0.5
    let hs = 0
    let as = 0
    for (let i = 0; i < count; i++) {
      if (hs === needed || as === needed) break
      // Let the eventual loser take a set or two so scorelines look real.
      const homeTakesSet = homeWins ? hs < needed && (as >= 1 || random() > 0.35) : random() > 0.65
      const winnerScore = target
      const loserScore = Math.max(0, target - 2 - Math.floor(random() * 8))
      if (homeTakesSet) {
        score.home.periods[i] = winnerScore
        score.away.periods[i] = loserScore
        hs++
      } else {
        score.home.periods[i] = loserScore
        score.away.periods[i] = winnerScore
        as++
      }
    }
    // `normalizeScore` derives the set tally on save.
    return score
  }

  if (sport.scoringType === 'innings') {
    const overs = 20
    const homeRuns = 120 + Math.floor(random() * 90)
    const awayRuns = 120 + Math.floor(random() * 90)
    // Avoid a tie, since cricket here does not allow draws.
    const adjusted = homeRuns === awayRuns ? awayRuns - 4 : awayRuns
    score.home.score = homeRuns
    score.home.wickets = 3 + Math.floor(random() * 7)
    score.home.overs = overs
    score.away.score = adjusted
    score.away.wickets = 3 + Math.floor(random() * 7)
    score.away.overs = adjusted < homeRuns ? overs : 18 + Math.floor(random() * 3)
    return score
  }

  // Aggregate sports: pick a realistic range from the score noun's usual scale.
  const isHighScoring = sport.id === 'basketball' || sport.matchDurationMinutes > 80
  const base = isHighScoring ? 68 : 0
  const spread = isHighScoring ? 28 : 4

  let home = base + Math.floor(random() * (spread + 1))
  let away = base + Math.floor(random() * (spread + 1))

  if (!sport.allowsDraw && home === away) away = Math.max(0, away - 1 - Math.floor(random() * 3))

  score.home.score = home
  score.away.score = away

  // Fill period splits so the score breakdown looks entered, not synthesised.
  if (count > 1) {
    const split = (total: number) => {
      const parts = Array.from({ length: count }, () => 0)
      let left = total
      for (let i = 0; i < count - 1; i++) {
        const take = Math.floor(random() * (left + 1))
        parts[i] = take
        left -= take
      }
      parts[count - 1] = left
      return parts
    }
    score.home.periods = split(home)
    score.away.periods = split(away)
  }

  return score
}

/**
 * Play a fraction of a tournament's matches, round by round.
 *
 * Results are entered through the same service the UI uses, so advancement,
 * standings and status transitions all run for real.
 */
function playMatches(tournamentId: string, fraction: number, random: () => number): void {
  const tournament = useTournamentStore.getState().tournaments.find((t) => t.id === tournamentId)
  if (!tournament) return

  const rounds = useMatchStore
    .getState()
    .rounds.filter((r) => r.tournamentId === tournamentId)
    .sort((a, b) => a.position - b.position)

  const playable = useMatchStore
    .getState()
    .matches.filter((m) => m.tournamentId === tournamentId && !m.isBye)

  const target = Math.floor(playable.length * fraction)
  let played = 0

  // Work forward through the rounds so winners are available downstream.
  for (const round of rounds) {
    if (played >= target) break

    const inRound = useMatchStore
      .getState()
      .matches.filter((m) => m.roundId === round.id && !m.isBye)
      .sort((a, b) => a.number - b.number)

    for (const match of inRound) {
      if (played >= target) break

      // Re-read: an earlier result may have filled this match's slots.
      const current = useMatchStore.getState().matches.find((m) => m.id === match.id)
      if (!current || !current.homeId || !current.awayId) continue
      if (current.status === 'completed' || current.status === 'walkover') continue

      saveMatchResult(tournamentId, {
        matchId: current.id,
        score: inventScore(tournament.sportId, tournament.config.bestOf, random),
      })
      played++
    }
  }
}

/* ── Tournament builders ──────────────────────────────────────────────────── */

interface SeedSpec {
  name: string
  description: string
  sportId: string
  formatType: FormatType
  organizer: string
  venue: string
  location: string
  startOffset: number
  endOffset: number
  entrants: string[]
  /** How much of the tournament has been played, 0–1. */
  playedFraction: number
  config?: Partial<Tournament['config']>
  venues: { name: string; capacity: number }[]
  officials: { name: string; role: string }[]
  /** Squad size to generate per team; 0 for individual sports. */
  squadSize: number
  publicVisible: boolean
}

const SPECS: SeedSpec[] = [
  {
    name: 'Budhanilkantha Cup 2026',
    description:
      'The annual 16-team open knockout for clubs across the Kathmandu valley. Straight elimination, one match decides everything.',
    sportId: 'football',
    formatType: 'single_elimination',
    organizer: 'Budhanilkantha Youth Council',
    venue: 'Budhanilkantha Ground',
    location: 'Kathmandu, Nepal',
    startOffset: -6,
    endOffset: 8,
    entrants: FOOTBALL_TEAMS,
    playedFraction: 0.62,
    config: { thirdPlaceMatch: true, drawMethod: 'seeded', seedProtectionRounds: 2 },
    venues: [
      { name: 'Budhanilkantha Ground', capacity: 1 },
      { name: 'Kirtipur Stadium', capacity: 1 },
    ],
    officials: [
      { name: 'Prem Gurung', role: 'Referee' },
      { name: 'Sabin Rai', role: 'Referee' },
      { name: 'Milan Thapa', role: 'Assistant Referee' },
      { name: 'Dinesh Shah', role: 'Fourth Official' },
    ],
    squadSize: 14,
    publicVisible: true,
  },
  {
    name: 'Everest Premier T20 Series',
    description:
      'Eight franchises split into two groups. The top two from each group progress to the semi-finals, then the final at Kirtipur.',
    sportId: 'cricket',
    formatType: 'group_knockout',
    organizer: 'Nepal Cricket Board',
    venue: 'Tribhuvan University Ground',
    location: 'Kirtipur, Nepal',
    startOffset: -10,
    endOffset: 5,
    entrants: CRICKET_TEAMS,
    playedFraction: 0.75,
    config: {
      groupCount: 2,
      advancePerGroup: 2,
      thirdPlaceMatch: false,
      drawMethod: 'seeded',
      groupDoubleRoundRobin: false,
    },
    venues: [
      { name: 'Tribhuvan University Ground', capacity: 1 },
      { name: 'Mulpani Cricket Stadium', capacity: 1 },
    ],
    officials: [
      { name: 'Buddhi Pradhan', role: 'Umpire' },
      { name: 'Shambhu Karki', role: 'Umpire' },
      { name: 'Durga Subedi', role: 'Third Umpire' },
      { name: 'Rajesh Bhatta', role: 'Match Referee' },
    ],
    squadSize: 13,
    publicVisible: true,
  },
  {
    name: 'Kathmandu Basketball League',
    description:
      'Eight clubs, everyone plays everyone once. Ranked on win percentage with point difference as the tiebreaker.',
    sportId: 'basketball',
    formatType: 'round_robin',
    organizer: 'Kathmandu Basketball Association',
    venue: 'National Sports Council Covered Hall',
    location: 'Tripureshwor, Kathmandu',
    startOffset: -14,
    endOffset: 12,
    entrants: BASKETBALL_TEAMS,
    playedFraction: 0.68,
    config: { doubleRoundRobin: false },
    venues: [{ name: 'NSC Covered Hall', capacity: 2 }],
    officials: [
      { name: 'Anil Shrestha', role: 'Crew Chief' },
      { name: 'Roshan Maharjan', role: 'Referee' },
      { name: 'Kamal Nepali', role: 'Umpire' },
    ],
    squadSize: 10,
    publicVisible: true,
  },
  {
    name: 'National Badminton Open',
    description:
      'A 32-player singles draw. Best of three games throughout, with the top eight seeds protected in the first round.',
    sportId: 'badminton',
    formatType: 'single_elimination',
    organizer: 'Nepal Badminton Association',
    venue: 'Dasharath Rangasala Indoor Hall',
    location: 'Kathmandu, Nepal',
    startOffset: -3,
    endOffset: 4,
    entrants: BADMINTON_PLAYERS,
    playedFraction: 0.55,
    config: { thirdPlaceMatch: true, bestOf: 3, drawMethod: 'seeded', seedProtectionRounds: 2 },
    venues: [{ name: 'Indoor Hall — Courts 1–4', capacity: 4 }],
    officials: [
      { name: 'Sudip Rana', role: 'Umpire' },
      { name: 'Nirmala Shakya', role: 'Umpire' },
      { name: 'Bibek Tuladhar', role: 'Service Judge' },
    ],
    squadSize: 0,
    publicVisible: true,
  },
]

function buildTournament(spec: SeedSpec, random: () => number): void {
  const tournamentStore = useTournamentStore.getState()
  const teamStore = useTeamStore.getState()
  const venueStore = useVenueStore.getState()
  const sport = getSport(spec.sportId)

  const tournament = tournamentStore.createTournament({
    name: spec.name,
    description: spec.description,
    sportId: spec.sportId,
    organizer: spec.organizer,
    venue: spec.venue,
    location: spec.location,
    startDate: daysFromNow(spec.startOffset),
    endDate: daysFromNow(spec.endOffset),
    contactName: 'Tournament Desk',
    contactPhone: '+977 9800000000',
    contactEmail: 'info@example.com',
    formatType: spec.formatType,
    config: spec.config,
  })

  for (const venue of spec.venues) {
    venueStore.addVenue({ tournamentId: tournament.id, name: venue.name, capacity: venue.capacity })
  }
  for (const official of spec.officials) {
    venueStore.addOfficial({
      tournamentId: tournament.id,
      name: official.name,
      role: official.role,
    })
  }

  if (sport.participantType === 'team') {
    const teams = teamStore.addTeams(
      spec.entrants.map((name, i) => ({
        tournamentId: tournament.id,
        name,
        seed: i + 1,
        coach: playerName(random),
        manager: playerName(random),
      })),
    )

    // Squads, with a captain and jersey numbers. Positions cycle through the
    // sport's list so a squad looks balanced rather than all goalkeepers.
    for (const team of teams) {
      teamStore.addPlayers(
        Array.from({ length: spec.squadSize }, (_, i) => ({
          tournamentId: tournament.id,
          teamId: team.id,
          name: playerName(random),
          jerseyNumber: i + 1,
          position: sport.positions[i % sport.positions.length] ?? null,
          isCaptain: i === 0,
        })),
      )
    }
  } else {
    teamStore.addPlayers(
      spec.entrants.map((name, i) => ({
        tournamentId: tournament.id,
        teamId: null,
        name,
        seed: i + 1,
        position: sport.positions[0] ?? null,
      })),
    )
  }

  const result = generateTournamentFixtures({
    ...tournament,
    // Read back the config the store actually stored.
    config: useTournamentStore.getState().tournaments.find((t) => t.id === tournament.id)?.config ??
      tournament.config,
  })

  if (!result.ok) {
    console.warn(`Seed: could not generate fixtures for ${spec.name}`, result.validation.issues)
    return
  }

  autoScheduleTournament(
    useTournamentStore.getState().tournaments.find((t) => t.id === tournament.id) as Tournament,
    { startDate: daysFromNow(spec.startOffset) },
  )

  // Assign officials round-robin so the schedule view has something to show.
  const officials = useVenueStore.getState().officials.filter((o) => o.tournamentId === tournament.id)
  if (officials.length > 0) {
    const matches = useMatchStore.getState().matches.filter((m) => m.tournamentId === tournament.id)
    useMatchStore.getState().updateMatches(
      matches.map((match, i) => ({
        id: match.id,
        patch: { refereeId: officials[i % officials.length].id },
      })),
    )
  }

  playMatches(tournament.id, spec.playedFraction, random)

  if (spec.publicVisible) {
    useTournamentStore.getState().updateTournament(tournament.id, { publicVisible: true })
  }
}

/**
 * Load the demo tournaments.
 *
 * Safe to call more than once in principle, but the caller gates it on the
 * `seedLoaded` flag so a returning organizer's own data is never buried under
 * duplicates.
 */
export function loadSeedData(): number {
  const random = makeRandom(20260818)
  let created = 0

  for (const spec of SPECS) {
    try {
      buildTournament(spec, random)
      created++
    } catch (error) {
      console.error(`Seed: failed to build ${spec.name}`, error)
    }
  }

  // Leave the organizer on the tournament list rather than inside a demo.
  useTournamentStore.getState().setActive(null)
  return created
}

/** Names of the demo tournaments, for the confirm dialog. */
export const SEED_TOURNAMENT_NAMES = SPECS.map((s) => s.name)
