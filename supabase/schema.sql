-- ============================================================================
-- OPS — Supabase schema
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Table matches the app record shape; ids are the app-generated short strings.
-- ============================================================================

create table if not exists public.opportunities (
  id           text primary key,
  employer     text        not null default '',
  title        text        not null default '',
  location     text        not null default '',
  how_applied  text        not null default '',
  pay          text        not null default '',
  status       text        not null default 'Prepared-not-sent',
  notes        text        not null default '',
  tier         int,
  verdict      text,
  flags        jsonb       not null default '[]',
  fit          text        not null default '',
  date_applied text        not null default '',
  potential_amount   text,
  potential_midpoint bigint,
  probability        int,
  created_at   bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at   timestamptz not null default now()
);

create index if not exists opportunities_created_at_idx on public.opportunities (created_at desc);

-- keep updated_at fresh on writes
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists opportunities_touch on public.opportunities;
create trigger opportunities_touch before update on public.opportunities
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table public.opportunities enable row level security;

-- SINGLE-USER / PRIVATE DEFAULT --------------------------------------------
-- Lets the anon key read & write. Fine for one private operator; the whole
-- table is readable by anyone who has your (public) anon key + project URL.
-- Keep the project's data private and rotate the anon key if leaked.
drop policy if exists "anon full access" on public.opportunities;
create policy "anon full access" on public.opportunities
  for all to anon, authenticated using (true) with check (true);

-- MULTI-USER (COMMODITIZED) --------------------------------------------------
-- When you add Supabase Auth, switch to per-user isolation instead:
--   1) add:   alter table public.opportunities add column user_id uuid
--             references auth.users on delete cascade default auth.uid();
--   2) drop the "anon full access" policy above, then:
--   create policy "own rows" on public.opportunities
--     for all to authenticated
--     using (user_id = auth.uid()) with check (user_id = auth.uid());
-- The frontend then signs users in and the anon-only path is disabled.
