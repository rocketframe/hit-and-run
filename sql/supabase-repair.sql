-- Hit and Run: one-shot repair. Safe to run more than once. Paste into SQL Editor > Run.
alter table public.scores add column if not exists my_army int not null default 30;
alter table public.scores drop constraint if exists scores_my_army_check;
alter table public.scores add constraint scores_my_army_check check (my_army between 1 and 100);
alter table public.scores drop constraint if exists scores_army_check;
alter table public.scores add constraint scores_army_check check (army between 1 and 100);
alter table public.scores drop constraint if exists scores_kills_check;
alter table public.scores add constraint scores_kills_check check (kills between 0 and 50000);
alter table public.scores drop constraint if exists scores_secs_check;
alter table public.scores add constraint scores_secs_check check (secs between 1 and 86400);
alter table public.scores drop column if exists score;
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
grant select, insert on public.scores to anon;
notify pgrst, 'reload schema';
-- the result below should list my_army and score
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'scores' order by ordinal_position;
