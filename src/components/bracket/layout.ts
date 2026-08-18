/**
 * Bracket layout.
 *
 * Pure geometry: given rounds and matches, work out where each match card sits
 * and which cards are joined. Kept separate from React Flow so the layout can
 * be reasoned about (and reused by the PNG/PDF export) without a canvas.
 */

import type { Match, Round } from '@/types'

export const NODE_WIDTH = 236
export const NODE_HEIGHT = 96
export const COLUMN_GAP = 76
export const ROW_GAP = 22
/** Vertical space between the winners bracket and the losers bracket. */
export const SECTION_GAP = 120

export interface BracketNode {
  id: string
  match: Match
  round: Round
  x: number
  y: number
  /** Column index across the whole diagram. */
  column: number
}

export interface BracketEdge {
  id: string
  source: string
  target: string
  /** True when the feeding match has produced a winner. */
  decided: boolean
  /** Losers-bracket drops are drawn differently from winners progressions. */
  kind: 'winner' | 'loser'
}

export interface BracketLayout {
  nodes: BracketNode[]
  edges: BracketEdge[]
  width: number
  height: number
  /** Column headers, in display order. */
  columns: { label: string; x: number; kind: Round['kind'] }[]
}

/**
 * Lay out one section (a set of rounds that chain together).
 *
 * Round 0 stacks evenly; every later round centres each match between the two
 * matches that feed it, which is what produces the classic bracket silhouette.
 */
function layoutSection(
  rounds: Round[],
  matchesByRound: Map<string, Match[]>,
  startColumn: number,
  startY: number,
): { nodes: BracketNode[]; height: number; nextColumn: number } {
  const nodes: BracketNode[] = []
  const centreOf = new Map<string, number>()
  let maxBottom = startY

  rounds.forEach((round, index) => {
    const matches = matchesByRound.get(round.id) ?? []
    const column = startColumn + index
    const x = column * (NODE_WIDTH + COLUMN_GAP)

    matches.forEach((match, i) => {
      let centre: number

      const feeders = [match.homeSource?.matchId, match.awaySource?.matchId]
        .filter(Boolean)
        .map((id) => centreOf.get(id as string))
        .filter((v): v is number => v != null)

      if (index === 0 || feeders.length === 0) {
        // Stack evenly, allowing room for the fan-out of later rounds.
        const spacing = NODE_HEIGHT + ROW_GAP
        centre = startY + i * spacing + NODE_HEIGHT / 2
      } else {
        centre = feeders.reduce((a, b) => a + b, 0) / feeders.length
      }

      centreOf.set(match.id, centre)
      const y = centre - NODE_HEIGHT / 2
      nodes.push({ id: match.id, match, round, x, y, column })
      maxBottom = Math.max(maxBottom, y + NODE_HEIGHT)
    })
  })

  return { nodes, height: maxBottom - startY, nextColumn: startColumn + rounds.length }
}

/**
 * Build the full layout.
 *
 * Winners rounds run left to right along the top. A losers bracket, when there
 * is one, runs underneath on its own row, and the grand final sits to the right
 * of both. Third-place play-offs hang below the final.
 */
export function buildBracketLayout(rounds: Round[], matches: Match[]): BracketLayout {
  const matchesByRound = new Map<string, Match[]>()
  for (const match of matches) {
    const bucket = matchesByRound.get(match.roundId)
    if (bucket) bucket.push(match)
    else matchesByRound.set(match.roundId, [match])
  }
  for (const list of matchesByRound.values()) {
    list.sort((a, b) => a.position - b.position || a.number - b.number)
  }

  const ordered = rounds.slice().sort((a, b) => a.position - b.position)

  // Group stages have no bracket geometry — exclude them.
  const winners = ordered.filter((r) => r.kind === 'winners')
  const losers = ordered.filter((r) => r.kind === 'losers')
  const grandFinals = ordered.filter((r) => r.kind === 'grand_final')
  const thirdPlace = ordered.filter((r) => r.kind === 'third_place')

  const nodes: BracketNode[] = []
  const columns: BracketLayout['columns'] = []

  const wb = layoutSection(winners, matchesByRound, 0, 0)
  nodes.push(...wb.nodes)
  winners.forEach((round, i) => {
    columns.push({
      label: round.name,
      x: i * (NODE_WIDTH + COLUMN_GAP),
      kind: round.kind,
    })
  })

  let bottom = wb.height

  if (losers.length > 0) {
    const lbStartY = bottom + SECTION_GAP
    const lb = layoutSection(losers, matchesByRound, 0, lbStartY)
    nodes.push(...lb.nodes)
    bottom = lbStartY + lb.height
  }

  // Grand final goes one column right of the widest section.
  const usedColumns = Math.max(winners.length, losers.length)
  if (grandFinals.length > 0) {
    const gf = layoutSection(grandFinals, matchesByRound, usedColumns, 0)
    // Centre the grand final against the winners bracket's final.
    const wbFinal = wb.nodes.filter((n) => n.column === winners.length - 1)
    const anchor =
      wbFinal.length > 0
        ? wbFinal.reduce((sum, n) => sum + n.y, 0) / wbFinal.length
        : 0
    gf.nodes.forEach((node, i) => {
      node.y = anchor + i * (NODE_HEIGHT + ROW_GAP)
      nodes.push(node)
    })
    grandFinals.forEach((round, i) => {
      columns.push({
        label: round.name,
        x: (usedColumns + i) * (NODE_WIDTH + COLUMN_GAP),
        kind: round.kind,
      })
    })
  }

  if (thirdPlace.length > 0) {
    // Sit the play-off below the final, in the final's own column.
    const finalColumn = Math.max(0, winners.length - 1)
    const x = finalColumn * (NODE_WIDTH + COLUMN_GAP)
    thirdPlace.forEach((round, i) => {
      const roundMatches = matchesByRound.get(round.id) ?? []
      roundMatches.forEach((match, j) => {
        nodes.push({
          id: match.id,
          match,
          round,
          x,
          y: bottom + SECTION_GAP / 2 + (i + j) * (NODE_HEIGHT + ROW_GAP),
          column: finalColumn,
        })
      })
    })
    bottom += SECTION_GAP / 2 + NODE_HEIGHT
  }

  /* Edges from each match's declared sources. */
  const nodeIds = new Set(nodes.map((n) => n.id))
  const byId = new Map(matches.map((m) => [m.id, m]))
  const edges: BracketEdge[] = []

  for (const node of nodes) {
    for (const [slot, source] of [
      ['home', node.match.homeSource],
      ['away', node.match.awaySource],
    ] as const) {
      if (!source?.matchId || !nodeIds.has(source.matchId)) continue
      const feeder = byId.get(source.matchId)
      const decided = Boolean(
        feeder && (feeder.status === 'completed' || feeder.status === 'walkover'),
      )
      edges.push({
        id: `${source.matchId}-${node.id}-${slot}`,
        source: source.matchId,
        target: node.id,
        decided,
        kind: source.kind === 'loser' ? 'loser' : 'winner',
      })
    }
  }

  const maxX = nodes.reduce((max, n) => Math.max(max, n.x + NODE_WIDTH), NODE_WIDTH)

  return {
    nodes,
    edges,
    width: maxX,
    height: Math.max(bottom, NODE_HEIGHT),
    columns,
  }
}

/** Does this tournament have anything to draw as a bracket? */
export function hasBracketRounds(rounds: Round[]): boolean {
  return rounds.some(
    (r) =>
      r.kind === 'winners' ||
      r.kind === 'losers' ||
      r.kind === 'grand_final' ||
      r.kind === 'third_place',
  )
}
