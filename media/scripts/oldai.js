function aiThink(p) {
  const A = p.aiState, b = p.base, me = p.id;
  const inf = G.units.filter(u => u.owner === me && u.kind === "inf" && u.alive);
  const gen = G.gens[me];
  if (!A.target || !A.target.alive) {
    let best = null, bd = 1e18;
    for (const q of G.players) if (q.id !== me && !q.out) { const dd = d2(b, q.base); if (dd < bd) { bd = dd; best = q.base; } }
    A.target = best;
  }
  if (!A.target) return;
  const rally = { x: b.x + p.fwd.x * 300, y: b.y + p.fwd.y * 300 };
  const order = (list, x, y, mode) => { if (list.length) issue({ p: me, ids: list.map(u => u.id), x, y, mode }); };

  // defend if enemies near base
  let threat = null, tdist = 520 * 520;
  for (const v of G.units) if (v.alive && v.owner !== me) { const dd = d2(v, b); if (dd < tdist) { tdist = dd; threat = v; } }
  const home = inf.filter(u => d2(u, b) < 460 * 460);
  const away = inf.filter(u => d2(u, b) >= 460 * 460);
  let center = null;
  if (away.length) { center = { x: 0, y: 0 }; for (const u of away) { center.x += u.x; center.y += u.y; } center.x /= away.length; center.y /= away.length; }

  if (threat) {
    const defenders = inf.filter(u => d2(u, b) < 1000 * 1000);
    order(defenders, threat.x, threat.y, "attack");
    if (A.state === "push" && away.length < A.threshold * 0.5) A.state = "gather";
  } else if (A.state === "gather") {
    order(inf, rally.x, rally.y, "attack");
    const atRally = inf.filter(u => d2(u, rally) < 230 * 230).length;
    if (atRally >= A.threshold) A.state = "push";
  } else {
    if (away.length < A.threshold * 0.4 && home.length < A.threshold * 0.5) {
      A.state = "gather"; order(inf, rally.x, rally.y, "attack");
    } else {
      // main force pushes, stragglers catch up in groups of 6
      const t = A.target;
      const pushers = away.length ? away : home;
      // occasionally swing wide to flank
      if (!A.flank || G.rng() < 0.02) A.flank = (G.rng() - 0.5) * 500;
      const mid = center || rally;
      const dx = t.x - mid.x, dy = t.y - mid.y, dl = Math.hypot(dx, dy) || 1;
      const stepLen = Math.min(dl, 420), fl = dl > 700 ? A.flank : 0;
      const wx = mid.x + dx / dl * stepLen + (-dy / dl) * fl, wy = mid.y + dy / dl * stepLen + (dx / dl) * fl;
      order(pushers, clamp(wx, 30, G.S - 30), clamp(wy, 30, G.S - 30), "attack");
      if (away.length && home.length >= 6) order(home, mid.x, mid.y, "attack");
      else if (away.length) order(home, rally.x, rally.y, "attack");
    }
  }
  // general: stay behind the army, snipe, retreat when hurt
  if (gen && gen.alive) {
    if (gen.hp < maxHp(gen) * 0.3) order([gen], b.x + p.fwd.x * 70, b.y + p.fwd.y * 70, "move");
    else {
      const anchor = center || rally;
      const bx = b.x - anchor.x, by = b.y - anchor.y, bl = Math.hypot(bx, by) || 1;
      order([gen], anchor.x + bx / bl * 110, anchor.y + by / bl * 110, "attack");
    }
  }
}
