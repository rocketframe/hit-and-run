// strength estimate: level and difficulty scale both health and damage, so power grows with their square
function power(list) {
  let s = 0;
  for (const u of list) { const q = G.players[u.owner]; const f = (1 + CFG.upStep * q.level) * q.mult; s += (u.kind === "gen" ? 5 : 1) * f * f; }
  return s;
}
function centroid(list) { let x = 0, y = 0; for (const u of list) { x += u.x; y += u.y; } return { x: x / list.length, y: y / list.length }; }

function aiThink(p) {
  const A = p.aiState, b = p.base, me = p.id;
  const inf = G.units.filter(u => u.owner === me && u.kind === "inf" && u.alive);
  const gen = G.gens[me];
  const order = (list, x, y, mode) => { if (list.length) issue({ p: me, ids: list.map(u => u.id), x: clamp(x, 30, G.S - 30), y: clamp(y, 30, G.S - 30), mode }); };
  const rally = { x: b.x + p.fwd.x * 300, y: b.y + p.fwd.y * 300 };

  // target the strongest player (most points), nudged by distance: everyone hunts the leader
  if (!A.retarget || G.time > A.retarget || !A.target || !A.target.alive) {
    let best = null, bs = -1e18;
    for (const q of G.players) if (q.id !== me && !q.out) {
      const sc = q.points * (p.smart ? 1 : 0) - Math.sqrt(d2(b, q.base)) / 25;
      if (sc > bs) { bs = sc; best = q.base; }
    }
    A.target = best; A.retarget = G.time + 20;
  }
  if (!A.target) return;

  // what my army can see
  const known = new Set();
  for (const u of G.units) if (u.alive && u.owner === me && u.seen && !u.seen.isBase) known.add(u.seen);
  for (const v of G.units) if (v.alive && v.owner !== me && d2(v, b) < 520 * 520) known.add(v);
  const knownArr = [...known];

  const home = inf.filter(u => d2(u, b) < 460 * 460);
  const away = inf.filter(u => d2(u, b) >= 460 * 460);
  const center = away.length ? centroid(away) : null;

  // ---- base defence ----
  const threats = knownArr.filter(v => d2(v, b) < 520 * 520);
  if (threats.length) {
    const tc = centroid(threats);
    const defenders = inf.filter(u => d2(u, b) < 900 * 900);
    order(defenders, tc.x, tc.y, "attack");
    // recall the field army if the base is in real danger
    if (p.smart && power(threats) > power(defenders) * 0.8 + 3) { order(away, tc.x, tc.y, "attack"); A.state = "gather"; }
    else if (A.state === "push" && away.length < A.threshold * 0.5) A.state = "gather";
  }

  if (!threats.length || !p.smart) {
    if (A.state === "gather") {
      const far = inf.filter(u => d2(u, rally) > 150 * 150);
      order(far, rally.x, rally.y, "attack");
      const atRally = inf.filter(u => d2(u, rally) < 230 * 230).length;
      const genReady = !p.smart || (gen && gen.alive && gen.hp > maxHp(gen) * 0.6);
      if (atRally >= A.threshold && genReady) A.state = "push";
    } else if (A.state === "retreat") {
      order(away, rally.x, rally.y, "move");
      if (!away.length || power(away.filter(u => d2(u, rally) > 260 * 260)) < 2) A.state = "gather";
    } else {
      const army = away.length ? away : home;
      const mid = center || centroid(army);
      const myPow = power(army) + (gen && gen.alive && d2(gen, mid) < 400 * 400 ? power([gen]) : 0);
      const local = knownArr.filter(v => d2(v, mid) < 420 * 420);
      const enemyPow = power(local);
      if (army.length < A.threshold * 0.35) { A.state = "retreat"; }
      else if (p.smart && local.length && enemyPow > myPow * 1.2) {
        // outgunned: fall back shooting, regroup
        A.state = "retreat"; order(army, rally.x, rally.y, "move");
      } else if (local.length) {
        // engage: converge on the enemy group, so everyone fires together
        const ec = centroid(local);
        order(army, ec.x, ec.y, "attack");
      } else {
        const t = A.target, dx = t.x - mid.x, dy = t.y - mid.y, dl = Math.hypot(dx, dy) || 1;
        if (p.smart && dl < 650) {
          // near the enemy base: only storm it when clearly stronger than what defends it
          const defPow = power(knownArr.filter(v => d2(v, t) < 500 * 500)) + 8;
          if (myPow > defPow * 1.3 || G.time > (A.siegeUntil || 1e9)) { order(army, t.x, t.y, "attack"); A.siegeUntil = null; }
          else {
            if (!A.siegeUntil) A.siegeUntil = G.time + 25;
            // hold just outside turret range and pick off what comes out
            const hx = t.x - dx / dl * 420, hy = t.y - dy / dl * 420;
            order(army, hx, hy, "attack");
          }
        } else {
          if (!A.flank || G.rng() < 0.03) A.flank = (G.rng() - 0.5) * 600;
          const stepLen = Math.min(dl, 380), fl = dl > 700 ? A.flank : 0;
          order(army, mid.x + dx / dl * stepLen + (-dy / dl) * fl, mid.y + dy / dl * stepLen + (dx / dl) * fl, "attack");
        }
      }
      // reinforcements join in groups instead of trickling in one by one
      if (away.length && home.length >= (p.smart ? 6 : 1)) order(home, mid.x, mid.y, "attack");
      else if (away.length) order(home, rally.x, rally.y, "attack");
    }
  }

  // ---- general: stay behind the army inside aura range and snipe ----
  if (gen && gen.alive) {
    if (gen.hp < maxHp(gen) * 0.35) order([gen], b.x + p.fwd.x * 70, b.y + p.fwd.y * 70, "move");
    else {
      const anchor = center || rally;
      let ax = b.x - anchor.x, ay = b.y - anchor.y; const al = Math.hypot(ax, ay) || 1;
      const back = p.smart ? 120 : 110;
      order([gen], anchor.x + ax / al * back, anchor.y + ay / al * back, p.smart ? "move" : "attack");
    }
  }
}
