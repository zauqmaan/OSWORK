-- Personal Work OS: run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.records (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.records enable row level security;
drop policy if exists "own records: read" on public.records;
drop policy if exists "own records: insert" on public.records;
drop policy if exists "own records: update" on public.records;
drop policy if exists "own records: delete" on public.records;
create policy "own records: read"   on public.records for select to authenticated using (user_id = auth.uid());
create policy "own records: insert" on public.records for insert to authenticated with check (user_id = auth.uid());
create policy "own records: update" on public.records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own records: delete" on public.records for delete to authenticated using (user_id = auth.uid());
alter table public.records replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;
