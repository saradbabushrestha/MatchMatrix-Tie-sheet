/**
 * Bulk import of teams and players from CSV or Excel.
 *
 * Imports are always parsed and validated into a preview first — nothing is
 * written until the organizer has seen exactly what will be created, because a
 * bad import into a live tournament is painful to unpick.
 */

import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file'
import type { SportConfig } from '@/types'
import { downloadBlob, guessShortName } from '@/lib/utils'

export interface ImportRow {
  /** 1-based row number in the source file, for error messages. */
  line: number
  teamName: string
  playerName: string
  jerseyNumber: number | null
  position: string | null
  isCaptain: boolean
  phone: string | null
  email: string | null
  seed: number | null
}

export interface ImportIssue {
  level: 'error' | 'warning'
  line: number | null
  message: string
}

export interface ImportPreview {
  rows: ImportRow[]
  issues: ImportIssue[]
  /** Teams that will be created, with their squad counts. */
  teams: { name: string; shortName: string; playerCount: number; seed: number | null }[]
  /** Individual competitors, when the sport is not team-based. */
  individuals: { name: string; seed: number | null }[]
  ok: boolean
}

/** Header aliases so organizers' own spreadsheets work without editing. */
const HEADER_MAP: Record<string, keyof ImportRow> = {
  team: 'teamName',
  team_name: 'teamName',
  'team name': 'teamName',
  teamname: 'teamName',
  club: 'teamName',
  school: 'teamName',

  player: 'playerName',
  player_name: 'playerName',
  'player name': 'playerName',
  playername: 'playerName',
  name: 'playerName',
  'full name': 'playerName',

  jersey: 'jerseyNumber',
  jersey_number: 'jerseyNumber',
  'jersey number': 'jerseyNumber',
  number: 'jerseyNumber',
  no: 'jerseyNumber',
  shirt: 'jerseyNumber',

  position: 'position',
  pos: 'position',
  role: 'position',

  captain: 'isCaptain',
  is_captain: 'isCaptain',
  'is captain': 'isCaptain',

  phone: 'phone',
  mobile: 'phone',
  contact: 'phone',

  email: 'email',
  'e-mail': 'email',

  seed: 'seed',
  rank: 'seed',
  ranking: 'seed',
}

function normalizeHeader(header: string): keyof ImportRow | null {
  const key = header.trim().toLowerCase().replace(/﻿/g, '')
  return HEADER_MAP[key] ?? null
}

function truthy(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase()
  return text === 'yes' || text === 'y' || text === 'true' || text === '1' || text === 'captain'
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

/** Turn a raw table (header row + data rows) into a validated preview. */
export function buildPreview(
  table: unknown[][],
  sport: SportConfig,
  existingTeamNames: string[] = [],
): ImportPreview {
  const issues: ImportIssue[] = []

  if (table.length === 0) {
    return {
      rows: [],
      issues: [{ level: 'error', line: null, message: 'That file is empty.' }],
      teams: [],
      individuals: [],
      ok: false,
    }
  }

  const headerRow = table[0].map((h) => String(h ?? ''))
  const mapping = headerRow.map(normalizeHeader)

  const recognised = mapping.filter(Boolean) as (keyof ImportRow)[]
  if (recognised.length === 0) {
    return {
      rows: [],
      issues: [
        {
          level: 'error',
          line: 1,
          message: `No recognisable column headers. Expected at least ${
            sport.participantType === 'team' ? '"team_name" and "player_name"' : '"player_name"'
          }. Download the sample template to see the format.`,
        },
      ],
      teams: [],
      individuals: [],
      ok: false,
    }
  }

  const isTeamSport = sport.participantType === 'team'

  if (isTeamSport && !recognised.includes('teamName')) {
    issues.push({
      level: 'error',
      line: 1,
      message: `${sport.name} is a team sport, so the file needs a "team_name" column.`,
    })
  }
  if (!recognised.includes('playerName') && !recognised.includes('teamName')) {
    issues.push({
      level: 'error',
      line: 1,
      message: 'The file needs a "player_name" column.',
    })
  }

  const unknownHeaders = headerRow.filter((h, i) => h.trim() && mapping[i] === null)
  if (unknownHeaders.length > 0) {
    issues.push({
      level: 'warning',
      line: 1,
      message: `Ignored unrecognised column${unknownHeaders.length > 1 ? 's' : ''}: ${unknownHeaders.join(', ')}.`,
    })
  }

  const rows: ImportRow[] = []

  for (let r = 1; r < table.length; r++) {
    const raw = table[r]
    // Skip fully blank rows — trailing empty lines are extremely common.
    if (!raw || raw.every((cell) => String(cell ?? '').trim() === '')) continue

    const row: ImportRow = {
      line: r + 1,
      teamName: '',
      playerName: '',
      jerseyNumber: null,
      position: null,
      isCaptain: false,
      phone: null,
      email: null,
      seed: null,
    }

    mapping.forEach((field, c) => {
      if (!field) return
      const value = raw[c]
      switch (field) {
        case 'teamName':
          row.teamName = String(value ?? '').trim()
          break
        case 'playerName':
          row.playerName = String(value ?? '').trim()
          break
        case 'jerseyNumber':
          row.jerseyNumber = toNumberOrNull(value)
          break
        case 'position':
          row.position = String(value ?? '').trim() || null
          break
        case 'isCaptain':
          row.isCaptain = truthy(value)
          break
        case 'phone':
          row.phone = String(value ?? '').trim() || null
          break
        case 'email':
          row.email = String(value ?? '').trim() || null
          break
        case 'seed':
          row.seed = toNumberOrNull(value)
          break
        default:
          break
      }
    })

    if (isTeamSport && !row.teamName) {
      issues.push({ level: 'error', line: row.line, message: 'Missing team name.' })
      continue
    }
    if (!isTeamSport && !row.playerName) {
      issues.push({ level: 'error', line: row.line, message: 'Missing player name.' })
      continue
    }

    if (row.position && sport.positions.length > 0) {
      const known = sport.positions.some(
        (p) => p.toLowerCase() === (row.position as string).toLowerCase(),
      )
      if (!known) {
        issues.push({
          level: 'warning',
          line: row.line,
          message: `"${row.position}" is not a standard ${sport.name} position — it will be kept as typed.`,
        })
      }
    }

    if (row.email && !row.email.includes('@')) {
      issues.push({
        level: 'warning',
        line: row.line,
        message: `"${row.email}" does not look like an email address.`,
      })
      row.email = null
    }

    rows.push(row)
  }

  if (rows.length === 0 && !issues.some((i) => i.level === 'error')) {
    issues.push({ level: 'error', line: null, message: 'No data rows found below the header.' })
  }

  /* Aggregate into the entities that will actually be created. */

  const teamMap = new Map<string, { name: string; playerCount: number; seed: number | null }>()
  const individuals: { name: string; seed: number | null }[] = []

  if (isTeamSport) {
    for (const row of rows) {
      const key = row.teamName.toLowerCase()
      const existing = teamMap.get(key)
      if (existing) {
        if (row.playerName) existing.playerCount++
        if (existing.seed == null && row.seed != null) existing.seed = row.seed
      } else {
        teamMap.set(key, {
          name: row.teamName,
          playerCount: row.playerName ? 1 : 0,
          seed: row.seed,
        })
      }
    }

    // Clashes with teams already in the tournament.
    const existingLower = new Set(existingTeamNames.map((n) => n.toLowerCase()))
    for (const [key, team] of teamMap) {
      if (existingLower.has(key)) {
        issues.push({
          level: 'warning',
          line: null,
          message: `"${team.name}" already exists in this tournament — the imported players will be added to it.`,
        })
      }
    }

    // Duplicate jersey numbers within an imported squad.
    const perTeam = new Map<string, Map<number, string[]>>()
    for (const row of rows) {
      if (row.jerseyNumber == null || !row.playerName) continue
      const key = row.teamName.toLowerCase()
      const numbers = perTeam.get(key) ?? new Map<number, string[]>()
      const names = numbers.get(row.jerseyNumber) ?? []
      names.push(row.playerName)
      numbers.set(row.jerseyNumber, names)
      perTeam.set(key, numbers)
    }
    for (const [teamKey, numbers] of perTeam) {
      for (const [number, names] of numbers) {
        if (names.length > 1) {
          const teamName = teamMap.get(teamKey)?.name ?? teamKey
          issues.push({
            level: 'warning',
            line: null,
            message: `${teamName}: jersey #${number} is used by ${names.join(' and ')}.`,
          })
        }
      }
    }
  } else {
    const seen = new Map<string, number>()
    for (const row of rows) {
      const key = row.playerName.toLowerCase()
      seen.set(key, (seen.get(key) ?? 0) + 1)
      individuals.push({ name: row.playerName, seed: row.seed })
    }
    for (const [name, count] of seen) {
      if (count > 1) {
        issues.push({
          level: 'warning',
          line: null,
          message: `"${name}" appears ${count} times — duplicates will be imported as separate entries.`,
        })
      }
    }
  }

  const teams = Array.from(teamMap.values()).map((t) => ({
    ...t,
    shortName: guessShortName(t.name),
  }))

  return {
    rows,
    issues,
    teams,
    individuals,
    ok: !issues.some((i) => i.level === 'error') && rows.length > 0,
  }
}

/** Parse a CSV file into a preview. */
export function parseCSV(
  file: File,
  sport: SportConfig,
  existingTeamNames: string[] = [],
): Promise<ImportPreview> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (result) => {
        if (result.errors.length > 0) {
          // Papa reports per-row problems; surface them but still try to import.
          const parseIssues: ImportIssue[] = result.errors.slice(0, 5).map((e) => ({
            level: 'warning' as const,
            line: typeof e.row === 'number' ? e.row + 1 : null,
            message: e.message,
          }))
          const preview = buildPreview(result.data, sport, existingTeamNames)
          resolve({ ...preview, issues: [...parseIssues, ...preview.issues] })
          return
        }
        resolve(buildPreview(result.data, sport, existingTeamNames))
      },
      error: (error) => {
        resolve({
          rows: [],
          issues: [{ level: 'error', line: null, message: `Could not read the file: ${error.message}` }],
          teams: [],
          individuals: [],
          ok: false,
        })
      },
    })
  })
}

/** Parse an .xlsx file into a preview. */
export async function parseExcel(
  file: File,
  sport: SportConfig,
  existingTeamNames: string[] = [],
): Promise<ImportPreview> {
  try {
    const rows = await readXlsxFile(file)
    return buildPreview(rows as unknown[][], sport, existingTeamNames)
  } catch (error) {
    return {
      rows: [],
      issues: [
        {
          level: 'error',
          line: null,
          message: `Could not read that spreadsheet: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        },
      ],
      teams: [],
      individuals: [],
      ok: false,
    }
  }
}

/** Dispatch on file extension. */
export function parseImportFile(
  file: File,
  sport: SportConfig,
  existingTeamNames: string[] = [],
): Promise<ImportPreview> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file, sport, existingTeamNames)
  }
  return parseCSV(file, sport, existingTeamNames)
}

/** A ready-to-fill CSV template matching the sport's shape. */
export function downloadTemplate(sport: SportConfig): void {
  const isTeam = sport.participantType === 'team'
  const positions = sport.positions.length > 0 ? sport.positions : ['Player']

  const header = isTeam
    ? ['team_name', 'player_name', 'jersey_number', 'position', 'captain', 'phone', 'email']
    : ['player_name', 'seed', 'position', 'phone', 'email']

  const sample = isTeam
    ? [
        ['Budhanilkantha FC', 'Ram Shrestha', '1', positions[0], 'yes', '9800000001', 'ram@example.com'],
        ['Budhanilkantha FC', 'Hari Thapa', '2', positions[1] ?? positions[0], '', '', ''],
        ['Budhanilkantha FC', 'Bikash Rai', '3', positions[2] ?? positions[0], '', '', ''],
        ['Kirtipur United', 'Suman Gurung', '1', positions[0], 'yes', '9800000002', ''],
        ['Kirtipur United', 'Nabin Karki', '7', positions[positions.length - 1], '', '', ''],
      ]
    : [
        ['Sarad Shrestha', '1', positions[0], '9800000001', 'sarad@example.com'],
        ['Anita Rai', '2', positions[0], '', ''],
        ['Bimal Karki', '3', positions[0], '', ''],
        ['Puja Sharma', '', positions[0], '', ''],
      ]

  const csv = Papa.unparse({ fields: header, data: sample })
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `${sport.id}-import-template.csv`)
}
