/** Teams, players and their relationships. */

/** A player — a squad member of a team, or a standalone individual competitor. */
export interface Player {
  id: string
  tournamentId: string
  /** Null for individual-sport competitors, who have no parent team. */
  teamId: string | null
  name: string
  jerseyNumber: number | null
  position: string | null
  /** Data URL or remote URL. */
  photoUrl: string | null
  isCaptain: boolean
  phone: string | null
  email: string | null
  /** For individual sports: the competitor's seed in the draw. */
  seed: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** A team competing in a tournament. */
export interface Team {
  id: string
  tournamentId: string
  name: string
  shortName: string
  /** Data URL or remote URL. */
  logoUrl: string | null
  /** Hex colour used for the team chip when no logo is set. */
  color: string
  coach: string | null
  manager: string | null
  contactPhone: string | null
  contactEmail: string | null
  /** Seed in the draw; null means unseeded. */
  seed: number | null
  /** Group assignment for group-stage formats. */
  groupId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * The engine never cares whether it is moving teams or individuals around a
 * bracket — it works with `Participant`, the common shape of both.
 */
export interface Participant {
  id: string
  name: string
  shortName: string
  logoUrl: string | null
  color: string
  seed: number | null
  groupId: string | null
  /** Which entity this participant was projected from. */
  kind: 'team' | 'player'
}

/** A group / pool in a group-stage tournament. */
export interface Group {
  id: string
  tournamentId: string
  name: string
  /** Display order — Group A is 0. */
  position: number
  createdAt: string
}

/** A venue matches can be played at. */
export interface Venue {
  id: string
  tournamentId: string
  name: string
  address: string | null
  /** How many matches can run here simultaneously (courts/pitches). */
  capacity: number
  createdAt: string
}

/** A referee, umpire or other match official. */
export interface Official {
  id: string
  tournamentId: string
  name: string
  role: string
  phone: string | null
  createdAt: string
}
