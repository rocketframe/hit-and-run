// ======================================================================
// TUTORIAL: a guided practice battle; each step waits until you actually do it
// ======================================================================
const TUT = (() => {
  let on = false, i = 0, timer = null, base0 = null, flags = {}, doneT = 0;
  const w2s = (x, y) => ({ x: (x - cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + H / 2 });
  const red = () => G.players[1];
  const myAlive = () => G.units.filter(u => u.owner === G.human && u.alive);
  const front = d => { const b = G.players[G.human].base, f = G.players[G.human].fwd; return { x: b.x + f.x * d, y: b.y + f.y * d }; };
  function spawnRed(n, x, y, hp) {
    const list = G.units.filter(u => u.owner === 1 && u.kind === "inf" && !u.alive).slice(0, n);
    list.forEach((u, k) => {
      const a = k / Math.max(1, n) * Math.PI * 2;
      u.x = u.tx = x + Math.cos(a) * 22 * (n > 1); u.y = u.ty = y + Math.sin(a) * 22 * (n > 1);
      u.alive = true; u.hp = hp; u.respawn = Infinity; u.mode = "move"; u.seen = u.tgt = null; u.cd = 1.5;
    });
    return list;
  }
  let scouts = [], lone = null;
  const S = [
    { t: "Welcome, commander", b: "This is your base. Your soldiers are split into squads A, B and C, and the star is your general. Let's learn the controls.", next: true, at: () => G.players[G.human].base },
    { t: "Look around", b: "Drag anywhere on the map to move the camera.", hand: "drag", enter() { base0 = { x: cam.x, y: cam.y }; }, ok: () => Math.hypot(cam.x - base0.x, cam.y - base0.y) > 140 },
    { t: "Zoom", b: "Pinch with two fingers, or use the mouse wheel, to zoom in or out.", hand: "pinch", enter() { base0 = cam.z; }, ok: () => Math.abs(cam.z - base0) > 0.12 },
    { t: "Back to base", b: "Lost? Tap BASE to jump back home.", el: "#homeBtn", hand: "tap", ok: () => flags.home },
    { t: "Pick a squad", b: "Tap A to select squad A. Selected soldiers get a ring.", el: '[data-sel="0"]', hand: "tap", ok: () => UI.selKey === "0" },
    { t: "Give an order", b: "Now tap open ground where you want them to go. A tap on the same squad button twice finds them on the map.", hand: "tap", at: () => front(330), enter() { base0 = UI.orderN || 0; }, ok: () => (UI.orderN || 0) > base0 },
    { t: "Whole army", b: "Tap ALL to select everyone, general included.", el: '[data-sel="all"]', hand: "tap", ok: () => UI.selKey === "all" },
    { t: "Two kinds of orders", b: "RUN & GUN moves to the spot and shoots on the way. ENGAGE stops to chase and fight anything it sees. Tap it to switch to ENGAGE.", el: "#modeBtn", hand: "tap", ok: () => UI.mode === "attack" },
    { t: "Enemy scouts!", b: "Red soldiers ahead. With your army selected, tap right on them to attack.", hand: "tap",
      enter() { const p = front(520); scouts = spawnRed(4, p.x, p.y, 14); },
      at: () => { const a = scouts.filter(u => u.alive); return a.length ? { x: a.reduce((s, u) => s + u.x, 0) / a.length, y: a.reduce((s, u) => s + u.y, 0) / a.length } : null; },
      ok: () => scouts.every(u => !u.alive) },
    { t: "Your general", b: "Tap GEN. The general sees and shoots much further, has ten times the health, and soldiers near him hit 30% harder. Keep him alive.", el: '[data-sel="gen"]', hand: "tap", ok: () => UI.selKey === "gen" },
    { t: "Sniper shot", b: "A lone enemy is hiding further out. Send your general toward it. He'll hit it from far away.", hand: "tap",
      enter() { const g = G.gens[G.human], f = G.players[G.human].fwd, p = { x: clamp(g.x + f.x * 480 - f.y * 160, 60, G.S - 60), y: clamp(g.y + f.y * 480 + f.x * 160, 60, G.S - 60) }; [lone] = spawnRed(1, p.x, p.y, 12); },
      at: () => lone && lone.alive ? lone : null, ok: () => lone && !lone.alive },
    { t: "Pick exactly who you want", b: "Tap SELECT, then drag a box around a few soldiers. In select mode you can also tap soldiers one by one.", el: "#boxBtn", hand: "tap", ok: () => UI.selKey === null && UI.sel.size >= 2 },
    { t: "Save a group", b: "Hold D for a moment to save the selection as group D. Tap D later to grab them again.", el: '[data-sel="3"]', hand: "hold", ok: () => G.units.some(u => u.owner === G.human && u.squad === 3) },
    { t: "Find the slackers", b: "Tap IDLE to pick everyone who's standing around with nothing to do.", el: '[data-sel="idle"]', hand: "tap", ok: () => UI.selKey === "idle" },
    { t: "Last resort", b: "If a squad is trapped and about to die, tap KILL twice to remove it yourself. The enemy gets no points, and they respawn at base. Pick group D, then try it.", el: "#killBtn", hand: "tap",
      enter() { base0 = G.units.filter(u => u.owner === G.human && !u.alive).length; }, ok: () => G.units.filter(u => u.owner === G.human && !u.alive).length > base0 },
    { t: "The minimap", b: "Tap or drag on the minimap to jump anywhere. Your fog of war clears wherever your soldiers can see.", el: "#mini", hand: "tap", ok: () => flags.mini },
    { t: "Your mission", b: "Find and destroy every enemy base. Each kill is a point, and every upgrade makes your whole army tougher and deadlier. Bigger, tougher enemies score more on the leaderboard. Good luck!", next: true, last: true }
  ];
  const $t = id => document.getElementById(id);
  function show() {
    const s = S[i];
    $t("tutN").textContent = (i + 1) + " / " + S.length;
    $t("tutT").textContent = s.t; $t("tutB").textContent = s.b;
    $t("tutNext").hidden = !s.next; $t("tutNext").textContent = s.last ? "Finish" : "Next";
    $t("tutStep").hidden = !!s.next; $t("tutMore").hidden = !s.last;
    $t("tutCard").classList.remove("done");
    if (s.enter) s.enter();
    doneT = 0;
  }
  function advance() { if (i < S.length - 1) { i++; show(); } else finish(false); }
  function place() {
    const s = S[i], ring = $t("tutRing"), hand = $t("tutHand");
    let r = null;
    if (s.el) { const e = document.querySelector(s.el); if (e) { const b = e.getBoundingClientRect(); r = { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width + 12, h: b.height + 12 }; } }
    else if (s.at) { const p = s.at(); if (p) { const q = w2s(p.x, p.y); r = { x: q.x, y: q.y, w: 64, h: 64 }; } }
    else if (s.hand) r = { x: W / 2, y: H * 0.42, w: 0, h: 0 };
    ring.hidden = !r || !r.w; hand.hidden = !r || !s.hand || doneT;
    if (r) {
      ring.style.cssText = `left:${r.x - r.w / 2}px;top:${r.y - r.h / 2}px;width:${r.w}px;height:${r.h}px`;
      hand.style.left = r.x + "px"; hand.style.top = r.y + "px"; hand.className = "tut-hand " + s.hand;
    }
  }
  function loop() {
    if (!on || !G || !G.tutorial) return stop();
    const s = S[i];
    if (!doneT && s.ok && s.ok()) { doneT = 1; $t("tutCard").classList.add("done"); SND.ui(); setTimeout(() => { if (on) advance(); }, 900); }
    place();
  }
  function start() {
    document.body.classList.remove("attract");
    initGame(newGame(2, 100, 20251103, 1, 8, 12));
    G.tutorial = true;
    const R = red(); R.ai = false;
    for (const u of G.units) if (u.owner === 1) { u.alive = false; u.respawn = Infinity; }
    const b = G.players[G.human].base, p = G.players[G.human];
    cam.z = Math.min(W, H) < 600 ? 0.9 : 1.05;
    cam.x = b.x + p.fwd.x * 160; cam.y = b.y + p.fwd.y * 160; clampCam();
    UI.mode = "move"; UI.pings = []; UI.boxMode = false; UI.sel.clear(); UI.selKey = null; refreshBar();
    ["menu", "over", "pause", "howto"].forEach(id => $(id).hidden = true);
    $("toast").innerHTML = "";
    UI.paused = false; acc = 0; last = performance.now(); SND.reset();
    updateFog();
    on = true; i = 0; flags = {}; $t("tut").hidden = false; show();
    clearInterval(timer); timer = setInterval(loop, 60);
  }
  function stop() { on = false; clearInterval(timer); $t("tut").hidden = true; }
  function finish(keepPlaying) {
    try { localStorage.setItem("hr-tut", "1"); } catch (e) {}
    stop();
    if (keepPlaying) {
      const R = red(); R.ai = true;
      for (const u of G.units) if (u.owner === 1 && !u.alive) u.respawn = 2 + Math.random() * 6;
      toast("Practice battle: take their base!", "gold");
    } else toMenu();
  }
  $t("tutNext").addEventListener("click", () => { SND.ui(); if (S[i].last) finish(false); else advance(); });
  $t("tutStep").addEventListener("click", () => { SND.ui(); advance(); });
  $t("tutSkip").addEventListener("click", () => finish(false));
  $t("tutMore").addEventListener("click", () => finish(true));
  $("homeBtn").addEventListener("click", () => { flags.home = true; });
  $("mini").addEventListener("pointerdown", () => { flags.mini = true; });
  return { start, stop, get on() { return on; } };
})();
