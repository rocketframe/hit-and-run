-- Hit and Run: detailed, anonymous battle stats for later analysis. Paste into SQL Editor > Run (once; safe to run again).
-- Works whether or not supabase-update-5-game-log.sql was run: it creates the game_log table if it's missing.
-- No names, no ids, no IP addresses, no device details beyond "touch screen / small screen / graphics level".
-- Each finished battle (and each battle left half way) adds one row:
--   outcome  win, loss, quit or restart
--   ver      the game version that played it
--   stats    settings, your numbers, every army's numbers, who killed what, hazards, crates, missions,
--            key moments (levels, generals, bases, Endgame) and a snapshot of every army every 30 seconds
--   replay   the battle's orders (gzip + base64): replays the whole battle with that game version

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
alter table public.game_log add column if not exists outcome text check (outcome in ('win', 'loss', 'quit', 'restart'));
alter table public.game_log add column if not exists ver text check (length(ver) <= 16);
alter table public.game_log add column if not exists stats jsonb check (pg_column_size(stats) < 200000);
alter table public.game_log add column if not exists replay text check (length(replay) <= 90000);
alter table public.game_log enable row level security;
-- nobody can read or change rows from the game; only the project owner sees them in the dashboard
revoke all on public.game_log from anon, authenticated;

-- the short version (older copies of the game still send this one)
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

-- the detailed version: one JSON object, checked here
create or replace function public.log_battle(d jsonb) returns void
  language plpgsql security definer set search_path = public
  as $$
  begin
    if jsonb_typeof(d) <> 'object' or pg_column_size(d) > 300000 then raise exception 'bad battle'; end if;
    insert into game_log (diff, enemies, army, my_army, win, secs, kills, losses, level, expert, use, outcome, ver, stats, replay)
    values ((d->>'diff')::int, (d->>'enemies')::int, (d->>'army')::int, (d->>'my_army')::int, (d->>'win')::boolean,
            (d->>'secs')::int, (d->>'kills')::int, (d->>'losses')::int, (d->>'level')::int, (d->>'expert')::boolean,
            case when jsonb_typeof(d->'use') = 'object' then d->'use' else '{}'::jsonb end,
            d->>'outcome', left(d->>'ver', 16),
            case when jsonb_typeof(d->'stats') = 'object' then d->'stats' end,
            case when jsonb_typeof(d->'replay') = 'string' and d->>'replay' ~ '^[A-Za-z0-9+/=]*$' then d->>'replay' end);
  end
  $$;
revoke all on function public.log_battle(jsonb) from public;
grant execute on function public.log_battle(jsonb) to anon;

-- handy summary for the dashboard: win rate by difficulty, plus how often battles are abandoned
drop view if exists public.game_log_summary;
create view public.game_log_summary as
  select diff, enemies, count(*) as games,
         round(100.0 * avg(win::int) filter (where outcome is null or outcome in ('win', 'loss')), 1) as win_pct,
         round(100.0 * avg((outcome in ('quit', 'restart'))::int) filter (where outcome is not null), 1) as quit_pct,
         round(avg(secs)) as avg_secs, round(avg(kills::numeric / greatest(losses, 1)), 2) as kd
  from game_log group by diff, enemies order by diff, enemies;
revoke all on public.game_log_summary from anon, authenticated;

notify pgrst, 'reload schema';
