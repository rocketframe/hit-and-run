-- Hit and Run: a country flag on the leaderboard. Paste into SQL Editor > Run (once).
-- The game guesses the country from the player's IP (or browser language) and the player can change it or hide it.
alter table public.scores add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');
-- every score posted so far was played from New Zealand
update public.scores set country = 'NZ' where country is null;
