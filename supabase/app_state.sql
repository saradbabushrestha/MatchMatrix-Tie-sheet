create table if not exists app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table app_state enable row level security;

create policy "Users can read own state" 
  on app_state for select 
  using (auth.uid() = user_id);

create policy "Users can insert own state" 
  on app_state for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own state" 
  on app_state for update 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);
