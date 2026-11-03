// Runs inside the game page (rec copy with an eval hook). Defines staging + per-frame driver.
(() => {
  const h = window.__hr, E = h.evalIn;
  E('frame = function(){}');           // stop the game's own loop; we drive frames
  E('trackQuality = function(){}');
  E('Q.level = 2; resize()');
  const env = E('({ CFG2: CFG, step, updateFog, render, issue, maxHp, CFG, cam, UI, G: () => G, setAttract: v => { G.attract = v }, start })');
  const T = window.T = {};
  let G;
  T.fresh = (players, seed) => {
    h.UI.opts.players = players; h.UI.opts.diff = 3; h.UI.opts.army = 30;
    const realNow = Date.now; Date.now = () => seed; h.start(); Date.now = realNow;
    G = env.G(); h.UI.paused = true;
    for (const p of G.players) p.ai = false;
    for (const u of G.units) { u.alive = false; u.respawn = Infinity; }
    G.fx.length = 0; G.tracers.length = 0; env.UI.sel.clear();
    E('parts.length = 0');
  };
  T.spot = (minClear, nearX, nearY) => {
    let best = null, bd = 1e18;
    for (let y = 300; y < G.S - 300; y += 40) for (let x = 300; x < G.S - 300; x += 40) {
      const clear = Math.min(...G.rocks.map(r => Math.hypot(r.x - x, r.y - y) - r.r));
      if (clear < minClear) continue;
      if (G.players.some(p => Math.hypot(p.base.x - x, p.base.y - y) < 500)) continue;
      const d = Math.hypot(x - nearX, y - nearY); if (d < bd) { bd = d; best = { x, y }; }
    }
    if (!best && minClear > 100) return T.spot(minClear * 0.85, nearX, nearY);
    return best;
  };
  // place n infantry of owner in a block centred on (cx,cy) facing angle a
  T.place = (owner, n, cx, cy, a, squad = 0, sp = 19) => {
    const list = G.units.filter(u => u.owner === owner && u.kind === "inf" && !u.alive).slice(0, n);
    const cols = Math.ceil(Math.sqrt(n * 1.6)), fx = Math.cos(a), fy = Math.sin(a);
    list.forEach((u, i) => {
      const c = i % cols - (cols - 1) / 2, r = Math.floor(i / cols);
      u.x = cx - fx * r * sp + -fy * c * sp; u.y = cy - fy * r * sp + fx * c * sp;
      u.tx = u.x; u.ty = u.y; u.alive = true; u.hp = env.maxHp(u); u.face = a; u.mode = "attack"; u.squad = squad;
      u.respawn = Infinity; u.seen = u.tgt = null; u.cd = Math.random() * 0.8; u.idleT = 0; u.hitAt = -99;
    });
    return list;
  };
  T.gen = (owner, x, y, a) => { const g = G.gens[owner]; g.x = x; g.y = y; g.tx = x; g.ty = y; g.alive = true; g.hp = env.maxHp(g); g.face = a; g.mode = "move"; g.respawn = Infinity; g.hitAt = -99; return g; };
  T.order = (owner, list, x, y, mode, ping) => {
    env.issue({ p: owner, ids: list.map(u => u.id), x, y, mode });
    if (ping) { env.UI.pings.push({ x, y, t: 0.7, mode }); T.pinged = (T.pinged || 0) + 1; }
  };
  T.G = () => G;
  T.setGenCd = v => { env.CFG2.gen.cd = v; };
  T.cam = env.cam;
  // one video frame: `steps` sim ticks (0 = freeze, fractional handled by caller), particle time scale
  T.frame = (steps, pdt) => {
    const ev = { shots: 0, gshots: 0, turret: 0, deaths: 0, gdeaths: 0, booms: 0, pings: 0 };
    for (let i = 0; i < steps; i++) {
      env.step();
      for (const t of G.tracers) if (t.fresh && !t.logged) { t.logged = true; if (t.w > 2.3) ev.turret++; else if (t.w > 2) ev.gshots++; else ev.shots++; }
      for (const e of G.fx) if (!e.logged) { e.logged = true; if (e.k === 'death') { if (e.big) ev.gdeaths++; else ev.deaths++; } else if (e.k === 'boom') ev.booms++; }
    }
    const pn = env.UI.pings.length;
    for (const pg of env.UI.pings) pg.t -= pdt;
    env.UI.pings = env.UI.pings.filter(p => p.t > 0);
    env.updateFog(); env.render(pdt);
    return ev;
  };
  T.attract = v => env.setAttract(v);
  T.centroid = list => { const a = list.filter(u => u.alive); if (!a.length) return null; return { x: a.reduce((s, u) => s + u.x, 0) / a.length, y: a.reduce((s, u) => s + u.y, 0) / a.length }; };
  T.allAI = () => { for (const p of G.players) { p.ai = true; p.smart = true; } };
})();
