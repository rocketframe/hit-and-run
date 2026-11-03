const { chromium } = require('playwright'); const fs = require('fs');
const SP = process.env.SP, OUT = SP + '/tframes';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
global.window = global;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 540, height: 675 }, deviceScaleFactor: 2 });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('file:///home/claude/hitandrun/rec.html'); await pg.waitForTimeout(2500);
  await pg.addStyleTag({ content: `
    .hud,#toast{display:none!important}
    .bar{position:fixed;left:0;right:0;height:9%;background:#000;z-index:30}
    #lbT{top:0} #lbB{bottom:0}
    #cap{position:fixed;inset:0;z-index:25;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;pointer-events:none}
    #cap .t{font-family:'Saira Condensed',sans-serif;font-weight:800;text-transform:uppercase;color:#f1ecd6;letter-spacing:.02em;line-height:.9;text-shadow:0 4px 30px rgba(0,0,0,.9),0 0 2px #000}
    #cap .t span{color:#e2c46e}
    #cap .s{font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.22em;color:#e2c46e;text-transform:uppercase;margin-top:14px;text-shadow:0 2px 10px #000}
    #flash{position:fixed;inset:0;z-index:28;pointer-events:none}
    #grade{position:fixed;inset:0;z-index:24;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 45%,rgba(0,0,0,.45) 100%);mix-blend-mode:multiply}` });
  await pg.evaluate(() => {
    for (const [id, cls] of [['lbT', 'bar'], ['lbB', 'bar'], ['cap', ''], ['flash', ''], ['grade', '']]) { const d = document.createElement('div'); d.id = id; if (cls) d.className = cls; document.body.appendChild(d); }
    document.getElementById('menu').hidden = true;
  });
  await pg.addScriptTag({ path: SP + '/trailer-page.js' });

  let n = 0; const LOG = []; const cues = [];
  const cue = (k) => cues.push({ f: n, k });
  const shot = () => pg.screenshot({ path: `${OUT}/${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
  // overlay state per frame
  const ov = (o) => pg.evaluate(o => {
    const cap = document.getElementById('cap'), fl = document.getElementById('flash');
    if (o.html !== undefined && cap.dataset.h !== o.html) { cap.innerHTML = o.html; cap.dataset.h = o.html; }
    cap.style.opacity = o.cap ?? 0; cap.style.transform = `scale(${o.scale ?? 1})`;
    fl.style.background = o.flashC || '#fff'; fl.style.opacity = o.flash || 0;
  }, o);
  const F = async (steps, pdt, cam, o) => {
    const ev = await pg.evaluate(([steps, pdt, cam]) => { const c = T.cam; c.x = cam.x; c.y = cam.y; c.z = cam.z; const e = T.frame(steps, pdt); e.pings = T.pinged || 0; T.pinged = 0; return e; }, [steps, pdt, cam]);
    ev.f = n; ev.slow = steps === 1 ? (pdt < 1 / 31 ? 1 : 0) : (pdt < 1 / 31 ? 1 : 0); ev.z = cam.z; LOG.push(ev);
    await ov(o || {}); await shot();
  };
  const big = (txt, size = 76) => `<div class="t" style="font-size:${size}px">${txt}</div>`;
  const get = fn => pg.evaluate(fn);

  cue('start');
  // ============ SHOT 1: march through the fog, close on the general ============
  const P = await get(() => { T.fresh(2, 777); const G = T.G(); const p = T.spot(300, G.S / 2 - 300, G.S / 2 + 200);
    window.S1 = { P: p, blue: T.place(0, 14, p.x, p.y, 0, 0), gen: T.gen(0, p.x - 75, p.y, 0) };
    T.order(0, S1.blue, p.x + 420, p.y, 'move'); T.order(0, [S1.gen], p.x + 340, p.y, 'move'); return p; });
  for (let f = 0; f < 80; f++) {
    const g = await get(() => ({ x: S1.gen.x, y: S1.gen.y })), c = await get(() => T.centroid(S1.blue));
    const t = ease(f / 80);
    await F(1, 1 / 30, { x: lerp(g.x, c.x, t), y: lerp(g.y, c.y, t), z: lerp(3.6, 2.3, t) },
      { html: big("They can't<br>see <span>you.</span>", 70), cap: f < 8 ? 0 : f < 16 ? (f - 8) / 8 : f > 68 ? Math.max(0, (78 - f) / 10) : 1, scale: 1 + f * 0.0015, flash: f < 10 ? 1 - f / 10 : 0, flashC: '#000' });
  }
  cue('braam');
  // ============ SHOT 2: contact, zoom punch, slow motion ============
  await get(() => { const p = S1.P; S1.red = T.place(1, 14, p.x + 560, p.y + 10, Math.PI, 0); T.order(1, S1.red, p.x + 100, p.y, 'attack'); T.order(0, S1.blue, p.x + 420, p.y, 'attack'); });
  let contact = -1, f2 = 0, camS = null;
  while (f2 < 160) {
    const st = await get(() => { const G = T.G(); const all = S1.blue.concat(S1.red); const c = T.centroid(all);
      const tr = G.tracers; let x = 0, y = 0; for (const t of tr) { x += t.x2; y += t.y2; } return { c, n: tr.length, tx: tr.length ? x / tr.length : c.x, ty: tr.length ? y / tr.length : c.y }; });
    if (contact < 0 && st.n > 2) { contact = f2; cue('punch'); }
    let steps = 1, pdt = 1 / 30, cam, o = {};
    if (contact < 0) {
      cam = { x: st.c.x, y: st.c.y, z: lerp(2.0, 1.7, Math.min(1, f2 / 40)) };
      o = { html: big("You can't<br>see <span>them.</span>", 70), cap: f2 < 6 ? f2 / 6 : f2 > 44 ? Math.max(0, (54 - f2) / 10) : 1 };
    } else {
      const k = f2 - contact;
      if (!camS) camS = { x: st.tx, y: st.ty };
      camS.x = lerp(camS.x, st.tx, 0.12); camS.y = lerp(camS.y, st.ty, 0.12);
      const slow = k > 6 && k < 70;
      steps = slow ? (k % 3 === 0 ? 1 : 0) : 1; pdt = slow ? 1 / 90 : 1 / 30;
      cam = { x: camS.x, y: camS.y, z: k < 8 ? lerp(1.7, 3.0, ease(k / 8)) : k < 70 ? 3.0 + (k - 8) * 0.004 : lerp(3.25, 2.0, ease((k - 70) / 30)) };
      o = { html: big("Hit.", 150), cap: k < 8 ? 0 : k < 12 ? 1 : k > 60 ? Math.max(0, (70 - k) / 10) : 1, scale: k < 12 ? 1.25 - (k - 8) * 0.06 : 1, flash: k < 4 ? (4 - k) / 4 * 0.8 : 0 };
      if (k > 100) break;
    }
    await F(steps, pdt, cam, o); f2++;
  }
  cue('cut');
  // ============ SHOT 3: pincer, run & gun ============
  const Q = await get(() => { T.fresh(2, 778); const G = T.G(); const q = T.spot(340, G.S / 2 + 100, G.S / 2 - 100);
    window.S3 = { Q: q, red: T.place(1, 16, q.x, q.y, Math.PI, 0, 18),
      A: T.place(0, 9, q.x - 330, q.y - 160, 0, 0), B: T.place(0, 9, q.x - 330, q.y + 160, 0, 1), gen: T.gen(0, q.x - 420, q.y, 0) };
    for (const u of S3.red) u.mode = 'move';
    return q; });
  for (let f = 0; f < 130; f++) {
    if (f === 4) await get(() => { const q = S3.Q; T.order(0, S3.A, q.x + 20, q.y - 175, 'move', true); T.order(0, S3.B, q.x + 20, q.y + 175, 'move', true); T.order(0, [S3.gen], q.x - 250, q.y, 'move', true); });
    if (f === 60) cue('braam');
    if (f === 70) await get(() => { const q = S3.Q; T.order(0, S3.A, q.x + 360, q.y - 120, 'move', true); T.order(0, S3.B, q.x + 360, q.y + 120, 'move', true); });
    const t = ease(f / 130);
    const c3 = await get(() => { const a = T.centroid(S3.A.concat(S3.B)) || S3.Q; return { x: (a.x + S3.Q.x) / 2, y: (a.y + S3.Q.y) / 2 }; });
    if (!window.c3s) window.c3s = c3; c3s.x = lerp(c3s.x, c3.x, 0.15); c3s.y = lerp(c3s.y, c3.y, 0.15);
    await F(f < 45 ? 2 : 1, 1 / 30, { x: c3s.x, y: c3s.y, z: lerp(1.25, 1.75, t) },
      { html: big("And <span>run.</span>", 110), cap: f > 60 && f < 110 ? Math.min(1, (f - 60) / 6, (110 - f) / 8) : 0, flash: f < 3 ? 1 - f / 3 : 0, flashC: '#000' });
  }
  function S3cx(q, t) { return q.x - 200 + t * 220; }
  cue('cut');
  // ============ SHOT 4: the general snipes from the fog ============
  const R = await get(() => { T.fresh(2, 779); const G = T.G(); const r = T.spot(330, G.S / 2, G.S / 2);
    window.S4 = { R: r, gen: T.gen(0, r.x - 110, r.y, 0), red: T.place(1, 4, r.x + 118, r.y - 60, Math.PI / 2, 0, 24) };
    for (const u of S4.red) { u.mode = 'move'; u.hp = 15; }
    S4.gen.cd = 0.2; T.setGenCd(0.42);
    T.order(1, S4.red, r.x + 125, r.y + 120, 'move'); return r; });
  for (let f = 0; f < 90; f++) {
    const t = ease((f - 20) / 30);
    const slow = f > 25;
    await F(slow ? (f % 2 ? 1 : 0) : 1, slow ? 1 / 60 : 1 / 30,
      { x: lerp(R.x - 60, R.x + 40, t), y: lerp(R.y + 40, R.y + 70, t), z: lerp(2.5, 2.2, t) },
      { html: '<div style="transform:translateY(-205px)">' + big("Strike from the <span>fog.</span>", 46) + '<div class="s">Your general sees further</div></div>', cap: f > 8 && f < 82 ? Math.min(1, (f - 8) / 6, (82 - f) / 8) : 0, flash: f < 3 ? 1 - f / 3 : 0, flashC: '#000' });
  }
  await get(() => T.setGenCd(1.1));
  cue('cut');
  // ============ SHOT 5: storm the fort ============
  const Bp = await get(() => { T.fresh(2, 780); const G = T.G(); const bb = G.players[1].base;
    const dx = G.S / 2 - bb.x, dy = G.S / 2 - bb.y, l = Math.hypot(dx, dy), a = Math.atan2(-dy, -dx);
    window.S5 = { b: bb, blue: T.place(0, 26, bb.x + dx / l * 250, bb.y + dy / l * 250, a, 0, 17), gen: T.gen(0, bb.x + dx / l * 360, bb.y + dy / l * 360, a),
      red: T.place(1, 3, bb.x + dx / l * 80, bb.y + dy / l * 80, a + Math.PI, 0) };
    bb.hp = 420; T.order(0, S5.blue, bb.x, bb.y, 'attack', true); T.order(0, [S5.gen], bb.x + dx / l * 250, bb.y + dy / l * 250, 'attack');
    return { x: bb.x, y: bb.y, mx: bb.x + dx / l * 160, my: bb.y + dy / l * 160 }; });
  let boom = -1;
  for (let f = 0; f < 240; f++) {
    const out = await get(() => T.G().players[1].out);
    if (out && boom < 0) { boom = f; cue('bigboom'); }
    let steps = 1, pdt = 1 / 30, cam, o;
    if (boom < 0) {
      const t = ease(f / 90);
      cam = { x: lerp(Bp.mx, Bp.x, t * 0.6), y: lerp(Bp.my, Bp.y, t * 0.6), z: lerp(1.3, 1.9, t) };
      o = { html: big("Take their<br><span>base.</span>", 80), cap: f > 6 && f < 70 ? Math.min(1, (f - 6) / 6, (70 - f) / 8) : 0, flash: f < 3 ? 1 - f / 3 : 0, flashC: '#000' };
    } else {
      const k = f - boom; if (k > 55) break;
      const slow = k < 40; steps = slow ? (k % 4 === 0 ? 1 : 0) : 1; pdt = slow ? 1 / 120 : 1 / 30;
      cam = { x: Bp.x, y: Bp.y, z: k < 6 ? lerp(1.9, 2.4, ease(k / 6)) : lerp(2.4, 1.6, ease((k - 6) / 49)) };
      o = { flash: k < 5 ? (5 - k) / 5 : 0, flashC: '#fff3d6' };
    }
    await F(steps, pdt, cam, o);
  }
  cue('cut');
  // ============ SHOT 6: four armies, pull back to the whole map ============
  const M = await get(() => { T.fresh(4, 4242); const G = T.G(); E2(); return { S: G.S };
    function E2() {} });
  await get(() => { window.__hr.UI.opts.players = 4; const G0 = T.G(); });
  const st6 = await get(() => {
    const h = window.__hr; h.UI.opts.players = 4; const realNow = Date.now; Date.now = () => 9191; h.start(); Date.now = realNow; h.UI.paused = true;
    T.refresh && T.refresh();
    const G = h.G; for (const p of G.players) { p.ai = true; p.smart = true; }
    for (let i = 0; i < 30 * 50; i++) h.step();
    G.fx.length = 0; T.attract(true);
    let x = 0, y = 0, n = 0; for (const t of G.tracers) { x += t.x2; y += t.y2; n++; }
    return { S: G.S, x: n ? x / n : G.S / 2, y: n ? y / n : G.S / 2 }; });
  for (let f = 0; f < 80; f++) {
    const t = ease(f / 70), zf = 540 / st6.S * 0.98;
    await F(1, 1 / 30, { x: lerp(st6.x, st6.S / 2, t), y: lerp(st6.y, st6.S / 2, t), z: lerp(1.7, zf, t) },
      { html: big("Four armies.<br>One map.", 66), cap: f > 30 ? Math.min(1, (f - 30) / 8) : 0, flash: f < 3 ? 1 - f / 3 : 0, flashC: '#000' });
  }
  cue('end');
  // ============ END CARD ============
  for (let f = 0; f < 100; f++) {
    await F(1, 1 / 30, { x: st6.S / 2, y: st6.S / 2, z: 540 / st6.S * 0.98 + f * 0.0004 },
      { html: '<div class="s" style="margin:0 0 12px">Free in your browser · phone or PC</div>' + big("Hit<br>and <span>run</span>", 120) + '<div class="s">Link in the post</div>',
        cap: Math.min(1, f / 8), scale: 1.08 - Math.min(1, f / 20) * 0.08, flash: Math.min(0.72, f / 12 * 0.72), flashC: '#050605' });
  }
  fs.writeFileSync(SP + '/tlog.json', JSON.stringify({ frames: n, log: LOG, cues }));
  console.log('frames', n, 'cues', JSON.stringify(cues));
  await b.close();
})();
