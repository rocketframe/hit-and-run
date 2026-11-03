# Media

- `hit-and-run-trailer.mp4`: 27-second movie-style trailer with a synthesized score
- `hit-and-run-clip-v2.mp4` / `hit-and-run-clip.mp4`: gameplay clips
- `music-calm-to-battle.mp3`: in-game music going from calm to battle

`scripts/` holds the tools used to make them: `trailer-page.js` and `trailer.js` stage and film the trailer with Playwright, `score.py` composes its music and effects with numpy from the event log `tlog.json`, and `bench.js` runs AI-vs-AI balance tests. These are working scripts, kept for reference.
