# TieSheet — Universal Tournament & Tie Sheet Maker

A sport-agnostic tournament management app. Create a tournament for **any** sport, add teams or
players, generate fixtures, run the event, and export a professional tie sheet — in a few minutes.

Football, futsal, cricket, basketball, volleyball, badminton, table tennis, tennis and esports ship
out of the box, and an organizer can define an entirely new sport at runtime without a code change.

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build     # type-check + production build
npm run preview   # serve the built app
npm run typecheck # types only
```

No backend or API key is needed. Everything persists to `localStorage`, so the app works offline and
can be hosted as static files anywhere.

On first run the tournament list offers **Load demo data** — four part-played tournaments
(football knockout, cricket groups→knockout, basketball league, 32-player badminton draw) built by
running the real engine, so nothing in the demo can drift out of sync with the code.

---

## The core idea: sports are data

The requirement that shaped everything else was *no `if (football)` anywhere*. The engine never
learns a sport's name. Instead, each sport is a serializable `SportConfig` record
([src/config/sports.ts](src/config/sports.ts)):

```ts
{
  id: 'badminton',
  participantType: 'individual',
  scoringType: 'sets',            // 'aggregate' | 'sets' | 'innings'
  periods: { count: 3, label: 'Game', setsToWin: 2, pointsPerSet: 21 },
  allowsDraw: false,
  pointsRule: { win: 1, draw: 0, loss: 0 },
  standingsColumns: ['played', 'won', 'lost', 'setsFor', 'setsAgainst', 'setsDiff', 'points'],
  tiebreakers: [{ key: 'points', dir: 'desc' }, { key: 'setsDiff', dir: 'desc' }, …],
}
```

Three consequences worth knowing:

- **Score entry adapts itself.** `scoringType` selects one of three input shapes, and the period
  config decides how many boxes appear and what they are called. Football gets `2 - 1`, basketball
  `82 - 76`, cricket `164/7` with overs for run rate, volleyball `3 - 1`, badminton three game
  scores. One component, no branching outside it ([ScoreEntry.tsx](src/components/matches/ScoreEntry.tsx)).
- **Standings are declarative.** The engine computes *every* canonical statistic for every sport —
  it is cheap — and a sport merely chooses which columns to show and in what order to break ties.
  That is why cricket gets NRR and no-results while basketball gets win percentage and point
  difference, with no sport-specific code path.
- **Custom sports are first-class.** `+ Add Custom Sport` produces exactly the same record shape as
  a built-in, so an invented game gets working brackets, standings and exports immediately.

Tournament formats follow the same pattern ([src/config/formats.ts](src/config/formats.ts)): each
declares which config fields the wizard should surface and what participant counts it supports.

---

## What it does

**Create** — a four-step wizard: details and sport → format and its options → entrants → review.
Match-count and bracket-size previews update as you go, and the draft survives a reload.

**Teams & players** — add, edit, duplicate, delete; logos, captains, jersey numbers, positions,
photos and contact details. Individual sports get a flat player list instead of squads.

**Bulk import** — CSV or Excel, with flexible header matching (`team`, `club`, `name`, `no` all
work), a downloadable per-sport template, and a mandatory preview: row count, the teams that will be
created, and every warning, before anything is written.

**Draw & seeding** — random, seeded or manual. Reorder by hand, shuffle, or auto-seed from current
standings. Optional seed protection warns you when two protected seeds would meet in round one. The
first-round preview is built by the same code that generates the real draw.

**Formats** — knockout (single elimination, byes to the top seeds, optional third-place play-off),
double elimination (winners + losers brackets, grand final, optional reset), round robin (circle
method, optional home-and-away), and groups → knockout with configurable advancement and cross-group
pairing. Best-of-3/5/7 is modelled where it actually lives: as sets within a match.

**Tie sheet** — an interactive React Flow bracket. Match cards show number, logos, scores, schedule
and status; losers-bracket drops are dashed. Click any match to open the full panel.

**Results** — enter a score and the winner advances, standings recalculate, and the tournament's
status updates. Walkovers, no-results and cancellations are all first-class. Correcting an old score
months later cleanly rewrites everything downstream — see *Advancement* below.

**Standings** — sport-aware columns with tooltips, form pills, qualification highlighting, an
explanation of the tiebreaker order, and a card layout on mobile. Knockouts get an unofficial summary
table, clearly labelled as such.

**Schedule** — auto-schedule the whole event across days, times and venues, then adjust individual
matches. Conflict detection covers venue double-booking (respecting multi-court capacity),
participants double-booked or under-rested, and officials double-booked. List, by-day and by-venue
views.

**Public page** — a shareable read-only page at `#/p/<slug>` with overview, bracket, fixtures,
results, standings, teams and players. Built mobile-first.

**Export** — PDF (A4/A3, portrait/landscape, pick your sections, signature line), Excel (one sheet
per section), CSV per section, bracket as PNG, and a dedicated print stylesheet. Printing the tie
sheet produces a paginated document rather than a cropped canvas, because a React Flow surface cannot
paginate.

---

## Architecture

```
src/
├── types/          Domain types — the contract the rest of the app codes against
├── config/         Sport and format registries (data, not code)
├── engine/         Pure tournament logic; no React, no stores, no I/O
│   ├── scoring.ts      The only module that knows about ScoringType
│   ├── seeding.ts      Bracket seed order, byes, group snaking, cross-group pairing
│   ├── fixtures.ts     Generators: single/double elimination, round robin, groups
│   ├── standings.ts    Canonical stats + declarative tiebreakers
│   ├── advancement.ts  Full recompute of every fed slot
│   ├── validation.ts   Errors block, warnings inform
│   └── schedule.ts     Auto-scheduling and conflict detection
├── stores/         Zustand slices, one concern each, separately persisted
├── services/       Cross-store orchestration (tournament, import, export)
├── hooks/          Derived data — standings, stats, conflicts, page scoping
├── components/
│   ├── ui/         shadcn/ui primitives on Radix
│   ├── shared/     Sport-aware domain components
│   ├── layout/     Shell, sidebar, header, command menu, error boundary
│   ├── wizard/     Creation steps + custom sport builder
│   ├── teams/      Team editor, import dialog
│   ├── matches/    Score entry, match panel
│   ├── bracket/    Layout engine, match node, canvas, print layout
│   └── standings/  Table and card views
├── pages/          One per route
└── data/seed.ts    Demo tournaments, built by running the engine
```

### Advancement: recompute, never patch

The one design decision most worth calling out. When a result is saved, the engine does **not** push
the winner into the next match. Instead `propagateResults` recomputes *every* fed slot in the
tournament from scratch, in match-number order:

```ts
const updated = propagateResults(matches, participants, groups, sport, config)
```

It is idempotent, so calling it more often than necessary is always safe — and correcting a
first-round score long after the fact rewrites the whole downstream bracket correctly instead of
leaving a stale participant sitting in the final. Slot changes that invalidate a recorded result
clear that result rather than keep a wrong scoreline. Group qualifiers are only released once every
match in that group has a result, so the knockout bracket cannot flip around as late group games
come in.

### State

Six Zustand stores, each with its own `localStorage` key and its own concern: tournaments, teams &
players, matches & rounds & groups, sports, venues & officials, and UI. Cross-store work lives in
`services/`, so stores stay simple slices and components stay declarative. The wizard has its own
transient store, keeping an abandoned draft out of the real data.

### Database

[supabase/schema.sql](supabase/schema.sql) is the server-side counterpart: 18 tables with UUID keys,
foreign keys, indexes, check constraints, `updated_at` triggers, Row Level Security throughout
(public tournaments readable by anyone, everything else owner-only), and two convenience views. The
TypeScript types map 1:1 onto the tables, so adopting Supabase means swapping the persistence layer
rather than redesigning the domain. Sport rule sets are versioned and pinned per tournament, so
revising a sport cannot retroactively change a finished event's results.

---

## Deliberate limitations

Stated plainly rather than hidden:

- **Data is per-browser.** There is no backend, so a public link only resolves in a browser that has
  the tournament in its `localStorage`. The schema and the Supabase-shaped types are the migration
  path.
- **Images are stored inline** as data URLs, capped at ~1 MB each, because `localStorage` is finite.
- **Two-legged knockout ties** (home and away, decided on aggregate) are not implemented. Home-and-away
  *is* supported for round robin and group stages via the double round robin option, and knockouts
  can use best-of-3/5/7. A true two-leg bracket needs a tie-level entity above matches; the flat
  match model was the better trade for correctness here.
- **Live scoring is manual.** There is no realtime feed; an organizer marks a match live and enters
  the score.

---

## Tech

React 18 · TypeScript (strict) · Vite 6 · Tailwind CSS 3 · shadcn/ui on Radix · Zustand 5 ·
React Flow (`@xyflow/react`) · lucide-react · date-fns · Papa Parse · `read-excel-file` /
`write-excel-file` · jsPDF + AutoTable · html-to-image · sonner · cmdk

Light and dark themes (following the OS by default), responsive from phone to desktop, keyboard
navigable, error boundaries per route, `⌘K` command palette.
# MatchMatrix-Tie-sheet
