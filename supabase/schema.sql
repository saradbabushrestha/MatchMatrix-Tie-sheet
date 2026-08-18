-- =============================================================================
--  TieSheet — Universal Tournament & Tie Sheet Maker
--  PostgreSQL / Supabase schema
-- =============================================================================
--
--  The app ships as a browser-local product: every store persists to
--  localStorage, so it runs with no backend at all. This schema is the server
--  side of that same data model — the TypeScript types in `src/types` map 1:1
--  onto these tables, so moving to Supabase is a matter of swapping the store
--  persistence layer for queries, not redesigning the domain.
--
--  Design notes:
--    * UUID primary keys throughout, generated server-side.
--    * Sports and formats are *data*, not enums-with-behaviour: the config that
--      drives the engine lives in `sport_configs`, which is what lets an
--      organizer add a custom sport without a migration.
--    * Every child table cascades from its tournament, so deleting a tournament
--      is a single statement.
--    * Row Level Security is on everywhere; public tournaments are readable by
--      anyone, everything else only by its owner.
--
--  Apply with:  psql "$DATABASE_URL" -f supabase/schema.sql
-- =============================================================================

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
--  Enumerated types
-- ─────────────────────────────────────────────────────────────────────────────

create type participant_type as enum ('team', 'individual');

create type scoring_type as enum ('aggregate', 'sets', 'innings');

create type draw_resolution as enum ('shootout', 'extra_period', 'super_over', 'none');

create type format_type as enum (
  'single_elimination',
  'double_elimination',
  'round_robin',
  'group_knockout'
);

create type tournament_status as enum ('draft', 'setup', 'active', 'completed');

create type draw_method as enum ('random', 'seeded', 'manual');

create type round_kind as enum (
  'group',
  'winners',
  'losers',
  'grand_final',
  'third_place',
  'league'
);

create type match_status as enum (
  'pending',
  'scheduled',
  'live',
  'completed',
  'cancelled',
  'walkover',
  'no_result'
);

create type match_side as enum ('home', 'away');

create type slot_source_kind as enum ('winner', 'loser', 'group');

-- ─────────────────────────────────────────────────────────────────────────────
--  users
--  Mirrors auth.users so app data can carry its own profile fields.
-- ─────────────────────────────────────────────────────────────────────────────

create table users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text        not null,
  full_name   text,
  avatar_url  text,
  organization text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table users is 'Application profile for an authenticated organizer.';

-- ─────────────────────────────────────────────────────────────────────────────
--  sports / sport_configs
--
--  `sports` is the catalogue entry; `sport_configs` holds the versioned rule set
--  the tournament engine reads. Splitting them means a built-in sport's rules can
--  be revised without breaking tournaments already running under the old rules —
--  a tournament pins the exact config row it was created with.
-- ─────────────────────────────────────────────────────────────────────────────

create table sports (
  id                uuid primary key default gen_random_uuid(),
  -- Stable text key used by the client ('football', 'custom-kabaddi-a1b2').
  slug              text        not null unique,
  name              text        not null,
  short_name        text        not null,
  icon              text        not null default '🏆',
  lucide_icon       text        not null default 'Trophy',
  is_built_in       boolean     not null default false,
  -- Null for built-ins; set for a sport an organizer created.
  created_by        uuid        references users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index sports_created_by_idx on sports (created_by) where created_by is not null;

create table sport_configs (
  id                     uuid primary key default gen_random_uuid(),
  sport_id               uuid        not null references sports (id) on delete cascade,
  -- Bumped when the rule set changes; tournaments pin a specific version.
  version                integer     not null default 1,

  participant_type       participant_type not null,
  scoring_type           scoring_type     not null,

  team_size              integer     not null check (team_size >= 1),
  squad_size             integer     not null check (squad_size >= 1),

  -- Period / set structure.
  period_count           integer     not null check (period_count >= 1),
  period_label           text        not null,
  period_duration_min    integer     check (period_duration_min > 0),
  sets_to_win            integer     check (sets_to_win >= 1),
  points_per_set         integer     check (points_per_set >= 1),

  match_duration_min     integer     not null check (match_duration_min > 0),

  allows_draw            boolean     not null default true,
  draw_resolution        draw_resolution not null default 'none',
  draw_resolution_label  text        not null default '',

  -- Points awarded per result.
  points_win             numeric(5,2) not null default 3,
  points_draw            numeric(5,2) not null default 1,
  points_loss            numeric(5,2) not null default 0,
  points_walkover        numeric(5,2),
  points_no_result       numeric(5,2) not null default 0,

  -- Ordered arrays of canonical stat keys; validated by the client's StatKey union.
  standings_columns      text[]      not null default '{}',
  -- Ordered [{ key, dir }] pairs.
  tiebreakers            jsonb       not null default '[]'::jsonb,

  score_noun_singular    text        not null default 'point',
  score_noun_plural      text        not null default 'points',
  positions              text[]      not null default '{}',
  official_roles         text[]      not null default '{}',

  created_at             timestamptz not null default now(),

  unique (sport_id, version),
  -- A set-based sport needs to know how many sets win it.
  constraint sets_need_target check (
    scoring_type <> 'sets' or sets_to_win is not null
  ),
  constraint squad_at_least_team check (squad_size >= team_size)
);

create index sport_configs_sport_idx on sport_configs (sport_id, version desc);

comment on table sport_configs is
  'Serializable rule set driving the tournament engine. Adding a sport is an insert, never a migration.';

-- ─────────────────────────────────────────────────────────────────────────────
--  tournament_formats
--  Catalogue of structural families and what each one needs from the organizer.
-- ─────────────────────────────────────────────────────────────────────────────

create table tournament_formats (
  id                uuid primary key default gen_random_uuid(),
  slug              format_type not null unique,
  name              text        not null,
  tagline           text        not null,
  description       text        not null default '',
  icon              text        not null default '🏆',
  -- Which FormatConfig fields the wizard should surface.
  config_fields     text[]      not null default '{}',
  min_participants  integer     not null default 2,
  max_participants  integer     not null default 128,
  has_standings     boolean     not null default false,
  has_bracket       boolean     not null default false,
  notes             text[]      not null default '{}',
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
--  tournaments
-- ─────────────────────────────────────────────────────────────────────────────

create table tournaments (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid        not null references users (id) on delete cascade,

  -- Public URL identifier.
  slug              text        not null unique,
  name              text        not null check (length(trim(name)) > 0),
  description       text        not null default '',

  sport_id          uuid        not null references sports (id) on delete restrict,
  -- Pinned so a later rule revision cannot retroactively change results.
  sport_config_id   uuid        not null references sport_configs (id) on delete restrict,
  participant_type  participant_type not null,

  logo_url          text,

  organizer         text        not null default '',
  venue             text        not null default '',
  location          text        not null default '',
  start_date        date,
  end_date          date,
  contact_name      text        not null default '',
  contact_email     text        not null default '',
  contact_phone     text        not null default '',

  format_type       format_type not null,
  -- The whole FormatConfig record; flat and additive, so new knobs need no migration.
  config            jsonb       not null default '{}'::jsonb,

  status            tournament_status not null default 'setup',
  fixtures_generated boolean    not null default false,
  public_visible    boolean     not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint dates_in_order check (end_date is null or start_date is null or end_date >= start_date)
);

create index tournaments_owner_idx      on tournaments (owner_id, created_at desc);
create index tournaments_public_idx     on tournaments (slug) where public_visible;
create index tournaments_status_idx     on tournaments (owner_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
--  tournament_settings
--  Non-structural knobs, one row per tournament.
-- ─────────────────────────────────────────────────────────────────────────────

create table tournament_settings (
  tournament_id       uuid primary key references tournaments (id) on delete cascade,
  match_gap_minutes   integer not null default 15 check (match_gap_minutes >= 0),
  min_rest_minutes    integer not null default 60 check (min_rest_minutes >= 0),
  day_start_time      time    not null default '09:00',
  day_end_time        time    not null default '18:00',
  matches_per_day     integer not null default 6 check (matches_per_day >= 1),
  updated_at          timestamptz not null default now(),

  constraint day_window_valid check (day_end_time > day_start_time)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  groups
-- ─────────────────────────────────────────────────────────────────────────────

create table groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid    not null references tournaments (id) on delete cascade,
  name          text    not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),

  unique (tournament_id, position)
);

create index groups_tournament_idx on groups (tournament_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
--  venues / officials
-- ─────────────────────────────────────────────────────────────────────────────

create table venues (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid    not null references tournaments (id) on delete cascade,
  name          text    not null,
  address       text,
  -- Matches that can run here at the same time (courts, pitches).
  capacity      integer not null default 1 check (capacity >= 1),
  created_at    timestamptz not null default now()
);

create index venues_tournament_idx on venues (tournament_id);

create table officials (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name          text not null,
  role          text not null default 'Referee',
  phone         text,
  created_at    timestamptz not null default now()
);

create index officials_tournament_idx on officials (tournament_id);

-- ─────────────────────────────────────────────────────────────────────────────
--  teams / players / team_players
--
--  For individual sports, players sit directly under the tournament with no
--  team — that is what `team_id is null` means, and it is why the engine only
--  ever deals with the abstract "participant".
-- ─────────────────────────────────────────────────────────────────────────────

create table teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid    not null references tournaments (id) on delete cascade,
  name           text    not null check (length(trim(name)) > 0),
  short_name     text    not null default '',
  logo_url       text,
  color          text    not null default '#64748b',
  coach          text,
  manager        text,
  contact_phone  text,
  contact_email  text,
  seed           integer check (seed >= 1),
  group_id       uuid    references groups (id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Two teams in one tournament cannot share a name; results would be ambiguous.
  unique (tournament_id, name)
);

create index teams_tournament_idx on teams (tournament_id);
create index teams_group_idx      on teams (group_id) where group_id is not null;

create table players (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid    not null references tournaments (id) on delete cascade,
  -- Null for an individual-sport competitor.
  team_id        uuid    references teams (id) on delete cascade,
  name           text    not null check (length(trim(name)) > 0),
  jersey_number  integer check (jersey_number >= 0),
  position       text,
  photo_url      text,
  is_captain     boolean not null default false,
  phone          text,
  email          text,
  seed           integer check (seed >= 1),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index players_tournament_idx on players (tournament_id);
create index players_team_idx       on players (team_id) where team_id is not null;
-- Two players in the same squad must not share a shirt number.
create unique index players_jersey_unique
  on players (team_id, jersey_number)
  where team_id is not null and jersey_number is not null;

-- Explicit join table for squad membership across seasons/tournaments.
-- The denormalized `players.team_id` above is what the app reads; this table is
-- for reporting on a player's history once the same person is reused.
create table team_players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid    not null references teams (id) on delete cascade,
  player_id     uuid    not null references players (id) on delete cascade,
  jersey_number integer check (jersey_number >= 0),
  position      text,
  is_captain    boolean not null default false,
  joined_at     timestamptz not null default now(),

  unique (team_id, player_id)
);

create index team_players_player_idx on team_players (player_id);

-- ─────────────────────────────────────────────────────────────────────────────
--  rounds
-- ─────────────────────────────────────────────────────────────────────────────

create table rounds (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid       not null references tournaments (id) on delete cascade,
  name          text       not null,
  short_name    text       not null default '',
  kind          round_kind not null,
  position      integer    not null,
  match_count   integer    not null default 0,
  created_at    timestamptz not null default now(),

  unique (tournament_id, position)
);

create index rounds_tournament_idx on rounds (tournament_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
--  matches
--
--  A match's participants are either fixed (round one, group games) or fed by
--  another match's winner/loser, or by a group finishing position. Storing the
--  wiring as data is what lets the engine recompute the entire bracket from
--  results, rather than patching it forward and drifting.
-- ─────────────────────────────────────────────────────────────────────────────

create table matches (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid    not null references tournaments (id) on delete cascade,
  round_id          uuid    not null references rounds (id) on delete cascade,
  group_id          uuid    references groups (id) on delete set null,

  -- Human-facing sequential number within the tournament.
  number            integer not null,
  -- Order within the round; drives bracket layout.
  position          integer not null default 0,

  -- Participants: a team id or a player id depending on participant_type.
  home_participant_id uuid,
  away_participant_id uuid,

  -- Slot wiring.
  home_source_kind     slot_source_kind,
  home_source_match_id uuid references matches (id) on delete set null,
  home_source_group_id uuid references groups (id) on delete set null,
  home_source_position integer check (home_source_position >= 1),

  away_source_kind     slot_source_kind,
  away_source_match_id uuid references matches (id) on delete set null,
  away_source_group_id uuid references groups (id) on delete set null,
  away_source_position integer check (away_source_position >= 1),

  -- Where the winner and loser go next.
  winner_to_match_id uuid references matches (id) on delete set null,
  winner_to_slot     match_side,
  loser_to_match_id  uuid references matches (id) on delete set null,
  loser_to_slot      match_side,

  status            match_status not null default 'pending',
  -- Denormalized result, recomputed by the engine on every change.
  outcome           text check (outcome in ('home', 'away', 'draw')),
  walkover_winner   match_side,
  is_bye            boolean not null default false,

  -- Scheduling.
  match_date        date,
  match_time        time,
  venue_id          uuid references venues (id) on delete set null,
  referee_id        uuid references officials (id) on delete set null,
  official_ids      uuid[] not null default '{}',

  notes             text   not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (tournament_id, number),
  -- A match cannot feed itself.
  constraint no_self_feed check (
    (home_source_match_id is null or home_source_match_id <> id) and
    (away_source_match_id is null or away_source_match_id <> id)
  ),
  -- A walkover must name a winner; nothing else may.
  constraint walkover_consistent check (
    (status = 'walkover') = (walkover_winner is not null)
  ),
  -- The two sides must be different participants.
  constraint sides_differ check (
    home_participant_id is null
    or away_participant_id is null
    or home_participant_id <> away_participant_id
  )
);

create index matches_tournament_idx on matches (tournament_id, number);
create index matches_round_idx      on matches (round_id, position);
create index matches_group_idx      on matches (group_id) where group_id is not null;
create index matches_schedule_idx   on matches (tournament_id, match_date, match_time);
create index matches_status_idx     on matches (tournament_id, status);
create index matches_home_idx       on matches (home_participant_id) where home_participant_id is not null;
create index matches_away_idx       on matches (away_participant_id) where away_participant_id is not null;
create index matches_venue_slot_idx on matches (venue_id, match_date, match_time) where venue_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
--  match_scores
--
--  One row per side. Kept out of `matches` so a set-based sport can store its
--  per-set breakdown without a jsonb blob, and so cricket's runs/wickets/overs
--  are queryable columns rather than nested keys.
-- ─────────────────────────────────────────────────────────────────────────────

create table match_scores (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid       not null references matches (id) on delete cascade,
  side          match_side not null,

  -- Primary figure: goals, points, runs, or sets won for set-based sports.
  score         integer    not null default 0 check (score >= 0),
  -- Per-period / per-set values, index-aligned with the other side.
  periods       integer[]  not null default '{}',
  -- Cricket only.
  wickets       integer    check (wickets >= 0),
  overs         numeric(5,1) check (overs >= 0),
  -- Penalties / super over, used when the sport disallows draws.
  decider_score integer    check (decider_score >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (match_id, side)
);

create index match_scores_match_idx on match_scores (match_id);

-- ─────────────────────────────────────────────────────────────────────────────
--  schedules
--
--  Optional named blocks (a "day 1 morning session") that matches can be grouped
--  into. The app schedules matches directly; this exists for organizers who run
--  sessions and want to move a whole block at once.
-- ─────────────────────────────────────────────────────────────────────────────

create table schedules (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid    not null references tournaments (id) on delete cascade,
  name          text    not null,
  session_date  date    not null,
  start_time    time    not null,
  end_time      time,
  venue_id      uuid    references venues (id) on delete set null,
  notes         text    not null default '',
  created_at    timestamptz not null default now(),

  constraint session_window_valid check (end_time is null or end_time > start_time)
);

create index schedules_tournament_idx on schedules (tournament_id, session_date, start_time);

create table schedule_matches (
  schedule_id uuid not null references schedules (id) on delete cascade,
  match_id    uuid not null references matches (id) on delete cascade,
  slot_order  integer not null default 0,

  primary key (schedule_id, match_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  standings
--
--  A materialized snapshot. Standings are always *derived* — the client computes
--  them from results on the fly — but caching them makes the public page cheap
--  and gives historical tables something to point at.
-- ─────────────────────────────────────────────────────────────────────────────

create table standings (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid    not null references tournaments (id) on delete cascade,
  -- Null for a single league-wide table.
  group_id       uuid    references groups (id) on delete cascade,
  participant_id uuid    not null,

  position       integer not null,
  played         integer not null default 0,
  won            integer not null default 0,
  drawn          integer not null default 0,
  lost           integer not null default 0,
  no_result      integer not null default 0,
  score_for      integer not null default 0,
  score_against  integer not null default 0,
  score_diff     integer not null default 0,
  sets_for       integer not null default 0,
  sets_against   integer not null default 0,
  sets_diff      integer not null default 0,
  points         numeric(6,2) not null default 0,
  win_pct        numeric(5,4) not null default 0,
  nrr            numeric(6,3) not null default 0,
  streak         integer not null default 0,
  form           text[]  not null default '{}',
  qualified      boolean not null default false,

  computed_at    timestamptz not null default now(),

  unique (tournament_id, group_id, participant_id)
);

create index standings_lookup_idx on standings (tournament_id, group_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
--  updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_touch          before update on users              for each row execute function touch_updated_at();
create trigger sports_touch         before update on sports             for each row execute function touch_updated_at();
create trigger tournaments_touch    before update on tournaments        for each row execute function touch_updated_at();
create trigger settings_touch       before update on tournament_settings for each row execute function touch_updated_at();
create trigger teams_touch          before update on teams              for each row execute function touch_updated_at();
create trigger players_touch        before update on players            for each row execute function touch_updated_at();
create trigger matches_touch        before update on matches            for each row execute function touch_updated_at();
create trigger match_scores_touch   before update on match_scores       for each row execute function touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
--  Row Level Security
--
--  Owners get full access to their own tournaments. Anyone — signed in or not —
--  can read a tournament flagged `public_visible`, plus everything hanging off
--  it, which is exactly what the public tie-sheet page needs.
-- ─────────────────────────────────────────────────────────────────────────────

alter table users               enable row level security;
alter table sports              enable row level security;
alter table sport_configs       enable row level security;
alter table tournament_formats  enable row level security;
alter table tournaments         enable row level security;
alter table tournament_settings enable row level security;
alter table groups              enable row level security;
alter table venues              enable row level security;
alter table officials           enable row level security;
alter table teams               enable row level security;
alter table players             enable row level security;
alter table team_players        enable row level security;
alter table rounds              enable row level security;
alter table matches             enable row level security;
alter table match_scores        enable row level security;
alter table schedules           enable row level security;
alter table schedule_matches    enable row level security;
alter table standings           enable row level security;

-- Profiles.
create policy users_self_read   on users for select using (auth.uid() = id);
create policy users_self_write  on users for update using (auth.uid() = id);
create policy users_self_insert on users for insert with check (auth.uid() = id);

-- Sport catalogue: readable by all, custom sports writable by their creator.
create policy sports_read on sports for select using (true);
create policy sports_write on sports for all
  using (created_by is not null and created_by = auth.uid())
  with check (created_by = auth.uid());

create policy sport_configs_read on sport_configs for select using (true);
create policy sport_configs_write on sport_configs for all
  using (
    exists (
      select 1 from sports s
      where s.id = sport_configs.sport_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sports s
      where s.id = sport_configs.sport_id
        and s.created_by = auth.uid()
    )
  );

create policy formats_read on tournament_formats for select using (true);

-- Tournaments.
create policy tournaments_owner on tournaments for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy tournaments_public_read on tournaments for select
  using (public_visible);

-- Child tables share one shape: owned by the tournament's owner, readable when
-- the tournament is public. Generated rather than hand-written 16 times.
do $$
declare
  child record;
begin
  for child in
    select unnest(array[
      'tournament_settings', 'groups', 'venues', 'officials',
      'teams', 'players', 'rounds', 'matches', 'schedules', 'standings'
    ]) as table_name
  loop
    execute format($fmt$
      create policy %1$s_owner on %1$s for all
        using (
          exists (
            select 1 from tournaments t
            where t.id = %1$s.tournament_id
              and t.owner_id = auth.uid()
          )
        )
        with check (
          exists (
            select 1 from tournaments t
            where t.id = %1$s.tournament_id
              and t.owner_id = auth.uid()
          )
        );
    $fmt$, child.table_name);

    execute format($fmt$
      create policy %1$s_public_read on %1$s for select
        using (
          exists (
            select 1 from tournaments t
            where t.id = %1$s.tournament_id
              and t.public_visible
          )
        );
    $fmt$, child.table_name);
  end loop;
end;
$$;

-- Tables that reach their tournament indirectly.
create policy match_scores_owner on match_scores for all
  using (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_scores.match_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_scores.match_id and t.owner_id = auth.uid()
    )
  );

create policy match_scores_public_read on match_scores for select
  using (
    exists (
      select 1 from matches m
      join tournaments t on t.id = m.tournament_id
      where m.id = match_scores.match_id and t.public_visible
    )
  );

create policy team_players_owner on team_players for all
  using (
    exists (
      select 1 from teams tm
      join tournaments t on t.id = tm.tournament_id
      where tm.id = team_players.team_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from teams tm
      join tournaments t on t.id = tm.tournament_id
      where tm.id = team_players.team_id and t.owner_id = auth.uid()
    )
  );

create policy team_players_public_read on team_players for select
  using (
    exists (
      select 1 from teams tm
      join tournaments t on t.id = tm.tournament_id
      where tm.id = team_players.team_id and t.public_visible
    )
  );

create policy schedule_matches_owner on schedule_matches for all
  using (
    exists (
      select 1 from schedules s
      join tournaments t on t.id = s.tournament_id
      where s.id = schedule_matches.schedule_id and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from schedules s
      join tournaments t on t.id = s.tournament_id
      where s.id = schedule_matches.schedule_id and t.owner_id = auth.uid()
    )
  );

create policy schedule_matches_public_read on schedule_matches for select
  using (
    exists (
      select 1 from schedules s
      join tournaments t on t.id = s.tournament_id
      where s.id = schedule_matches.schedule_id and t.public_visible
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
--  Convenience views
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per match with both scores flattened — what a fixtures list needs.
create view match_details as
select
  m.id,
  m.tournament_id,
  m.round_id,
  m.group_id,
  m.number,
  m.position,
  m.status,
  m.outcome,
  m.walkover_winner,
  m.is_bye,
  m.match_date,
  m.match_time,
  m.home_participant_id,
  m.away_participant_id,
  hs.score      as home_score,
  hs.periods    as home_periods,
  hs.wickets    as home_wickets,
  hs.overs      as home_overs,
  as_.score     as away_score,
  as_.periods   as away_periods,
  as_.wickets   as away_wickets,
  as_.overs     as away_overs,
  v.name        as venue_name,
  o.name        as referee_name,
  r.name        as round_name,
  r.kind        as round_kind
from matches m
left join match_scores hs  on hs.match_id = m.id  and hs.side = 'home'
left join match_scores as_ on as_.match_id = m.id and as_.side = 'away'
left join venues v         on v.id = m.venue_id
left join officials o      on o.id = m.referee_id
join rounds r              on r.id = m.round_id;

comment on view match_details is 'Flattened match + scores + venue + official, for fixture and result lists.';

-- Tournament headline counts, for the dashboard and the tournament list.
create view tournament_summaries as
select
  t.id                                   as tournament_id,
  t.name,
  t.slug,
  t.status,
  t.public_visible,
  s.name                                 as sport_name,
  t.format_type,
  (select count(*) from teams   where tournament_id = t.id)                     as team_count,
  (select count(*) from players where tournament_id = t.id)                     as player_count,
  (select count(*) from matches where tournament_id = t.id and not is_bye)      as match_count,
  (select count(*) from matches where tournament_id = t.id and not is_bye
     and status in ('completed', 'walkover', 'no_result'))                      as completed_count,
  (select count(*) from matches where tournament_id = t.id and not is_bye
     and status in ('pending', 'scheduled', 'live'))                            as upcoming_count
from tournaments t
join sports s on s.id = t.sport_id;

-- ─────────────────────────────────────────────────────────────────────────────
--  Seed: the built-in format catalogue
--  (Built-in sports are seeded from src/config/sports.ts by the client, so the
--   two never disagree about the rule sets.)
-- ─────────────────────────────────────────────────────────────────────────────

insert into tournament_formats
  (slug, name, tagline, description, icon, config_fields, min_participants, max_participants, has_standings, has_bracket, notes)
values
  (
    'single_elimination', 'Knockout', 'Single elimination',
    'Lose once and you are out. The fastest way to find a winner.',
    '🏆',
    array['thirdPlaceMatch', 'seedProtectionRounds', 'bestOf', 'drawMethod'],
    2, 128, false, true,
    array[
      'Byes are given to the top seeds automatically when the entry count is not a power of two.',
      'Rounds are named for you: Round of 32, Round of 16, Quarter Final, Semi Final, Final.'
    ]
  ),
  (
    'double_elimination', 'Double Elimination', 'Winners & losers brackets',
    'Every entrant gets a second life through the losers bracket.',
    '♻️',
    array['grandFinalReset', 'seedProtectionRounds', 'bestOf', 'drawMethod'],
    4, 64, false, true,
    array['Roughly twice as many matches as a straight knockout — budget the extra time.']
  ),
  (
    'round_robin', 'Round Robin', 'League format',
    'Everyone plays everyone, ranked on a points table.',
    '🔄',
    array['doubleRoundRobin', 'points', 'bestOf'],
    3, 24, true, false,
    array['Match count grows quickly: 8 entrants is 28 matches, 12 is 66.']
  ),
  (
    'group_knockout', 'Groups + Knockout', 'World-Cup style',
    'Groups play a mini league, then the top finishers cross over into a knockout bracket.',
    '🏆',
    array['groupCount', 'advancePerGroup', 'groupDoubleRoundRobin', 'thirdPlaceMatch', 'points', 'bestOf', 'drawMethod'],
    4, 64, true, true,
    array['Group winners are drawn against runners-up from a different group in the first knockout round.']
  )
on conflict (slug) do nothing;
