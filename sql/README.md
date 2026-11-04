# Leaderboard database (Supabase)

For a fresh Supabase project, paste these into the SQL Editor and run them in order:

1. `supabase-setup.sql` creates the scores table and its rules.
2. `supabase-repair.sql` brings the scores table up to date (army sizes, loss penalty, short games). It's safe to run again.
3. `supabase-update-2-counters.sql` adds the battles and kills totals for the front-page stamp.
4. `supabase-update-5-game-log.sql` adds the anonymous, opt-in game log (one row per finished battle from players who said yes). Read it in the Table Editor (`game_log`) or the `game_log_summary` view.

The numbered `supabase-update-*` files are the history of changes as they were applied. Open the game with `?lbcheck` added to the address to post a TEST score and see the server's answer.
