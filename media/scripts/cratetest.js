const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await p.goto('file:///home/claude/hitandrun/index.html'); await p.waitForTimeout(500);
  await p.click('#startBtn'); await p.waitForTimeout(800);
  // each effect on a fresh crate under one of my soldiers
  const res = await p.evaluate(() => {
    const h = window.__hr, G = h.G, out = {};
    const kinds = ["upgrade", "mercs", "medkit", "rapid", "snipe", "recon", "camo", "strike", "plague", "trap", "jam", "flare", "desert"];
    for (const k of kinds) {
      const u = G.units.find(v => v.owner === 0 && v.kind === "inf" && v.alive);
      const before = { lv: G.players[0].level, n: G.units.filter(v => v.owner === 0 && v.alive).length, foe: G.units.filter(v => v.owner === 1 && v.alive).length, st: G.players[0].strikes };
      G.crates.push({ id: 900 + kinds.indexOf(k), x: u.x, y: u.y, kind: k, mission: false, land: 0, until: Infinity });
      h.step();
      const after = { lv: G.players[0].level, n: G.units.filter(v => v.owner === 0 && v.alive).length, foe: G.units.filter(v => v.owner === 1 && v.alive).length, st: G.players[0].strikes, rapid: u.rapid > G.time, snipe: u.snipe > G.time, camo: u.camo > G.time, jam: u.jam > G.time, flare: u.flare > G.time, plague: !!u.plague, reveal: G.reveal > G.time };
      out[k] = JSON.stringify(before) + ' -> ' + JSON.stringify(after) + ' crates left ' + G.crates.length;
    }
    return out;
  });
  for (const k in res) console.log(k.padEnd(8), res[k]);
  // strike via UI
  await p.evaluate(() => { const h = window.__hr; h.UI.paused = false; });
  await p.waitForTimeout(300);
  console.log('strike btn visible', await p.isVisible('#strikeBtn'));
  await p.click('#strikeBtn'); await p.mouse.click(200, 250); await p.waitForTimeout(200);
  console.log('strikes pending', await p.evaluate(() => [window.__hr.G.strikes.length, window.__hr.G.players[0].strikes]));
  // natural drops + mission + AI hunting (Veteran) over 4 game minutes
  const log = await p.evaluate(() => { const h = window.__hr, G = h.G; let drops = 0, opened = {}, missions = 0;
    const origPush = G.fx.push.bind(G.fx);
    for (let i = 0; i < 30 * 240; i++) { h.step(); for (const e of G.fx) { if (e.k === 'crate') { drops++; if (e.mission) missions++; } if (e.k === 'open') opened[e.owner] = (opened[e.owner] || 0) + 1; } G.fx.length = 0; if (G.over) break; }
    return { drops, missions, opened, time: Math.round(G.time), over: !!G.over, crates: G.crates.length, units: G.units.length };
  });
  console.log('4 min:', JSON.stringify(log));
  await p.screenshot({ path: 'crate-shot.png' });
  console.log('errs', errs); await b.close();
})();
