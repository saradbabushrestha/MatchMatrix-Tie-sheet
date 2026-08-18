/**
 * Export: PDF, Excel, CSV and PNG.
 *
 * All client-side. Tables are built from the same engine output the screen
 * uses, so an exported standings table can never disagree with the one on
 * screen.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import writeXlsxFile from 'write-excel-file'
import { toPng } from 'html-to-image'
import type {
  Match,
  Participant,
  Player,
  Round,
  SportConfig,
  StandingsTable,
  Team,
  Tournament,
  Venue,
} from '@/types'
import { statLabel } from '@/config/sports'
import { getFormat } from '@/config/formats'
import { formatScoreline, formatSetBreakdown } from '@/engine/scoring'
import { formatStat } from '@/engine/standings'
import { downloadBlob, slugify } from '@/lib/utils'
import { formatDateLong, formatTime } from '@/lib/date'

export type PaperSize = 'a4' | 'a3'
export type Orientation = 'portrait' | 'landscape'

export interface ExportContext {
  tournament: Tournament
  sport: SportConfig
  participants: Participant[]
  participantMap: Map<string, Participant>
  teams: Team[]
  players: Player[]
  rounds: Round[]
  matches: Match[]
  venues: Venue[]
  standings: StandingsTable[]
}

/** What the export dialog can produce. */
export type ExportTarget =
  | 'tiesheet'
  | 'fixtures'
  | 'results'
  | 'standings'
  | 'teams'
  | 'players'
  | 'schedule'

const TARGET_LABELS: Record<ExportTarget, string> = {
  tiesheet: 'Tie sheet',
  fixtures: 'Fixtures',
  results: 'Results',
  standings: 'Standings',
  teams: 'Team list',
  players: 'Player list',
  schedule: 'Match schedule',
}

/* ── Shared row builders ─────────────────────────────────────────────────── */

function participantName(ctx: ExportContext, id: string | null): string {
  if (!id) return 'TBD'
  return ctx.participantMap.get(id)?.name ?? 'Unknown'
}

function roundName(ctx: ExportContext, roundId: string): string {
  return ctx.rounds.find((r) => r.id === roundId)?.name ?? ''
}

function venueName(ctx: ExportContext, venueId: string | null): string {
  if (!venueId) return ''
  return ctx.venues.find((v) => v.id === venueId)?.name ?? ''
}

function statusLabel(match: Match): string {
  const labels: Record<Match['status'], string> = {
    pending: 'Not scheduled',
    scheduled: 'Scheduled',
    live: 'Live',
    completed: 'Completed',
    cancelled: 'Cancelled',
    walkover: 'Walkover',
    no_result: 'No result',
  }
  return labels[match.status]
}

function fixtureRows(ctx: ExportContext, onlyPlayed: boolean) {
  return ctx.matches
    .filter((m) => (onlyPlayed ? m.status === 'completed' || m.status === 'walkover' : true))
    .filter((m) => !m.isBye)
    .map((match) => ({
      '#': match.number,
      Round: roundName(ctx, match.roundId),
      Home: participantName(ctx, match.homeId),
      Away: participantName(ctx, match.awayId),
      Score: match.score ? formatScoreline(match.score, ctx.sport) : '',
      Detail: formatSetBreakdown(match.score, ctx.sport).join(' '),
      Date: match.date ? formatDateLong(match.date) : '',
      Time: match.time ? formatTime(match.time) : '',
      Venue: venueName(ctx, match.venueId),
      Status: statusLabel(match),
    }))
}

function teamRows(ctx: ExportContext) {
  return ctx.teams.map((team) => ({
    Team: team.name,
    Short: team.shortName,
    Seed: team.seed ?? '',
    Group: ctx.matches.find((m) => m.homeId === team.id || m.awayId === team.id)?.groupId
      ? (ctx.standings.find((s) => s.rows.some((r) => r.participant.id === team.id))?.groupName ?? '')
      : '',
    Squad: ctx.players.filter((p) => p.teamId === team.id).length,
    Captain: ctx.players.find((p) => p.teamId === team.id && p.isCaptain)?.name ?? '',
    Coach: team.coach ?? '',
    Manager: team.manager ?? '',
    Phone: team.contactPhone ?? '',
    Email: team.contactEmail ?? '',
  }))
}

function playerRows(ctx: ExportContext) {
  const teamName = new Map(ctx.teams.map((t) => [t.id, t.name]))
  return ctx.players
    .slice()
    .sort((a, b) => {
      const ta = a.teamId ? (teamName.get(a.teamId) ?? '') : ''
      const tb = b.teamId ? (teamName.get(b.teamId) ?? '') : ''
      return ta.localeCompare(tb) || (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)
    })
    .map((player) => ({
      Team: player.teamId ? (teamName.get(player.teamId) ?? '') : '—',
      No: player.jerseyNumber ?? '',
      Player: player.name,
      Position: player.position ?? '',
      Captain: player.isCaptain ? 'Yes' : '',
      Seed: player.seed ?? '',
      Phone: player.phone ?? '',
      Email: player.email ?? '',
    }))
}

function scheduleRows(ctx: ExportContext) {
  return ctx.matches
    .filter((m) => m.date && !m.isBye)
    .sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`))
    .map((match) => ({
      Date: formatDateLong(match.date),
      Time: match.time ? formatTime(match.time) : '',
      '#': match.number,
      Round: roundName(ctx, match.roundId),
      Match: `${participantName(ctx, match.homeId)} vs ${participantName(ctx, match.awayId)}`,
      Venue: venueName(ctx, match.venueId),
      Status: statusLabel(match),
    }))
}

function standingsRows(ctx: ExportContext, table: StandingsTable) {
  return table.rows.map((row) => {
    const base: Record<string, string | number> = {
      Pos: row.position,
      [ctx.sport.participantType === 'team' ? 'Team' : 'Player']: row.participant.name,
    }
    for (const key of table.columns) {
      base[statLabel(key, ctx.sport.id)] = formatStat(row[key] as number, key)
    }
    return base
  })
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

export function exportCSV(ctx: ExportContext, target: ExportTarget): void {
  let rows: Record<string, unknown>[] = []

  switch (target) {
    case 'fixtures':
    case 'tiesheet':
      rows = fixtureRows(ctx, false)
      break
    case 'results':
      rows = fixtureRows(ctx, true)
      break
    case 'teams':
      rows = teamRows(ctx)
      break
    case 'players':
      rows = playerRows(ctx)
      break
    case 'schedule':
      rows = scheduleRows(ctx)
      break
    case 'standings':
      // Flatten every group into one sheet, tagged by group.
      rows = ctx.standings.flatMap((table) =>
        standingsRows(ctx, table).map((row) => ({
          Group: table.groupName ?? 'League',
          ...row,
        })),
      )
      break
    default:
      break
  }

  if (rows.length === 0) {
    throw new Error(`There is nothing to export for ${TARGET_LABELS[target].toLowerCase()} yet.`)
  }

  const csv = Papa.unparse(rows)
  // A BOM keeps Excel happy with non-ASCII names.
  downloadBlob(
    new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }),
    `${slugify(ctx.tournament.name, false)}-${target}.csv`,
  )
}

/* ── Excel ───────────────────────────────────────────────────────────────── */

interface SheetSpec {
  name: string
  rows: Record<string, unknown>[]
}

/** Build one .xlsx with a sheet per selected target. */
export async function exportExcel(ctx: ExportContext, targets: ExportTarget[]): Promise<void> {
  const sheets: SheetSpec[] = []

  for (const target of targets) {
    switch (target) {
      case 'teams':
        if (ctx.teams.length > 0) sheets.push({ name: 'Teams', rows: teamRows(ctx) })
        break
      case 'players':
        if (ctx.players.length > 0) sheets.push({ name: 'Players', rows: playerRows(ctx) })
        break
      case 'fixtures':
      case 'tiesheet':
        if (ctx.matches.length > 0) sheets.push({ name: 'Fixtures', rows: fixtureRows(ctx, false) })
        break
      case 'results': {
        const rows = fixtureRows(ctx, true)
        if (rows.length > 0) sheets.push({ name: 'Results', rows })
        break
      }
      case 'schedule': {
        const rows = scheduleRows(ctx)
        if (rows.length > 0) sheets.push({ name: 'Schedule', rows })
        break
      }
      case 'standings':
        ctx.standings.forEach((table, i) => {
          if (table.rows.length === 0) return
          sheets.push({
            // Sheet names are capped at 31 characters by the format.
            name: (table.groupName ?? 'Standings').slice(0, 28) || `Table ${i + 1}`,
            rows: standingsRows(ctx, table),
          })
        })
        break
      default:
        break
    }
  }

  // De-duplicate, since 'tiesheet' and 'fixtures' produce the same sheet.
  const seen = new Set<string>()
  const unique = sheets.filter((sheet) => {
    if (seen.has(sheet.name)) return false
    seen.add(sheet.name)
    return true
  })

  if (unique.length === 0) {
    throw new Error('There is no data to export yet.')
  }

  const data = unique.map((sheet) => {
    const headers = Object.keys(sheet.rows[0] ?? {})
    const headerRow = headers.map((h) => ({
      value: h,
      fontWeight: 'bold' as const,
      backgroundColor: '#F1F5F9',
    }))
    const bodyRows = sheet.rows.map((row) =>
      headers.map((h) => {
        const value = row[h]
        if (typeof value === 'number') return { type: Number, value }
        return { type: String, value: value == null ? '' : String(value) }
      }),
    )
    return [headerRow, ...bodyRows]
  })

  await writeXlsxFile(data as never, {
    sheets: unique.map((s) => s.name),
    fileName: `${slugify(ctx.tournament.name, false)}.xlsx`,
  })
}

/* ── PDF ─────────────────────────────────────────────────────────────────── */

const PDF_HEAD_FILL: [number, number, number] = [23, 37, 55]
const PDF_ACCENT: [number, number, number] = [16, 138, 96]

function pdfHeader(
  doc: jsPDF,
  ctx: ExportContext,
  subtitle: string,
): number {
  const width = doc.internal.pageSize.getWidth()
  const format = getFormat(ctx.tournament.formatType)

  doc.setFillColor(...PDF_HEAD_FILL)
  doc.rect(0, 0, width, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(ctx.tournament.name, 12, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const meta = [ctx.sport.name, format.name, ctx.tournament.venue, ctx.tournament.location]
    .filter(Boolean)
    .join('  ·  ')
  doc.text(meta, 12, 19)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(subtitle, width - 12, 12, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const dates = ctx.tournament.startDate
    ? `${formatDateLong(ctx.tournament.startDate)}${
        ctx.tournament.endDate && ctx.tournament.endDate !== ctx.tournament.startDate
          ? ` – ${formatDateLong(ctx.tournament.endDate)}`
          : ''
      }`
    : ''
  if (dates) doc.text(dates, width - 12, 19, { align: 'right' })

  doc.setTextColor(0, 0, 0)
  return 34
}

function pdfFooter(doc: jsPDF, ctx: ExportContext): void {
  const pageCount = doc.getNumberOfPages()
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFontSize(7.5)
    doc.setTextColor(120, 120, 120)
    const left = [ctx.tournament.organizer, ctx.tournament.contactPhone]
      .filter(Boolean)
      .join('  ·  ')
    if (left) doc.text(left, 12, height - 8)
    doc.text(`Page ${page} of ${pageCount}`, width - 12, height - 8, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }
}

function addTable(
  doc: jsPDF,
  startY: number,
  rows: Record<string, unknown>[],
  title?: string,
): number {
  if (rows.length === 0) return startY

  let y = startY
  if (title) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title, 12, y)
    y += 4
  }

  const headers = Object.keys(rows[0])
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows.map((row) => headers.map((h) => String(row[h] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: PDF_HEAD_FILL, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 12, right: 12 },
    theme: 'grid',
  })

  // autoTable stores the finishing position on the doc.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
  return (finalY ?? y) + 8
}

export interface PdfOptions {
  paper: PaperSize
  orientation: Orientation
  targets: ExportTarget[]
}

/** Build a multi-section PDF report. */
export function exportPDF(ctx: ExportContext, options: PdfOptions): void {
  const { paper, orientation, targets } = options

  if (targets.length === 0) throw new Error('Choose at least one section to include.')

  const doc = new jsPDF({ orientation, unit: 'mm', format: paper })
  let first = true

  function section(title: string, build: (y: number) => number) {
    if (!first) doc.addPage()
    first = false
    const y = pdfHeader(doc, ctx, title)
    build(y)
  }

  for (const target of targets) {
    switch (target) {
      case 'tiesheet':
        section('Tie Sheet', (y) => {
          let cursor = y
          // Print the bracket as one table per round — reliable on paper, and
          // legible even when the on-screen bracket is very wide.
          const bracketRounds = ctx.rounds.filter(
            (r) => r.kind === 'winners' || r.kind === 'losers' || r.kind === 'grand_final' || r.kind === 'third_place',
          )
          if (bracketRounds.length === 0) {
            doc.setFontSize(10)
            doc.text('This format does not produce a bracket.', 12, cursor)
            return cursor
          }
          for (const round of bracketRounds) {
            const rows = ctx.matches
              .filter((m) => m.roundId === round.id)
              .sort((a, b) => a.position - b.position)
              .map((match) => ({
                '#': match.number,
                Home: participantName(ctx, match.homeId),
                Score: match.score ? formatScoreline(match.score, ctx.sport) : 'vs',
                Away: participantName(ctx, match.awayId),
                Date: match.date ? formatDateLong(match.date) : '',
                Time: match.time ? formatTime(match.time) : '',
                Venue: venueName(ctx, match.venueId),
              }))
            cursor = addTable(doc, cursor, rows, round.name)
          }
          return cursor
        })
        break

      case 'fixtures':
        section('Fixtures', (y) => addTable(doc, y, fixtureRows(ctx, false)))
        break

      case 'results':
        section('Results', (y) => addTable(doc, y, fixtureRows(ctx, true)))
        break

      case 'standings':
        section('Standings', (y) => {
          let cursor = y
          if (ctx.standings.length === 0) {
            doc.setFontSize(10)
            doc.text('This format does not produce a standings table.', 12, cursor)
            return cursor
          }
          for (const table of ctx.standings) {
            cursor = addTable(doc, cursor, standingsRows(ctx, table), table.groupName ?? undefined)
          }
          return cursor
        })
        break

      case 'teams':
        section(ctx.sport.participantType === 'team' ? 'Team List' : 'Entry List', (y) =>
          addTable(doc, y, teamRows(ctx)),
        )
        break

      case 'players':
        section('Player List', (y) => addTable(doc, y, playerRows(ctx)))
        break

      case 'schedule':
        section('Match Schedule', (y) => addTable(doc, y, scheduleRows(ctx)))
        break

      default:
        break
    }
  }

  pdfFooter(doc, ctx)

  // Signature line, useful for officially posted tie sheets.
  doc.setPage(doc.getNumberOfPages())
  const height = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...PDF_ACCENT)
  doc.setLineWidth(0.3)
  doc.line(12, height - 20, 70, height - 20)
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text('Organizer signature', 12, height - 15)

  doc.save(`${slugify(ctx.tournament.name, false)}-${targets.join('-')}.pdf`)
}

/* ── PNG ─────────────────────────────────────────────────────────────────── */

/** Rasterise a DOM node — used for the bracket canvas. */
export async function exportPNG(
  element: HTMLElement,
  filename: string,
  options: { background?: string; scale?: number } = {},
): Promise<void> {
  const dataUrl = await toPng(element, {
    backgroundColor: options.background ?? '#ffffff',
    pixelRatio: options.scale ?? 2,
    // React Flow renders controls and the minimap into the same tree; leave
    // them out so the exported image is just the bracket.
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true
      return !(
        node.classList?.contains('react-flow__controls') ||
        node.classList?.contains('react-flow__minimap') ||
        node.classList?.contains('react-flow__panel')
      )
    },
  })

  const response = await fetch(dataUrl)
  downloadBlob(await response.blob(), `${filename}.png`)
}

export { TARGET_LABELS }
