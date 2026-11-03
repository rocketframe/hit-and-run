-- Hit and Run public leaderboard. Paste into Supabase > SQL Editor > Run.
-- The score is computed by the database from the game facts, so nobody can post a made-up score directly.
create table public.scores (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name    text    not null check (name ~ '^[A-Z0-9 .-]{1,10}$'),
  diff    int     not null check (diff between 1 and 4),
  enemies int     not null check (enemies between 1 and 3),
  army    int     not null check (army between 5 and 30),
  secs    int     not null check (secs between 30 and 14400),
  kills   int     not null check (kills between 0 and 5000),
  win     boolean not null,
  score   int generated always as (
    round(
      (kills * 5 + case when win then 1000 + greatest(0, 900 - secs) else 0 end)
      * (case diff when 1 then 1 when 2 then 2 when 3 then 3 else 5 end)
      * (enemies * army / 30.0)
    )::int
  ) stored
);
create index scores_rank on public.scores (score desc, created_at asc);
create index scores_diff_rank on public.scores (diff, score desc, created_at asc);

alter table public.scores enable row level security;
create policy "anyone can read"   on public.scores for select to anon using (true);
create policy "anyone can submit" on public.scores for insert to anon with check (true);
-- No update or delete policies: posted scores can't be changed from the game.
-- To remove a junk entry, delete it yourself in Table Editor.

-- Only needed if the game gets "permission denied" (newer projects may not expose tables automatically):
grant select, insert on public.scores to anon;
grant usage on sequence public.scores_id_seq to anon;
