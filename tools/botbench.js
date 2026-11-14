// Bot bench: plays whole AI-vs-AI battles headless (no drawing) and reports who wins.
// Every army is an AI on the same difficulty with the same stat boosts, so only the brains differ.
// Brains swap seats from one battle to the next, and every battle uses its own seed, so the result is
// the same each time you run it with the same settings.
//
// Usage (from the repo root, needs Playwright: npm i -D playwright, or a global install):
//   node tools/botbench.js [options] <brain A> <brain B>
// Brains:
//   classic           the AI before personalities (still the Recruit brain)
//   new               a personality picked from the seed, like in a real game
//   rusher | turtle | raider | vulture | schemer    one personality
//   add -noform -noguard -nofocus -noflank to switch one tactic off, e.g. new-noform
// Options:
//   --games N     battles to play (default 40)
//   --players N   armies per battle, 2 to 4 (default 4; brains alternate A B A B round the corners)
//   --diff N      1 Recruit, 2 Veteran, 3 Elite, 4 Invincible (default 3)
//   --map N       0 Plain, 1 Lakes, 2 Marsh, 3 Canyons, 4 Winter, or "mix" (default mix)
//   --army N      soldiers per army (default 30)
//   --crates 0|1  supply crates (default 1)   --missions 0|1 (default 0)   --allies 0|1 (default 0)
//   --mins N      battle length cap in game minutes, longer counts as a draw (default 40)
//   --workers N   battles run side by side (default 3)
//   --seed N      first seed (default 1000)   --file path (default ./index.html)   --json  print raw results too
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2), opt = { games: 40, players: 4, diff: 3, map: 'mix', army: 30, crates: 1, missions: 0, allies: 0, mins: 40, workers: 3, seed: 1000, file: 'index.html', json: false }, brains = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') opt.json = true;
  else if (a.startsWith('--')) { const k = a.slice(2), v = args[++i]; opt[k] = k === 'map' && v === 'mix' ? v : k === 'file' ? v : +v; }
  else brains.push(a);
}
if (brains.length !== 2) { console.log('Give two brains, e.g.: node tools/botbench.js new classic'); process.exit(1); }

const RUN = ([o, seed, seat, map]) => {
      const h = window.__hr; h.UI.paused = true;
      h.initGame(h.newGame(o.players, 100, seed, o.diff, o.army, o.army, map));
      const G = h.G; G.cratesOn = !!o.crates; G.missionsOn = !!o.missions; if (o.allies && o.players >= 3) h.dipInit();
      const D = h.DIFF[o.diff];
      G.players.forEach((p, k) => {
        p.ai = true; p.mult = D.mult; p.respawnMult = D.respawn; p.smart = D.smart; p.thinkEvery = D.think || 1.2; p.autoSpread = true;
        const [name, ...off] = seat[k].split('-');
        p.aiOff = {}; for (const f of off) p.aiOff[f.replace(/^no/, '')] = true;
        if (name === 'classic') p.pers = null;
        else if (name !== 'new') p.pers = h.persByKey(name);
        else if (!p.pers) p.pers = h.persFor(G.seed, k);
      });
      const cap = o.mins * 60 * 30; let t = 0;
      while (!G.over && t < cap) { h.step(); G.fx.length = 0; t++; }
      const alive = G.players.filter(p => !p.out);
      const win = G.over && alive.length === 1 ? alive[0].id : -1;
      return { win, doom: G.over && G.over.doom != null ? 1 : 0, secs: Math.round(G.time), pers: G.players.map(p => p.pers ? p.pers.k : 'classic'), lvl: G.players.map(p => p.level + 1), kills: G.players.map(p => p.kills), losses: G.players.map(p => p.losses) };
    };

(async () => {
  const b = await chromium.launch(), res = new Array(opt.games), t0 = Date.now();
  let next = 0;
  const worker = async () => {
    const pg = await b.newPage({ viewport: { width: 400, height: 400 } });
    pg.on('pageerror', e => console.error('page error:', e.message));
    await pg.goto('file://' + path.resolve(opt.file)); await pg.waitForTimeout(800);
    while (next < opt.games) {
      const i = next++;
      const seat = []; for (let k = 0; k < opt.players; k++) seat.push(brains[(k + i) % 2]);
      const map = opt.map === 'mix' ? i % 5 : opt.map;
      const r = await pg.evaluate(RUN, [opt, opt.seed + i, seat, map]);
      r.seat = seat; r.map = map; res[i] = r;
      process.stdout.write(r.win < 0 ? 'd' : seat[r.win] === brains[0] ? 'A' : 'B');
    }
  };
  await Promise.all(Array.from({ length: opt.workers }, worker));
  await b.close();
  console.log('\n');
  // summary: win share per brain, adjusted for how many seats each brain had
  const by = {}, pers = {};
  for (const r of res) {
    r.seat.forEach((s, k) => { const o = by[s] = by[s] || { seats: 0, wins: 0, kills: 0, losses: 0, lvl: 0 }; o.seats++; o.kills += r.kills[k]; o.losses += r.losses[k]; o.lvl += r.lvl[k]; if (r.win === k) o.wins++;
      const pk = s.split('-')[0] === 'classic' ? 'classic' : r.pers[k]; const q = pers[pk] = pers[pk] || { seats: 0, wins: 0, kills: 0, losses: 0 }; q.seats++; q.kills += r.kills[k]; q.losses += r.losses[k]; if (r.win === k) q.wins++; });
  }
  const draws = res.filter(r => r.win < 0).length, fair = 1 / opt.players;
  console.log(`${opt.games} battles, ${opt.players} armies, difficulty ${opt.diff}, map ${opt.map}, ${opt.army} soldiers, crates ${opt.crates ? 'on' : 'off'}, missions ${opt.missions ? 'on' : 'off'}, alliances ${opt.allies ? 'on' : 'off'}`);
  console.log(`average length ${Math.round(res.reduce((s, r) => s + r.secs, 0) / res.length / 6) / 10} min, draws (time cap) ${draws}, ${Math.round((Date.now() - t0) / 1000)} s to run`);
  console.log(`won by the Endgame weapon ${res.filter(r => r.doom).length} of ${res.length}`);
  console.log('brain          seats  wins  win rate per seat (fair share ' + Math.round(fair * 100) + '%)   kills  K/D   avg final level');
  for (const [k, o] of Object.entries(by)) console.log(`${k.padEnd(14)} ${String(o.seats).padStart(5)} ${String(o.wins).padStart(5)}  ${(Math.round(o.wins / o.seats * 1000) / 10 + '%').padStart(6)}                          ${String(Math.round(o.kills / o.seats)).padStart(5)}  ${(o.kills / Math.max(1, o.losses)).toFixed(2)}   ${(o.lvl / o.seats).toFixed(1)}`);
  if (Object.keys(pers).length > 2) { console.log('\nby personality:'); for (const [k, o] of Object.entries(pers)) console.log(`  ${k.padEnd(10)} ${o.wins}/${o.seats} seats won (${Math.round(o.wins / o.seats * 100)}%), ${Math.round(o.kills / o.seats)} kills, ${Math.round(o.losses / o.seats)} losses`); }
  if (opt.json) console.log(JSON.stringify(res));
})();
