/**
 * Scheduling: conflict detection and auto-scheduling.
 *
 * Match duration comes from the sport config, so a badminton court turns over
 * every 45 minutes while a cricket ground gets 3.5 hours, with no sport-specific
 * code here.
 */

import type {
  Match,
  Official,
  Participant,
  ScheduleConflict,
  SportConfig,
  TournamentSettings,
  Venue,
} from '@/types'
import { addMinutesToTime, toDateTime, windowsOverlap, toISODate, parseDate } from '@/lib/date'
import { uid } from '@/lib/utils'

export const DEFAULT_SETTINGS: Omit<TournamentSettings, 'tournamentId'> = {
  matchGapMinutes: 15,
  minRestMinutes: 60,
  dayStartTime: '09:00',
  dayEndTime: '18:00',
  matchesPerDay: 6,
}

/**
 * Find every scheduling clash.
 *
 * Three kinds matter in practice: two matches on the same pitch at once, an
 * entrant double-booked (or given no rest), and an official double-booked.
 */
export function detectConflicts(
  matches: readonly Match[],
  participants: readonly Participant[],
  venues: readonly Venue[],
  officials: readonly Official[],
  sport: SportConfig,
  settings: Pick<TournamentSettings, 'minRestMinutes'>,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const duration = sport.matchDurationMinutes
  const scheduled = matches.filter((m) => m.date && m.time && m.status !== 'cancelled')
  const nameOf = (id: string | null) => participants.find((p) => p.id === id)?.name ?? 'TBD'

  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i]
      const b = scheduled[j]
      if (a.date !== b.date) continue

      const overlap = windowsOverlap(a.time as string, duration, b.time as string, duration)

      // Same venue, overlapping windows — unless the venue has parallel courts.
      if (overlap && a.venueId && a.venueId === b.venueId) {
        const venue = venues.find((v) => v.id === a.venueId)
        const capacity = venue?.capacity ?? 1
        const clashing = scheduled.filter(
          (m) =>
            m.venueId === a.venueId &&
            m.date === a.date &&
            windowsOverlap(a.time as string, duration, m.time as string, duration),
        )
        if (clashing.length > capacity) {
          conflicts.push({
            id: uid(),
            kind: 'venue',
            severity: 'error',
            message: `${venue?.name ?? 'This venue'} has ${clashing.length} matches at once but only fits ${capacity}.`,
            matchIds: clashing.map((m) => m.id),
          })
        }
      }

      // Same entrant in both matches.
      const sharedIds = [a.homeId, a.awayId].filter(
        (id) => id && (id === b.homeId || id === b.awayId),
      ) as string[]

      if (sharedIds.length > 0) {
        if (overlap) {
          conflicts.push({
            id: uid(),
            kind: 'participant',
            severity: 'error',
            message: `${nameOf(sharedIds[0])} is scheduled for match #${a.number} and #${b.number} at the same time.`,
            matchIds: [a.id, b.id],
          })
        } else {
          const ta = toDateTime(a.date, a.time)
          const tb = toDateTime(b.date, b.time)
          if (ta && tb) {
            const gap = Math.abs(tb.getTime() - ta.getTime()) / 60000 - duration
            if (gap < settings.minRestMinutes) {
              conflicts.push({
                id: uid(),
                kind: 'participant',
                severity: 'warning',
                message: `${nameOf(sharedIds[0])} gets only ${Math.max(0, Math.round(gap))} min between match #${a.number} and #${b.number}.`,
                matchIds: [a.id, b.id],
              })
            }
          }
        }
      }

      // Same official in both matches.
      if (overlap && a.refereeId && a.refereeId === b.refereeId) {
        const official = officials.find((o) => o.id === a.refereeId)
        conflicts.push({
          id: uid(),
          kind: 'official',
          severity: 'error',
          message: `${official?.name ?? 'This official'} is assigned to match #${a.number} and #${b.number} at the same time.`,
          matchIds: [a.id, b.id],
        })
      }
    }
  }

  // Matches that are ready to play but have no slot yet.
  const unscheduled = matches.filter(
    (m) => !m.date && !m.isBye && m.status === 'pending' && m.homeId && m.awayId,
  )
  if (unscheduled.length > 0) {
    conflicts.push({
      id: uid(),
      kind: 'missing',
      severity: 'warning',
      message: `${unscheduled.length} ready ${unscheduled.length === 1 ? 'match has' : 'matches have'} no date or time yet.`,
      matchIds: unscheduled.map((m) => m.id),
    })
  }

  return dedupeConflicts(conflicts)
}

function dedupeConflicts(conflicts: ScheduleConflict[]): ScheduleConflict[] {
  const seen = new Set<string>()
  return conflicts.filter((c) => {
    const key = `${c.kind}|${c.message}|${c.matchIds.slice().sort().join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface AutoScheduleOptions {
  startDate: string
  venues: readonly Venue[]
  settings: Pick<TournamentSettings, 'matchGapMinutes' | 'dayStartTime' | 'dayEndTime' | 'matchesPerDay'>
  sport: SportConfig
  /** Only schedule matches that currently have no date. */
  skipScheduled: boolean
}

/**
 * Lay matches out across days, times and venues in round order.
 *
 * Matches within a round are spread across the available venues before the
 * clock advances, which keeps a round finishing together — a knockout round has
 * to complete before the next one can be played.
 */
export function autoSchedule(
  matches: readonly Match[],
  options: AutoScheduleOptions,
): Match[] {
  const { startDate, venues, settings, sport, skipScheduled } = options
  const venueList = venues.length > 0 ? venues : [null]

  const target = matches.filter(
    (m) => !m.isBye && m.status !== 'cancelled' && (!skipScheduled || !m.date),
  )
  const targetIds = new Set(target.map((m) => m.id))

  const ordered = target.slice().sort((a, b) => a.number - b.number)

  let dayOffset = 0
  let time = settings.dayStartTime
  let venueIndex = 0
  let scheduledToday = 0

  const start = parseDate(startDate) ?? new Date()
  const assignments = new Map<string, { date: string; time: string; venueId: string | null }>()

  const dateFor = (offset: number) => {
    const d = new Date(start)
    d.setDate(d.getDate() + offset)
    return toISODate(d)
  }

  const slotEndsTooLate = (candidate: string) => {
    const end = addMinutesToTime(candidate, sport.matchDurationMinutes)
    return end > settings.dayEndTime && candidate > settings.dayStartTime
  }

  for (const match of ordered) {
    // Move to the next day when the day is full or the match would run late.
    if (scheduledToday >= settings.matchesPerDay || slotEndsTooLate(time)) {
      dayOffset++
      time = settings.dayStartTime
      venueIndex = 0
      scheduledToday = 0
    }

    const venue = venueList[venueIndex]
    assignments.set(match.id, {
      date: dateFor(dayOffset),
      time,
      venueId: venue ? venue.id : null,
    })

    scheduledToday++
    venueIndex++

    // Advance the clock only once every venue has a match in this slot.
    if (venueIndex >= venueList.length) {
      venueIndex = 0
      time = addMinutesToTime(time, sport.matchDurationMinutes + settings.matchGapMinutes)
    }
  }

  return matches.map((m) => {
    if (!targetIds.has(m.id)) return m
    const slot = assignments.get(m.id)
    if (!slot) return m
    return {
      ...m,
      date: slot.date,
      time: slot.time,
      venueId: slot.venueId ?? m.venueId,
      status: m.status === 'pending' ? 'scheduled' : m.status,
    }
  })
}

/** Group matches by date for the schedule and calendar views. */
export function matchesByDate(matches: readonly Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>()
  for (const m of matches) {
    const key = m.date ?? 'unscheduled'
    const bucket = map.get(key)
    if (bucket) bucket.push(m)
    else map.set(key, [m])
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.number - b.number)
  }
  return new Map(
    Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'unscheduled') return 1
      if (b === 'unscheduled') return -1
      return a.localeCompare(b)
    }),
  )
}
