-- Hit and Run: allow very short games (under 30 seconds) on the leaderboard. Paste into SQL Editor > Run (once).
alter table public.scores drop constraint if exists scores_secs_check;
alter table public.scores add constraint scores_secs_check check (secs between 1 and 86400);
