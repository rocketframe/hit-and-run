const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/hitandrun/index.html'); await p.waitForTimeout(500);
  await p.click('#startBtn'); await p.waitForTimeout(800);
  await p.evaluate(() => { const h = window.__hr, G = h.G, c = h.cam;
    const us = G.units.filter(v => v.owner === 0 && v.alive);
    c.x = us[5].x + 40; c.y = us[5].y - 60; c.z = 1.3;
    G.crates.push({ id: 50, x: c.x - 90, y: c.y - 120, kind: "medkit", mission: false, land: G.time + 1.5, until: Infinity });
    G.crates.push({ id: 51, x: c.x + 80, y: c.y - 160, kind: "upgrade", mission: true, land: G.time, until: G.time + 44 });
    us.slice(0, 4).forEach(u => u.plague = G.time + 20); us.slice(6, 10).forEach(u => { u.rapid = G.time + 20; u.snipe = G.time + 20; });
    G.strikes.push({ owner: 1, x: c.x - 40, y: c.y + 140, t: 1.2 });
    G.players[0].strikes = 1; window.__hr.UI && 0;
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'crates-vis.png' });
  // general precedence: put general behind a wall of idle soldiers and order him through
  const r = await p.evaluate(() => { const h = window.__hr, G = h.G, g = G.gens[0];
    const inf = G.units.filter(v => v.owner === 0 && v.kind === 'inf' && v.alive);
    inf.forEach((u, i) => { u.x = u.tx = 900 + (i % 10) * 15; u.y = u.ty = 900 + Math.floor(i / 10) * 15; u.plague = 0; });
    g.x = g.tx = 965; g.y = 860; G.cmds.push({ p: 0, ids: [g.id], x: 965, y: 1000, mode: 'move' });
    let t = 0; for (; t < 30 * 8; t++) { h.step(); if (Math.abs(g.y - 1000) < 5) break; }
    return { secs: (t / 30).toFixed(1), gy: g.y.toFixed(0) }; });
  console.log('general through the crowd:', JSON.stringify(r));
  const sp = await p.evaluate(() => { const h = window.__hr, G = h.G;
    const inf = G.units.filter(v => v.owner === 0 && v.kind === 'inf' && v.alive);
    G.cmds.push({ p: 0, t: 'spread', ids: inf.map(u => u.id) }); for (let i = 0; i < 30 * 8; i++) h.step();
    let mn = 1e9; for (const a of inf) for (const b2 of inf) if (a !== b2) mn = Math.min(mn, Math.hypot(a.x - b2.x, a.y - b2.y)); return mn.toFixed(0); });
  console.log('min gap after spread', sp);
  console.log(errs); await b.close();
})();
