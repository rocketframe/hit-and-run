-- Hit and Run: live totals on the front page (battles fought, enemies killed). Paste into SQL Editor > Run (once).
create table if not exists public.counters (
  id int primary key default 1 check (id = 1),
  games bigint not null default 0,
  kills bigint not null default 0
);
-- start from what the leaderboard already knows
insert into public.counters (id, games, kills)
  select 1, count(*), coalesce(sum(kills), 0) from public.scores
  on conflict (id) do nothing;
alter table public.counters enable row level security;
drop policy if exists "anyone can read counters" on public.counters;
create policy "anyone can read counters" on public.counters for select to anon using (true);
grant select on public.counters to anon;

-- the game can only add to the totals through these two functions, in small steps
create or replace function public.game_started() returns void
  language sql security definer set search_path = public
  as $$ update counters set games = games + 1 where id = 1 $$;
create or replace function public.add_kills(n int) returns void
  language sql security definer set search_path = public
  as $$ update counters set kills = kills + least(greatest(n, 0), 2000) where id = 1 $$;
revoke all on function public.game_started() from public;
revoke all on function public.add_kills(int) from public;
grant execute on function public.game_started() to anon;
grant execute on function public.add_kills(int) to anon;
