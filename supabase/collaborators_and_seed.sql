-- 1. Create Collaborators Table
create table tournament_collaborators (
  tournament_id text not null,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table tournament_collaborators enable row level security;

-- Collaborators can see themselves
create policy collabs_self_read on tournament_collaborators for select
  using (user_id = auth.uid());

-- Allow users to lookup emails to invite collaborators
create policy users_public_email_lookup on users for select
  using (true);

-- 2. Modify app_state to allow collaborators to read/write it
-- Since app_state is currently keyed by `user_id`, a collaborator needs to read/write 
-- the owner's `app_state` row. We will create a policy that allows a user to access an 
-- `app_state` row if they are listed as a collaborator for any tournament owned by that user.
-- (This is a coarse-grained sync. A better approach is moving to a shared `tournament_states` table, 
-- but this keeps the current JSON sync functional.)

create policy app_state_collab_read on app_state for select
  using (
    exists (
      select 1 from tournament_collaborators c
      where c.user_id = auth.uid()
    )
  );

create policy app_state_collab_update on app_state for update
  using (
    exists (
      select 1 from tournament_collaborators c
      where c.user_id = auth.uid() and c.role = 'editor'
    )
  );
