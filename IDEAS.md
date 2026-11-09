# Hit and Run: ideas for later

Things to explore later, not built yet. Copied from the "ideas for later" doc on 2026-11-09; keep both in step, or treat this file as the master from now on.

## Factions with special skills

Each army picks a faction with one or two strengths.

| Faction | Special skill |
|---|---|
| Artillery | Long-range guns that shell an area |
| Mobile HQ | The headquarters can move |
| Wizard | Magic powers (to be designed) |
| Engineer | Builds barricades, traps and bunkers |
| Medic | Field medics heal soldiers, and the base repairs itself |

## Maps

Every map is an island with an ocean shore around it. Each island is symmetrical so every army has the same odds, and none is rectangular or round. **Built:** the island shore, and the map picker Plain / Lakes / Marsh / Canyons.

Still to do, one terrain feature per map, picked in Custom game:

- **Cliffs:** soldiers fall off and die when they walk or get pushed over the edge.
- **Water:** rivers or lakes where a share of the soldiers drown while crossing.
- **Quicksand:** soldiers slow down and can sink.

Keeping the learning curve flat:

- Plain stays the default, so new players never meet a feature they didn't choose.
- Each feature is obvious on sight (a cliff edge, blue water, a sand patch), and the first time you see one a single tip explains it.
- Soldiers path around danger by themselves, so a feature only hurts when you send them straight through it.

## Natural disasters

One on/off switch in Settings, off by default. They can happen on any map. Most of the game is calm, then something hits without much notice, with a short warning and an edge arrow.

- **Volcano:** an eruption that rains fire on one area.
- **Flood:** the sea rises from one or all sides of the island and pushes armies inland.
- **Wild beasts:** a pack appears and attacks whoever is nearest.
- **Locusts:** a swarm that sweeps across the island and harms everything in its path.
- **Earthquake:** opens small rifts that block or split paths.
- **Tornado:** moves across the map and throws soldiers around.

## Medieval unit types

| Unit | Role |
|---|---|
| Archers | Arrows at range |
| Swordsmen | Close combat |
| Catapult | Slow siege weapon against bases and groups |

## Multiplayer

T said "not yet" (2026-11-03). If it starts: split the single file into modules, work on a separate branch with a `/mp/` test URL, and do 1v1 first. The sim is already deterministic with a command queue, so lockstep online play is possible.

- **Teams / alliances:** allied armies that share vision and don't shoot each other, such as 2v2.

## Other

- **Saboteur** (a crate or a power): sneaks into an enemy base and stops its soldier regeneration for 20 seconds.
- **Seasons:** one per map (spring, summer, autumn, winter look and feel), or changing during play, for example snow slowing soldiers, mud in autumn, bare trees giving less cover.
- **Watching after elimination:** Exit should lead to the score screen, not the main menu.
- **Player report** from the game log after about 400 games, to see which expert tools real players use and whether they win more. Needs `sql/supabase-update-5-game-log.sql` run first.
- **Stronger test bot** to re-check the expert tools where the first results were too close to call (formations, GUARD, RALLY), then decide whether Line formation and REGROUP stay.
- **More diagnostics:** richer anonymous game data for an AI to analyse when shaping future games: a timeline of each battle (levels, losses, crates, missions, where fights happened), frame rate and loading times by device type, how players control the game (keyboard, mouse, taps, long presses, swipes, pinch zoom, which buttons), device and screen size, and where players hesitate or quit. Still no names and no IP address.
- **Custom domain** for the live site (T owns a domain).

Done since the list was written: several rotating music tunes (v122-125).
