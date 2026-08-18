/**
 * Seed-data verification.
 *
 * The demo tournaments are built by driving the real stores and the real engine,
 * which is what keeps them honest — but it also means a mistake in the seed spec
 * surfaces as a broken first-run experience. This script builds all four demo
 * tournaments in Node and asserts they came out coherent.
 *
 * Run with `npm run verify:seed`.
 */

/* The stores persist through zustand's `persist` middleware, which expects a
 * Web Storage API. Provide a minimal in-memory one before anything imports a
 * store, so persistence behaves exactly as it does in the browser. */
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true })

const { loadSeedData, SEED_TOURNAMENT_NAMES } = await import('@/data/seed')
const { useTournamentStore } = await import('@/stores/useTournamentStore')
const { useTeamStore } = await import('@/stores/useTeamStore')
const { useMatchStore } = await import('@/stores/useMatchStore')
const { useVenueStore } = await import('@/stores/useVenueStore')
const { getSport } = await import('@/stores/useSportStore')
const { computeStandings, computeGroupStandings, computePodium, isDecided } = await import('@/engine')
const { getFormat } = await import('@/config/formats')

let passed = 0
const failures: string[] = []

function check(label: string, condition: boolean, detail?: string) {
  if (condition) passed++
  else failures.push(detail ? `${label} — ${detail}` : label)
}

function eq(label: string, actual: unknown, expected: unknown) {
  check(label, actual === expected, `expected ${String(expected)}, got ${String(actual)}`)
}

process.stdout.write('\n\x1b[1mBuilding demo tournaments\x1b[0m\n')

const created = loadSeedData()
eq('all specs built', created, SEED_TOURNAMENT_NAMES.length)

const tournaments = useTournamentStore.getState().tournaments
eq('tournament count', tournaments.length, SEED_TOURNAMENT_NAMES.length)

for (const name of SEED_TOURNAMENT_NAMES) {
  check(`"${name}" exists`, tournaments.some((t) => t.name === name))
}

// Slugs must be unique, or public links collide.
const slugs = tournaments.map((t) => t.slug)
eq('slugs are unique', new Set(slugs).size, slugs.length)

const { teams, players } = useTeamStore.getState()
const { matches, rounds, groups } = useMatchStore.getState()
const { venues, officials } = useVenueStore.getState()

for (const tournament of tournaments) {
  const label = tournament.name
  const sport = getSport(tournament.sportId)
  const format = getFormat(tournament.formatType)

  const own = matches.filter((m) => m.tournamentId === tournament.id)
  const ownRounds = rounds.filter((r) => r.tournamentId === tournament.id)
  const ownGroups = groups.filter((g) => g.tournamentId === tournament.id)
  const ownTeams = teams.filter((t) => t.tournamentId === tournament.id)
  const ownPlayers = players.filter((p) => p.tournamentId === tournament.id)
  const ownVenues = venues.filter((v) => v.tournamentId === tournament.id)
  const ownOfficials = officials.filter((o) => o.tournamentId === tournament.id)

  process.stdout.write(`\n  \x1b[2m${label} (${sport.name}, ${format.name})\x1b[0m\n`)

  check(`${label}: fixtures generated`, own.length > 0)
  check(`${label}: rounds generated`, ownRounds.length > 0)
  check(`${label}: has venues`, ownVenues.length > 0)
  check(`${label}: has officials`, ownOfficials.length > 0)
  eq(`${label}: fixturesGenerated flag`, tournament.fixturesGenerated, true)
  eq(`${label}: published`, tournament.publicVisible, true)

  const participants =
    sport.participantType === 'team' ? ownTeams : ownPlayers.filter((p) => p.teamId === null)
  check(`${label}: has entrants`, participants.length >= format.minParticipants)

  if (sport.participantType === 'team') {
    check(`${label}: squads populated`, ownPlayers.length > 0)
    // Every team should have a captain and no duplicate shirt numbers.
    for (const team of ownTeams) {
      const squad = ownPlayers.filter((p) => p.teamId === team.id)
      check(`${label}/${team.name}: has a squad`, squad.length > 0)
      eq(`${label}/${team.name}: exactly one captain`, squad.filter((p) => p.isCaptain).length, 1)
      const numbers = squad.map((p) => p.jerseyNumber).filter((n) => n != null)
      eq(`${label}/${team.name}: unique shirt numbers`, new Set(numbers).size, numbers.length)
    }
  }

  // Match numbers must be unique and contiguous.
  const numbers = own.map((m) => m.number).sort((a, b) => a - b)
  check(
    `${label}: match numbers are 1..n`,
    numbers.every((n, i) => n === i + 1),
    `got ${numbers[0]}..${numbers[numbers.length - 1]} over ${numbers.length} matches`,
  )

  // Every match belongs to a real round.
  const roundIds = new Set(ownRounds.map((r) => r.id))
  eq(`${label}: no orphan matches`, own.filter((m) => !roundIds.has(m.roundId)).length, 0)

  // Some matches must be played, and some still to come — a part-played demo.
  const playable = own.filter((m) => !m.isBye && m.status !== 'cancelled')
  const done = playable.filter((m) => m.status === 'completed' || m.status === 'walkover')
  check(`${label}: some matches played`, done.length > 0, `${done.length} of ${playable.length}`)

  // Every completed match must have a coherent result.
  const incoherent = done.filter((m) => {
    if (m.status === 'walkover') return m.walkoverWinner == null
    if (!m.score) return true
    if (!sport.allowsDraw && m.outcome === null) return true
    return false
  })
  eq(`${label}: all results coherent`, incoherent.length, 0)

  // Scheduling: every playable match should have a date and a venue.
  const unscheduled = playable.filter((m) => !m.date || !m.time)
  eq(`${label}: everything scheduled`, unscheduled.length, 0)
  const noVenue = playable.filter((m) => !m.venueId)
  eq(`${label}: every match has a venue`, noVenue.length, 0)
  const noOfficial = playable.filter((m) => !m.refereeId)
  eq(`${label}: every match has an official`, noOfficial.length, 0)

  // Set-based sports must never record a level match.
  if (sport.scoringType === 'sets') {
    const level = done.filter(
      (m) => m.score && m.score.home.score === m.score.away.score,
    )
    eq(`${label}: no level set-sport results`, level.length, 0)
  }

  // Advancement: any decided match that feeds another must have placed its winner.
  const byId = new Map(own.map((m) => [m.id, m]))
  const notAdvanced = own.filter((m) => {
    if (!m.winnerTo || !isDecided(m)) return false
    const target = byId.get(m.winnerTo.matchId)
    if (!target) return false
    const slot = m.winnerTo.slot === 'home' ? target.homeId : target.awayId
    return slot == null
  })
  eq(`${label}: winners advanced`, notAdvanced.length, 0)

  // Nobody may appear twice in the same match.
  const selfPlay = own.filter((m) => m.homeId && m.awayId && m.homeId === m.awayId)
  eq(`${label}: nobody plays themselves`, selfPlay.length, 0)

  // Standings must be computable and internally consistent.
  const projected = participants.map((p) => ({
    id: p.id,
    name: p.name,
    shortName: 'shortName' in p ? (p.shortName as string) : p.name,
    logoUrl: null,
    color: '#000',
    seed: p.seed,
    groupId: 'groupId' in p ? ((p.groupId as string | null) ?? null) : null,
    kind: sport.participantType === 'team' ? ('team' as const) : ('player' as const),
  }))

  if (ownGroups.length > 0) {
    const tables = computeGroupStandings(projected, own, ownGroups, sport, tournament.config)
    eq(`${label}: one table per group`, tables.length, ownGroups.length)
    for (const table of tables) {
      check(`${label}/${table.groupName}: has rows`, table.rows.length > 0)
      check(
        `${label}/${table.groupName}: positions contiguous`,
        table.rows.every((r, i) => r.position === i + 1),
      )
    }
  } else if (format.hasStandings) {
    const table = computeStandings(projected, own, sport, tournament.config)
    eq(`${label}: table covers every entrant`, table.rows.length, participants.length)
    const totalFor = table.rows.reduce((s, r) => s + r.scoreFor, 0)
    const totalAgainst = table.rows.reduce((s, r) => s + r.scoreAgainst, 0)
    eq(`${label}: scored equals conceded`, totalFor, totalAgainst)
    const appearances = table.rows.reduce((s, r) => s + r.played, 0)
    const counted = own.filter(
      (m) =>
        (m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result') &&
        m.homeId &&
        m.awayId,
    ).length
    eq(`${label}: appearances equal 2 × counted matches`, appearances, counted * 2)
  }

  // A part-played bracket must not already have a champion.
  if (format.hasBracket) {
    const podium = computePodium(own, ownRounds)
    const allPlayed = playable.every(
      (m) => m.status === 'completed' || m.status === 'walkover' || m.status === 'no_result',
    )
    if (!allPlayed) {
      check(
        `${label}: no premature champion`,
        podium.champion === null,
        `champion set while ${playable.length - done.length} matches remain`,
      )
    }
  }

  // Status should reflect progress.
  check(
    `${label}: status is sensible`,
    tournament.status === 'active' || tournament.status === 'completed',
    tournament.status,
  )
}

// The persisted payload must be small enough for localStorage to hold.
let bytes = 0
for (let i = 0; i < storage.length; i++) {
  const key = storage.key(i) as string
  bytes += key.length + (storage.getItem(key)?.length ?? 0)
}
const kb = Math.round(bytes / 1024)
process.stdout.write(`\n  \x1b[2mpersisted payload: ${kb} KB across ${storage.length} keys\x1b[0m\n`)
check('persisted payload fits comfortably in localStorage', bytes < 4 * 1024 * 1024, `${kb} KB`)

process.stdout.write('\n' + '─'.repeat(64) + '\n')
if (failures.length === 0) {
  process.stdout.write(`\x1b[32m✓ all ${passed} seed checks passed\x1b[0m\n`)
  process.exit(0)
} else {
  process.stdout.write(`\x1b[31m✗ ${failures.length} failed\x1b[0m (${passed} passed)\n\n`)
  for (const failure of failures.slice(0, 40)) process.stdout.write(`  • ${failure}\n`)
  if (failures.length > 40) process.stdout.write(`  …and ${failures.length - 40} more\n`)
  process.stdout.write('\n')
  process.exit(1)
}
