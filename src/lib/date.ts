/** Date and time helpers. All dates are stored as 'YYYY-MM-DD', times as 'HH:mm'. */

import { format, parse, isValid, addMinutes, differenceInMinutes } from 'date-fns'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Parse 'YYYY-MM-DD' into a local Date, or null if malformed. */
export function parseDate(date: string | null): Date | null {
  if (!date) return null
  const d = parse(date, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : null
}

/** Combine a stored date and time into a Date, or null if either is missing. */
export function toDateTime(date: string | null, time: string | null): Date | null {
  if (!date || !time) return null
  const d = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date())
  return isValid(d) ? d : null
}

/** 'Sat 12 Sep 2026' */
export function formatDateLong(date: string | null): string {
  const d = parseDate(date)
  return d ? format(d, 'EEE d MMM yyyy') : '—'
}

/** '12 Sep' */
export function formatDateShort(date: string | null): string {
  const d = parseDate(date)
  return d ? format(d, 'd MMM') : '—'
}

/** '4:00 PM' */
export function formatTime(time: string | null): string {
  if (!time) return '—'
  const d = parse(time, 'HH:mm', new Date())
  return isValid(d) ? format(d, 'h:mm a') : time
}

/** 'Sat 12 Sep · 4:00 PM' */
export function formatDateTime(date: string | null, time: string | null): string {
  if (!date && !time) return 'Not scheduled'
  if (!time) return formatDateLong(date)
  if (!date) return formatTime(time)
  return `${formatDateShort(date)} · ${formatTime(time)}`
}

/** Add minutes to an 'HH:mm' string, clamped within the same day. */
export function addMinutesToTime(time: string, minutes: number): string {
  const d = parse(time, 'HH:mm', new Date())
  if (!isValid(d)) return time
  return format(addMinutes(d, minutes), 'HH:mm')
}

/** Minutes between two 'HH:mm' strings; negative if b precedes a. */
export function minutesBetween(a: string, b: string): number {
  const da = parse(a, 'HH:mm', new Date())
  const db = parse(b, 'HH:mm', new Date())
  if (!isValid(da) || !isValid(db)) return 0
  return differenceInMinutes(db, da)
}

/** Do two [start, start+duration) windows on the same day overlap? */
export function windowsOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number,
): boolean {
  const offset = minutesBetween(startA, startB)
  return offset < durationA && -offset < durationB
}

/** 'Sep 2026' month label for the calendar header. */
export function formatMonth(date: Date): string {
  return format(date, 'MMMM yyyy')
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Relative wording an organizer would use: 'Today', 'Tomorrow', or the date. */
export function friendlyDay(date: string | null): string {
  const d = parseDate(date)
  if (!d) return 'Unscheduled'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return format(d, 'EEE d MMM')
}
