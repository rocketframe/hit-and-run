const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('file:///home/claude/hitandrun/index.html'); await p.waitForTimeout(500);
  for (const d of [1, 2, 3]) {
    await p.evaluate(d => { window.__hr.UI.opts.diff = d; }, d);
    await p.evaluate(() => window.__hr.start()); await p.waitForTimeout(200);
    const r = await p.evaluate(() => { const h = window.__hr, G = h.G; h.UI.paused = true; let opened = 0, drops = 0;
      for (let i = 0; i < 30 * 360; i++) { h.step(); for (const e of G.fx) { if (e.k === 'open' && e.owner !== 0) opened++; if (e.k === 'crate') drops++; } G.fx.length = 0; if (G.over) break; }
      return { drops, aiOpened: opened, left: G.crates.length }; });
    console.log('diff', d, JSON.stringify(r));
  }
  await b.close();
})();
