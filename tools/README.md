# Tools

## Bot bench (`botbench.js`)

Plays whole AI-vs-AI battles headless and reports which brain wins. Every army is an AI on the same difficulty with the same stat boosts, so only the brains differ. The two brains swap seats from one battle to the next and every battle has its own seed, so a run with the same settings always gives the same result.

```sh
node tools/botbench.js new classic                    # 40 four-army battles on Elite, mixed maps
node tools/botbench.js --players 2 --games 60 raider classic
node tools/botbench.js new new-noform                 # does the AI win more with formations?
```

Brains:

| Brain | What it is |
|---|---|
| `classic` | The AI before personalities. Recruit still uses it. |
| `new` | A personality dealt from the seed, as in a real battle |
| `rusher`, `turtle`, `raider`, `vulture`, `schemer` | One personality only |
| `…-noform`, `-noguard`, `-nofocus`, `-noflank`, `-noraid` | The same brain with one tactic switched off |

Options: `--games`, `--players` (2 to 4), `--diff` (1 to 4), `--map` (0 to 4 or `mix`), `--army`, `--crates`, `--missions`, `--allies`, `--mins` (time cap, a longer battle is a draw), `--seed`, `--workers`, `--json`.

It needs Playwright with Chromium. It loads `index.html` from the repo with `file://`, so a "tainted canvas" page error at the start is expected and harmless.
