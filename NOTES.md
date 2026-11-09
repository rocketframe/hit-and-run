# Hit and Run: project notes

Key facts that aren't obvious from the code. Last updated 2026-11-09.

## Where things are

- **Live:** https://rocketframe.github.io/hit-and-run/ (GitHub Pages, `main` branch root).
- **Build:** the game is written as a single-file page body; `./build.sh <file>` wraps it into `index.html`. Always rebuild with it.
- **Leaderboard:** Supabase project `lyvibvqhrszwchuyclpf`, free tier. The game only uses the publishable key that is already in `index.html`; no other keys belong in this repo. Database scripts and the fresh-install order are in [`sql/`](sql/README.md).
- **Media and tools:** `media/` (trailer, clips, scripts), `media/scripts/sprites3d/` (3D sprite bake pipeline), `design/` (logo and title sources, model wish list).
- **Ideas backlog:** [IDEAS.md](IDEAS.md).
- Free hosting and services only, no paid tiers.

## Debug URLs

- `?lbcheck` posts a TEST score and shows the server's answer (expect 5 points).
- `?era=1`..`8` forces an era and jumps straight into a slow fight at your base.
- `?tune=1`..`4` pins one music tune; `?music=dark` brings back the older dark drum score; `?musdebug` shows the music intensity.

## Game design in brief

- Fog-of-war battle on a symmetrical island with an ocean shore. Maps: Plain, Lakes, Marsh, Canyons.
- **Eras by level:** L1 Stone, L2 Bronze, L3 Middle Ages, L4 Musket, L5 World Wars, L6 Modern, L7 Future, L8 Space. Level 9 is **ENDGAME**: carry the bomb, always the black hole. After a game the player can explore the revealed map, then taps "Enter score". Play again and Menu stay hidden until a name is submitted.
- **Formations** (Expert only): Box, Line, Wedge; GUARD rings the general for -15% damage. KILL has an "All but the general" option.
- Leaderboard: 10-letter arcade name, country flag guessed from IP (player can change it). T's own entries are NZ.
- 3D tilt view is the only view since v115 (old 2D paths are still behind `TILT.on`).
- Easter eggs: Konami code for 8-bit mode, a bandaged general after 10 deaths, messages in bottles.

## Music

Four synthesized dark orchestral tunes that take turns, approved by T on 2026-11-08 (keep future changes close to them): **Last stand**, **Banners in the fog**, **Iron crown**, **The long night**. Calm when there's no fighting, more intense as the battle grows, steady tempo.

## Licences

- The repo has no licence: all rights reserved.
- **The game must stay free and non-commercial.** The Musket-era star fort (Santa Luzia Fort by GSXNet) is CC-BY-NC.
- The other 3D models are CC0, CC-BY or the Sketchfab Standard licence; credits are on the in-game About page and must be kept up to date when models change. Mixamo characters need no credit.
- Avoid models based on others' IP (for example Nintendo or Star Wars assets were skipped).

## Open reminders for T

- Run `sql/supabase-update-5-game-log.sql` in the Supabase SQL Editor, or the game log won't save.
- Send the About page text (placeholder now: "Made for fun in just hours.").
- Send your own lines for the 6 message-in-a-bottle notes.
- Set up the custom domain.

## Large files kept outside the repo

GLB models, Mixamo zips, the source videos and music previews are kept in the Claude project files, not here, because they are large and the repo is public.
