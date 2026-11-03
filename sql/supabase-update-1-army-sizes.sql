-- Hit and Run: support army sizes 1-100 for both sides. Paste into Supabase > SQL Editor > Run (once).
alter table public.scores add column if not exists my_army int not null default 30 check (my_army between 1 and 100);
alter table public.scores drop constraint if exists scores_army_check;
alter table public.scores add constraint scores_army_check check (army between 1 and 100);
alter table public.scores drop constraint if exists scores_kills_check;
alter table public.scores add constraint scores_kills_check check (kills between 0 and 50000);
-- score now uses your army size: odds = enemies x their army / your army (30 vs 30 scores the same as before)
alter table public.scores drop column score;
alter table public.scores add column score int generated always as (
  round(
    (kills * 5 + case when win then 1000 + greatest(0, 900 - secs) else 0 end)
    * (case diff when 1 then 1 when 2 then 2 when 3 then 3 else 5 end)
    * (enemies * army / my_army::numeric)
  )::int
) stored;
create index if not exists scores_rank on public.scores (score desc, created_at asc);
create index if not exists scores_diff_rank on public.scores (diff, score desc, created_at asc);
