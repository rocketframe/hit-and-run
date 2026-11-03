const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file:///home/claude/hitandrun/index.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__hr.UI.opts.diff = 3; });
  for (const type of ['cargo', 'escort', 'hold', 'rescue', 'kill', 'sabo']) {
    await p.evaluate(() => window.__hr.start()); await p.waitForTimeout(150);
    const r = await p.evaluate(type => { const h = window.__hr, G = h.G; h.UI.paused = true; G.cratesOn = false;
      // force this mission type
      const keys = Object.keys(window.__hr.MIS ? {} : {}); 
      let tries = 0; do { G.mis = null; G.misLast = null; h.evalIn ? 0 : 0; G.misT = 0; h.step(); tries++; if (G.mis && G.mis.type !== type) { G.mis.until = -1; h.step(); } } while ((!G.mis || G.mis.type !== type) && tries < 200);
      const m = G.mis; if (!m) return 'no mission';
      const mine = G.units.filter(u => u.owner === 0 && u.kind === 'inf' && u.alive);
      const lvl0 = G.players[0].level; let outcome = null, t;
      const sendAll = (x, y, mode = 'attack') => G.cmds.push({ p: 0, ids: mine.filter(u => u.alive).map(u => u.id), x, y, mode });
      for (t = 0; t < 30 * 200 && G.mis; t++) {
        if (t % 30 === 0) {
          if (type === 'cargo' || type === 'hold') sendAll(m.x, m.y);
          if (type === 'escort' || type === 'rescue') { const u = m.unit; if (!u.found && type === 'rescue') sendAll(u.x, u.y); else sendAll(u.x + (G.players[0].base.x - u.x) * 0.15, u.y + (G.players[0].base.y - u.y) * 0.15, 'move'); }
          if (type === 'kill' || type === 'sabo') sendAll(m.unit.x, m.unit.y);
          // keep the army topped up and strong for the test
          for (const u of mine) if (u.alive) u.hp = 9999;
        }
        h.step();
      }
      return type + ': done in ' + Math.round(t / 30) + 's, level ' + lvl0 + '->' + G.players[0].level + ', still active ' + !!G.mis + ', toasts: ' + [...document.querySelectorAll('#toast div')].map(d => d.textContent).slice(-2).join(' | ');
    }, type);
    console.log(r);
  }
  console.log(errs); await b.close();
})();
