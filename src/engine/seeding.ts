/**
 * Draw and seeding.
 *
 * The standard recursive bracket order guarantees that, in a full bracket, the
 * top two seeds can only meet in the final, seeds 1–4 only from the semis, and
 * so on. Optional seed protection relaxes or tightens that for partial draws.
 */

import type { Participant } from '@/types'
import { nextPowerOfTwo, shuffle } from '@/lib/utils'

/**
 * Seed positions for a bracket of `size`, as 1-based seed numbers in slot order.
 *
 *   size 4 → [1, 4, 2, 3]
 *   size 8 → [1, 8, 4, 5, 2, 7, 3, 6]
 *
 * Reading the result in pairs gives the first-round matchups.
 */
export function seedOrder(size: number): number[] {
  if (size < 2) return [1]
  let order = [1, 2]
  while (order.length < size) {
    const round = order.length * 2
    const next: number[] = []
    for (const seed of order) {
      next.push(seed, round + 1 - seed)
    }
    order = next
  }
  return order
}

/**
 * Place participants into bracket slots.
 *
 * Returns an array of length `bracketSize` where each entry is a participant or
 * null (a bye). Byes always fall to the strongest seeds, which is what makes an
 * 11-team knockout fair rather than arbitrary.
 */
export function buildDrawSlots(
  participants: readonly Participant[],
  method: 'random' | 'seeded' | 'manual',
): (Participant | null)[] {
  const size = nextPowerOfTwo(participants.length)
  const ordered = orderParticipants(participants, method)
  const positions = seedOrder(size)

  const slots: (Participant | null)[] = Array.from({ length: size }, () => null)
  positions.forEach((seedNumber, slotIndex) => {
    // seedNumber is 1-based; anything past the entry count is a bye.
    slots[slotIndex] = ordered[seedNumber - 1] ?? null
  })
  return slots
}

/**
 * Order participants strongest-first according to the draw method.
 * `manual` keeps the organizer's existing order untouched.
 */
export function orderParticipants(
  participants: readonly Participant[],
  method: 'random' | 'seeded' | 'manual',
): Participant[] {
  if (method === 'random') return shuffle(participants)
  if (method === 'manual') return participants.slice()

  // Seeded: explicit seeds first in numeric order, then the unseeded, shuffled
  // so that an all-unseeded field still produces a varied draw.
  const seeded = participants.filter((p) => p.seed != null).sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
  const unseeded = shuffle(participants.filter((p) => p.seed == null))
  return [...seeded, ...unseeded]
}

/**
 * Cross-group knockout pairing.
 *
 * Given qualifiers keyed by group, produce first-round pairs that avoid two
 * teams from the same group meeting immediately: A1–B2, B1–A2, C1–D2, D1–C2…
 */
export function crossGroupPairs(
  qualifiers: { groupId: string; position: number; participant: Participant }[],
): (Participant | null)[] {
  const byPosition = new Map<number, typeof qualifiers>()
  for (const q of qualifiers) {
    const bucket = byPosition.get(q.position)
    if (bucket) bucket.push(q)
    else byPosition.set(q.position, [q])
  }

  const winners = (byPosition.get(1) ?? []).slice()
  const runnersUp = (byPosition.get(2) ?? []).slice()
  const rest = qualifiers.filter((q) => q.position > 2)

  const slots: (Participant | null)[] = []

  // Pair winners against runners-up from a neighbouring group, swapped in twos.
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i]
    // Swap partners within each consecutive pair of groups: 0↔1, 2↔3, …
    const partnerIndex = i % 2 === 0 ? i + 1 : i - 1
    const opponent = runnersUp[partnerIndex] ?? runnersUp[i] ?? null
    slots.push(winner.participant, opponent ? opponent.participant : null)
  }

  // Any deeper qualifiers (3rd places in a 3-advance format) fill the tail.
  for (const q of rest) slots.push(q.participant)

  // Pad to a power of two so the bracket builder gets a clean size.
  const size = nextPowerOfTwo(slots.length)
  while (slots.length < size) slots.push(null)
  return slots
}

/**
 * Would this draw put two protected seeds against each other too early?
 * Returns the offending pairs so the UI can warn rather than silently proceed.
 */
export function checkSeedProtection(
  slots: readonly (Participant | null)[],
  protectRounds: number,
): { seedA: number; seedB: number; round: number }[] {
  if (protectRounds <= 0) return []
  const problems: { seedA: number; seedB: number; round: number }[] = []
  const protectedCount = 2 ** protectRounds

  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i]
    const b = slots[i + 1]
    if (!a?.seed || !b?.seed) continue
    if (a.seed <= protectedCount && b.seed <= protectedCount) {
      problems.push({ seedA: a.seed, seedB: b.seed, round: 1 })
    }
  }
  return problems
}

/** Assign 1-based seed numbers in the given order. */
export function assignSeeds<T extends { id: string }>(items: readonly T[]): Map<string, number> {
  const map = new Map<string, number>()
  items.forEach((item, i) => map.set(item.id, i + 1))
  return map
}

/**
 * Distribute participants across groups using the snake method, so seeded
 * strength is spread evenly rather than stacked in Group A.
 */
export function snakeIntoGroups(
  participants: readonly Participant[],
  groupCount: number,
): Participant[][] {
  const groups: Participant[][] = Array.from({ length: groupCount }, () => [])
  participants.forEach((p, i) => {
    const row = Math.floor(i / groupCount)
    const col = i % groupCount
    // Reverse direction on every other row — that is the "snake".
    const target = row % 2 === 0 ? col : groupCount - 1 - col
    groups[target].push(p)
  })
  return groups
}
