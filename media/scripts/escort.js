const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file:///home/claude/hitandrun/index.html'); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__hr.UI.opts.diff = +process_diff; }).catch(() => {});
  for (const d of [2, 3]) {
  await p.evaluate(d => { window.__hr.UI.opts.diff = d; window.__hr.start(); }, d); await p.waitForTimeout(150);
  const r = await p.evaluate(() => { const h = window.__hr, G = h.G; h.UI.paused = true; G.cratesOn = false;
    let tries = 0; do { G.mis = null; G.misLast = null; G.misT = 0; h.step(); tries++; if (G.mis && G.mis.type !== 'escort') { G.mis.until = -1; h.step(); } } while ((!G.mis || G.mis.type !== 'escort') && tries < 200);
    const m = G.mis, u = m.unit, home = G.players[0].base, mine = G.units.filter(v => v.owner === 0 && v.kind === 'inf' && v.alive), log = [];
    for (let t = 0; t < 30 * 160 && G.mis; t++) {
      if (t % 30 === 0) { G.cmds.push({ p: 0, ids: mine.filter(v => v.alive).map(v => v.id), x: u.x + (home.x - u.x) * 0.1, y: u.y + (home.y - u.y) * 0.1, mode: 'attack' }); }
      if (t % 300 === 0) log.push(Math.round(t / 30) + 's d=' + Math.round(Math.sqrt((u.x - home.x) ** 2 + (u.y - home.y) ** 2)) + ' hp=' + Math.round(u.hp));
      h.step();
    }
    return log.join(' | ') + ' -> ' + (G.mis ? 'active' : 'ended') + ' ' + [...document.querySelectorAll('#toast div')].map(d => d.textContent).slice(-1); });
  console.log('diff', d, r); }
  await b.close();
})();
