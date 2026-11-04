// Tool bench: a scripted player bot plays Blue against the game's AI, with and without each expert tool.
// Same seeds for every variant, so the only difference is the tool. Usage:
//   node toolbench.js <games per variant> <diff 1-4> [variants comma list] [game file]
const { chromium } = require('playwright');
const N = +(process.argv[2] || 20), DIFF = +(process.argv[3] || 2);
const ALLV = ['basic', 'army', 'engage', 'guard', 'rally', 'wedge', 'line', 'regroup'];
const VARS = (process.argv[4] || ALLV.join(',')).split(',');
const FILE = process.argv[5] || '/home/claude/hitandrun/index.html';
const SEED0 = 1000;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 400, height: 400 } });
  pg.on('pageerror', e => console.error('ERR', e.message));
  await pg.goto('file://' + FILE); await pg.waitForTimeout(500);
  const res = {};
  for (const v of VARS) res[v] = [];
  for (let i = 0; i < N; i++) for (const v of VARS) {
    const r = await pg.evaluate(([seed, diff, v]) => {
      const h = window.__hr, { newGame, initGame, d2, CFG, maxHp } = h; h.UI.paused = true;
      initGame(newGame(2, 100, seed, diff, 30, 30));
      const G = h.G; G.cratesOn = true; G.missionsOn = false; G.players[0].ai = false; G.players[0].autoSpread = true;
      const cfg = { army: v === 'army', engage: v === 'engage', guard: v === 'guard', rally: v === 'rally', form: v === 'wedge' ? 'wedge' : v === 'line' ? 'line' : 'box', regroup: v === 'regroup' };
      const me = G.players[0], foeBase = () => { let bb = null, bd = 1e18; for (const q of G.players) if (q.id !== 0 && !q.out && q.base.alive !== false) { const dd = d2(q.base, me.base); if (dd < bd) { bd = dd; bb = q.base; } } return bb; };
      let lastT = null, lastIssue = -99, guardIds = [], genLast = -99, tick = 0, genDeaths = 0, genWasAlive = true;
      const cen = a => { let x = 0, y = 0; for (const u of a) { x += u.x; y += u.y; } return { x: x / a.length, y: y / a.length }; };
      const think = () => {
        const mine = G.units.filter(u => u.alive && u.owner === 0), g = G.gens[0];
        if (genWasAlive && !g.alive) genDeaths++; genWasAlive = g.alive;
        let inf = mine.filter(u => u.kind === 'inf'); if (!inf.length) return;
        if (cfg.guard && g.alive) { guardIds = guardIds.filter(id => { const u = G.unitById.get(id); return u && u.alive && u.escort; });
          if (guardIds.length < 4) { const pick = inf.filter(u => !u.escort).sort((a, b2) => d2(a, g) - d2(b2, g)).slice(0, 6 - guardIds.length); if (pick.length) { G.cmds.push({ p: 0, t: 'escort', ids: pick.map(u => u.id) }); guardIds.push(...pick.map(u => u.id)); } } }
        const army = inf.filter(u => !u.escort); if (!army.length) return;
        const c = cen(army);
        const foes = G.units.filter(w => w.alive && w.owner !== 0 && !w.mis && mine.some(u => d2(u, w) < CFG[u.kind].sight * CFG[u.kind].sight));
        let tgt = null;
        if (foes.length) { let bf = null, bd = 1e18; for (const w of foes) { const dd = d2(w, c); if (dd < bd) { bd = dd; bf = w; } } if (bd < 700 * 700) tgt = { x: bf.x, y: bf.y }; }
        if (!tgt) { let bc = null, bd = 450 * 450; for (const cr of G.crates) if (cr.land <= G.time) { const dd = d2(cr, c); if (dd < bd) { bd = dd; bc = cr; } } if (bc) tgt = { x: bc.x, y: bc.y }; }
        if (!tgt) { const fb = foeBase(); if (fb) tgt = { x: fb.x, y: fb.y }; }
        if (!tgt) return;
        const mode = cfg.engage && foes.length ? 'attack' : 'move';
        const genHurt = g.alive && g.hp < maxHp(g) * 0.5;
        const withGen = !cfg.army && !cfg.guard && g.alive && !genHurt;
        if (!lastT || Math.hypot(tgt.x - lastT.x, tgt.y - lastT.y) > 120 || G.time - lastIssue > 4) {
          const ids = army.map(u => u.id); if (withGen) ids.push(g.id);
          G.cmds.push({ p: 0, ids, x: tgt.x, y: tgt.y, mode, form: cfg.form }); lastT = tgt; lastIssue = G.time;
        }
        if (g.alive && G.time - genLast > 3) { genLast = G.time;
          if (genHurt) G.cmds.push({ p: 0, ids: [g.id], x: me.base.x, y: me.base.y, mode: 'move' });
          else if (cfg.army || cfg.guard) { const dx = me.base.x - c.x, dy = me.base.y - c.y, l = Math.hypot(dx, dy) || 1; G.cmds.push({ p: 0, ids: [g.id], x: c.x + dx / l * 180, y: c.y + dy / l * 180, mode: 'move' }); }
        }
        if (cfg.rally && tick % 10 === 0) { const far = d2(c, me.base) > 500 * 500; if (far && !foes.some(w => d2(w, c) < 400 * 400)) G.cmds.push({ p: 0, t: 'rally', x: c.x, y: c.y }); else if (!far) G.cmds.push({ p: 0, t: 'rally', clear: true }); }
        if (cfg.regroup && tick % 20 === 0) G.cmds.push({ p: 0, t: 'regroup', ids: army.map(u => u.id), form: cfg.form });
        if (me.strikes > 0 && foes.length >= 4) { const q = cen(foes); G.cmds.push({ p: 0, t: 'strike', x: q.x, y: q.y }); }
      };
      const maxT = 30 * 60 * 20; let t = 0;
      while (!G.over && t < maxT) { if (t % 30 === 0) { think(); tick++; } h.step(); G.fx.length = 0; t++; }
      return { win: G.over ? (G.over.win ? 1 : 0) : 0, timeout: G.over ? 0 : 1, secs: Math.round(G.time), kills: me.kills, losses: me.losses, lvl: me.level + 1, genDeaths };
    }, [SEED0 + i, DIFF, v]);
    res[v].push(r);
  }
  const sum = {};
  for (const v of VARS) { const a = res[v], n = a.length, w = a.reduce((s, r) => s + r.win, 0), p = w / n, se = Math.sqrt(p * (1 - p) / n);
    const wins = a.filter(r => r.win); const avg = k => (a.reduce((s, r) => s + r[k], 0) / n);
    sum[v] = { games: n, winRate: +(p * 100).toFixed(1), ci95: +(1.96 * se * 100).toFixed(1), timeouts: a.reduce((s, r) => s + r.timeout, 0), avgWinSecs: wins.length ? Math.round(wins.reduce((s, r) => s + r.secs, 0) / wins.length) : null, kd: +(avg('kills') / Math.max(1, avg('losses'))).toFixed(2), genDeaths: +avg('genDeaths').toFixed(2) };
  }
  console.log(JSON.stringify({ diff: DIFF, perVariant: N, sum }, null, 1));
  await b.close();
})();
