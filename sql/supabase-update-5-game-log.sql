-- Hit and Run: anonymous, opt-in game log (one row per finished battle). Paste into SQL Editor > Run (once).
-- No names, no device data. Players who agreed send: difficulty, result, time, armies, kills, losses,
-- level, Basic or Expert controls, and how many times each order was used.
create table if not exists public.game_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  diff smallint not null check (diff between 1 and 4),
  enemies smallint not null check (enemies between 1 and 3),
  army smallint not null check (army between 1 and 100),
  my_army smallint not null check (my_army between 1 and 100),
  win boolean not null,
  secs int not null check (secs between 0 and 36000),
  kills int not null check (kills between 0 and 100000),
  losses int not null check (losses between 0 and 100000),
  level smallint not null check (level between 1 and 999),
  expert boolean not null,
  use jsonb not null default '{}'::jsonb check (pg_column_size(use) < 2000)
);
alter table public.game_log enable row level security;
-- nobody can read or change rows from the game; only the project owner sees them in the dashboard
revoke all on public.game_log from anon, authenticated;

create or replace function public.log_game(
  diff int, enemies int, army int, my_army int, win boolean, secs int,
  kills int, losses int, level int, expert boolean, use jsonb
) returns void
  language sql security definer set search_path = public
  as $$
    insert into game_log (diff, enemies, army, my_army, win, secs, kills, losses, level, expert, use)
    values (diff, enemies, army, my_army, win, secs, kills, losses, level, expert,
            case when jsonb_typeof(use) = 'object' then use else '{}'::jsonb end)
  $$;
revoke all on function public.log_game(int, int, int, int, boolean, int, int, int, int, boolean, jsonb) from public;
grant execute on function public.log_game(int, int, int, int, boolean, int, int, int, int, boolean, jsonb) to anon;

-- handy summary for the dashboard: win rate by difficulty, Basic vs Expert
create or replace view public.game_log_summary as
  select diff, expert, count(*) as games, round(100.0 * avg(win::int), 1) as win_pct,
         round(avg(secs)) as avg_secs, round(avg(kills::numeric / greatest(losses, 1)), 2) as kd
  from game_log group by diff, expert order by diff, expert;
revoke all on public.game_log_summary from anon, authenticated;
