-- Hit and Run: a loss keeps only a quarter of its score. Paste into SQL Editor > Run (once, after update 1).
alter table public.scores drop column score;
alter table public.scores add column score int generated always as (
  round(
    (kills * 5 + case when win then 1000 + greatest(0, 900 - secs) else 0 end)
    * (case diff when 1 then 1 when 2 then 2 when 3 then 3 else 5 end)
    * (enemies * army / my_army::numeric)
    * (case when win then 1 else 0.25 end)
  )::int
) stored;
create index if not exists scores_rank on public.scores (score desc, created_at asc);
create index if not exists scores_diff_rank on public.scores (diff, score desc, created_at asc);
