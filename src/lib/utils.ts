import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-aware className joiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** UUID v4, matching the database's `uuid` primary keys. */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for non-secure contexts.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** URL-safe slug, with a short random suffix to keep public links unique. */
export function slugify(input: string, withSuffix = true): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  const safe = base || 'tournament'
  if (!withSuffix) return safe
  return `${safe}-${Math.random().toString(36).slice(2, 6)}`
}

/** Initials for an avatar fallback: 'Budhanilkantha FC' → 'BF'. */
export function initials(name: string, max = 2): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, max)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** A 3-letter short name guess: 'Budhanilkantha FC' → 'BUD'. */
export function guessShortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 3) return parts.slice(0, 3).map((p) => p[0].toUpperCase()).join('')
  if (parts.length === 2 && parts[1].length <= 3) return (parts[0].slice(0, 2) + parts[1][0]).toUpperCase()
  return (parts[0] ?? '').slice(0, 3).toUpperCase() || 'TBD'
}

/** Deterministic colour from a string, so a team keeps its chip colour. */
const CHIP_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
]

export function colorFor(seedText: string): string {
  let h = 0
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) | 0
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length]
}

/** Fisher–Yates shuffle on a copy. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Smallest power of two greater than or equal to n (minimum 2). */
export function nextPowerOfTwo(n: number): number {
  if (n <= 2) return 2
  return 2 ** Math.ceil(Math.log2(n))
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Group array items by a derived key, preserving insertion order. */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  key: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k)
    if (bucket) bucket.push(item)
    else map.set(k, [item])
  }
  return map
}

/** Stable sort by a list of comparators, first non-zero wins. */
export function sortBy<T>(items: readonly T[], ...comparators: ((a: T, b: T) => number)[]): T[] {
  return items.slice().sort((a, b) => {
    for (const cmp of comparators) {
      const r = cmp(a, b)
      if (r !== 0) return r
    }
    return 0
  })
}

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items))
}

/** Pluralise using an explicit pair, avoiding naive '+s'. */
export function plural(n: number, pair: [string, string]): string {
  return n === 1 ? pair[0] : pair[1]
}

/** Read a File as a data URL, for logo/photo uploads without a backend. */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

/** Trigger a client-side download of a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Alphabet labels for groups: 0 → 'A', 25 → 'Z', 26 → 'AA'. */
export function alphaLabel(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}
