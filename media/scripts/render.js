// ======================================================================
// RENDERING
// Everything heavy (terrain, rocks, sprites, clouds) is drawn once into offscreen canvases.
// Per frame we only blit sprites, a few hundred particles and one fog layer.
// ======================================================================
const cvs = document.getElementById("game"), ctx = cvs.getContext("2d");
const mini = document.getElementById("mini"), mctx = mini.getContext("2d");
let W = 0, H = 0, DPR = 1;
const cam = { x: 0, y: 0, z: 1 };
// quality: 2 = full, 1 = reduced, 0 = minimal. Drops automatically if frames get slow.
const Q = { level: 2, ema: 16, slowT: 0, fastT: 0 };
const QP = [
  { dpr: 1, parts: 140, clouds: false, shadows: false, decals: true },
  { dpr: 1.5, parts: 320, clouds: true, shadows: false, decals: true },
  { dpr: 2, parts: 700, clouds: true, shadows: true, decals: true }
];
let groundCvs = null, decalCvs = null, decalCtx = null, GK = 0.75;
let fogCvs = null, fogCtx = null, fogImg = null, fogLayer = null, fogLayerCtx = null;
let cloudCvs = null, vignetteCvs = null, miniGround = null;
const shake = { a: 0 };
let parts = [];
const SPR = {};

function resize() {
  DPR = Math.min(QP[Q.level].dpr, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  cvs.style.width = W + "px"; cvs.style.height = H + "px";
  fogLayer = fogLayer || document.createElement("canvas");
  fogLayer.width = Math.ceil(W / 2); fogLayer.height = Math.ceil(H / 2);
  fogLayerCtx = fogLayer.getContext("2d");
  // vignette + warm grade, drawn once per size
  vignetteCvs = document.createElement("canvas"); vignetteCvs.width = Math.ceil(W / 2); vignetteCvs.height = Math.ceil(H / 2);
  const v = vignetteCvs.getContext("2d"), cw = vignetteCvs.width, ch = vignetteCvs.height;
  const g = v.createRadialGradient(cw / 2, ch * 0.45, Math.min(cw, ch) * 0.25, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.7, "rgba(4,6,8,.28)"); g.addColorStop(1, "rgba(2,3,4,.72)");
  v.fillStyle = g; v.fillRect(0, 0, cw, ch);
}
window.addEventListener("resize", resize); resize();

// ---------- noise ----------
function makeNoise(seed, period) {
  const r = mulberry32(seed), vals = new Float32Array(256), perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { vals[i] = r(); perm[i] = i; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  const P = period || 256;
  const h = (a, b) => vals[perm[(perm[((a % P) + P) % P & 255] + (((b % P) + P) % P)) & 255]];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * a; t += a; a *= 0.5; f *= 2; } return s / t; }

// ---------- sprites ----------
function sprite(size, draw, sc = 3) {
  const c = document.createElement("canvas"); c.width = c.height = Math.ceil(size * sc);
  const g = c.getContext("2d"); g.scale(sc, sc); g.translate(size / 2, size / 2); draw(g); c.size = size; return c;
}
function whiteOf(src) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.size = src.size;
  const g = c.getContext("2d"); g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(255,250,235,.9)"; g.fillRect(0, 0, c.width, c.height); return c;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function buildSprites() {
  if (SPR.done) return; SPR.done = true;
  // soft round shadow
  SPR.shadow = sprite(40, g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 18); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 18, 0, 7); g.fill(); }, 1);
  // additive glow
  SPR.glow = sprite(64, g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.25, "rgba(255,190,90,.55)"); gr.addColorStop(1, "rgba(255,120,40,0)"); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); }, 1);
  SPR.smoke = sprite(64, g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32); gr.addColorStop(0, "rgba(70,72,68,.75)"); gr.addColorStop(0.6, "rgba(55,58,55,.35)"); gr.addColorStop(1, "rgba(40,42,40,0)"); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); }, 1);
  SPR.scorch = sprite(64, g => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32); gr.addColorStop(0, "rgba(14,10,6,.75)"); gr.addColorStop(0.5, "rgba(24,18,10,.4)"); gr.addColorStop(1, "rgba(30,24,14,0)"); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); }, 1);
  SPR.team = TEAM.map(T => {
    const inf = sprite(28, g => {
      // backpack
      g.fillStyle = "#2f3324"; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 0.8;
      g.beginPath(); g.roundRect(-8.5, -4.2, 5, 8.4, 1.6); g.fill(); g.stroke();
      // rifle
      g.strokeStyle = "#141410"; g.lineWidth = 2.1; g.lineCap = "round";
      g.beginPath(); g.moveTo(-1, 3.4); g.lineTo(12.5, 2.6); g.stroke();
      g.strokeStyle = "#5b4a33"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-1.5, 3.5); g.lineTo(3, 3.3); g.stroke();
      // shoulders
      const gb = g.createLinearGradient(-5, -7, 4, 7); gb.addColorStop(0, shade(T.c, 0.25)); gb.addColorStop(1, shade(T.c, -0.35));
      g.fillStyle = gb; g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 1;
      g.beginPath(); g.ellipse(-0.5, 0, 4.8, 7, 0, 0, 7); g.fill(); g.stroke();
      // arms / hands
      g.fillStyle = shade(T.c, -0.15); g.beginPath(); g.arc(4.2, 3.2, 1.8, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#c79a74"; g.beginPath(); g.arc(7.6, 2.9, 1.3, 0, 7); g.fill();
      // helmet
      const gh = g.createRadialGradient(-0.6, -1.4, 0.3, 0.5, 0, 4.6); gh.addColorStop(0, shade(T.c, 0.05)); gh.addColorStop(0.5, shade(T.c, -0.45)); gh.addColorStop(1, shade(T.c, -0.7));
      g.fillStyle = gh; g.beginPath(); g.arc(0.6, 0, 4.1, 0, 7); g.fill(); g.strokeStyle = "rgba(0,0,0,.8)"; g.stroke();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(-0.4, -1.5, 1.6, 1, -0.5, 0, 7); g.fill();
    });
    const gen = sprite(44, g => {
      // cape
      const gc = g.createLinearGradient(-16, 0, 0, 0); gc.addColorStop(0, shade(T.c, -0.7)); gc.addColorStop(1, shade(T.c, -0.35));
      g.fillStyle = gc; g.beginPath(); g.moveTo(-1, -9); g.quadraticCurveTo(-15, -11, -18, 0); g.quadraticCurveTo(-15, 11, -1, 9); g.closePath(); g.fill();
      g.strokeStyle = "#d9b860"; g.lineWidth = 1; g.stroke();
      // long rifle
      g.strokeStyle = "#141410"; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 5); g.lineTo(19, 4); g.stroke();
      g.strokeStyle = "#6a5638"; g.lineWidth = 3; g.beginPath(); g.moveTo(-1, 5.2); g.lineTo(5, 5); g.stroke();
      // body
      const gb = g.createLinearGradient(-6, -10, 6, 10); gb.addColorStop(0, shade(T.c, 0.3)); gb.addColorStop(1, shade(T.c, -0.4));
      g.fillStyle = gb; g.strokeStyle = "rgba(0,0,0,.8)"; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(0, 0, 7, 10, 0, 0, 7); g.fill(); g.stroke();
      // epaulettes
      g.fillStyle = "#e7c76a"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(0.5, s * 7.6, 2.4, 1.8, 0, 0, 7); g.fill(); g.stroke(); }
      g.fillStyle = "#c79a74"; g.beginPath(); g.arc(10, 4.3, 1.7, 0, 7); g.fill();
      // cap with star
      const gh = g.createRadialGradient(-1, -2, 0.5, 0.5, 0, 6.5); gh.addColorStop(0, shade(T.c, 0.1)); gh.addColorStop(0.6, shade(T.c, -0.55)); gh.addColorStop(1, shade(T.c, -0.75));
      g.fillStyle = gh; g.beginPath(); g.arc(0.8, 0, 6, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#f3d77c"; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 1.4 : 3.4; g.lineTo(0.8 + Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill();
    });
    const fort = sprite(150, g => {
      const R = 52, pts = 5;
      // earthwork ring
      g.fillStyle = "rgba(60,48,30,.55)"; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill();
      // bastions
      const star = (r1, r2) => { g.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = i / (pts * 2) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r2 : r1; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); };
      g.save(); g.translate(3, 5); star(R + 2, R * 0.72); g.fillStyle = "rgba(0,0,0,.5)"; g.fill(); g.restore();
      star(R, R * 0.7);
      const gs = g.createLinearGradient(-R, -R, R, R); gs.addColorStop(0, "#a49f8c"); gs.addColorStop(0.5, "#78735f"); gs.addColorStop(1, "#4b4839");
      g.fillStyle = gs; g.fill(); g.lineWidth = 2; g.strokeStyle = "#2a2820"; g.stroke();
      // parapet highlight
      star(R - 5, R * 0.7 - 4); g.strokeStyle = "rgba(255,255,240,.22)"; g.lineWidth = 1.5; g.stroke();
      // courtyard
      star(R - 12, R * 0.7 - 9); const gy = g.createRadialGradient(0, 0, 2, 0, 0, R); gy.addColorStop(0, "#6e5a3c"); gy.addColorStop(1, "#4a3c27"); g.fillStyle = gy; g.fill();
      // team roofs
      const roof = (x, y, w, h, a) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(-w / 2 + 2, -h / 2 + 2, w, h);
        const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, shade(T.c, 0.15)); gr.addColorStop(0.5, shade(T.c, -0.1)); gr.addColorStop(0.51, shade(T.c, -0.45)); gr.addColorStop(1, shade(T.c, -0.6));
        g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 0.8; g.strokeRect(-w / 2, -h / 2, w, h); g.restore(); };
      roof(-14, -12, 18, 10, 0.2); roof(15, -6, 14, 9, -0.4); roof(-6, 16, 20, 9, 0.1);
      // bastion gun pits
      for (let i = 0; i < pts; i++) { const a = i / pts * Math.PI * 2 - Math.PI / 2; g.fillStyle = "#3a372b"; g.beginPath(); g.arc(Math.cos(a) * (R - 10), Math.sin(a) * (R - 10), 4, 0, 7); g.fill(); }
      // team band
      g.strokeStyle = T.c; g.globalAlpha = 0.85; g.lineWidth = 3; star(R + 3, R * 0.72 + 2); g.stroke(); g.globalAlpha = 1;
    }, 2);
    return { inf, gen, infW: whiteOf(inf), genW: whiteOf(gen), fort };
  });
}

// ---------- world (terrain, rocks) ----------
function buildWorld() {
  buildSprites();
  const S = G.S;
  GK = S > 2000 ? 0.6 : 0.7;
  const w = Math.ceil(S * GK);
  groundCvs = document.createElement("canvas"); groundCvs.width = groundCvs.height = w;
  const g = groundCvs.getContext("2d");
  // heightmap + moisture at 1/5 world scale, hill-shaded
  const hs = 5, hw = Math.ceil(S / hs), n1 = makeNoise(G.S * 7 + 3), n2 = makeNoise(G.S + 99), n3 = makeNoise(555);
  const hgt = new Float32Array(hw * hw);
  for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) hgt[y * hw + x] = fbm(n1, x * hs / 380, y * hs / 380, 5);
  const img = new ImageData(hw, hw), d = img.data, r = mulberry32(42);
  const L = [-0.6, -0.7, 0.55];
  for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) {
    const i = y * hw + x, h = hgt[i];
    const hx = (hgt[y * hw + Math.min(hw - 1, x + 1)] - hgt[y * hw + Math.max(0, x - 1)]) * 9;
    const hy = (hgt[Math.min(hw - 1, y + 1) * hw + x] - hgt[Math.max(0, y - 1) * hw + x]) * 9;
    const nl = Math.hypot(hx, hy, 1);
    const lam = Math.max(0, (-hx * L[0] - hy * L[1] + L[2]) / nl);
    const m = fbm(n2, x * hs / 520, y * hs / 520, 3), dry = clamp((h - 0.45) * 2.4 + (0.5 - m) * 1.2, 0, 1);
    const det = fbm(n3, x * hs / 40, y * hs / 40, 2);
    // lush moss -> olive -> dry straw
    let R = 34 + dry * 62 + det * 14, Gc = 50 + dry * 44 + det * 16, B = 30 + dry * 22 + det * 8;
    const sh = 0.55 + lam * 0.75 + (r() - 0.5) * 0.05;
    d[i * 4] = R * sh; d[i * 4 + 1] = Gc * sh; d[i * 4 + 2] = B * sh; d[i * 4 + 3] = 255;
  }
  const tmp = document.createElement("canvas"); tmp.width = tmp.height = hw; tmp.getContext("2d").putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(tmp, 0, 0, w, w);
  g.save(); g.scale(GK, GK);
  // dirt tracks from every base towards the middle
  for (const p of G.players) {
    const b = p.base, cx = S / 2, cy = S / 2, mx = (b.x + cx) / 2 + p.fwd.y * 160, my = (b.y + cy) / 2 - p.fwd.x * 160;
    g.lineCap = "round";
    for (const [lw, col] of [[46, "rgba(70,56,36,.28)"], [26, "rgba(112,92,62,.32)"], [3, "rgba(40,30,18,.35)"]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(mx, my, cx, cy); g.stroke();
    }
    g.strokeStyle = "rgba(40,30,18,.25)"; g.lineWidth = 2;
    for (const o of [-7, 7]) { g.beginPath(); g.moveTo(b.x + o, b.y); g.quadraticCurveTo(mx + o, my, cx + o, cy); g.stroke(); }
  }
  // cleared ground around bases
  for (const p of G.players) {
    const b = p.base, gr = g.createRadialGradient(b.x, b.y, 40, b.x, b.y, 150);
    gr.addColorStop(0, "rgba(96,78,50,.55)"); gr.addColorStop(1, "rgba(96,78,50,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, 150, 0, 7); g.fill();
  }
  // grass tufts and pebbles
  const tr = mulberry32(G.S);
  for (let i = 0; i < S * S / 900; i++) {
    const x = tr() * S, y = tr() * S, l = 3 + tr() * 4, dark = tr() < 0.5;
    g.strokeStyle = dark ? "rgba(16,26,12,.35)" : "rgba(150,160,96,.18)"; g.lineWidth = 1.1;
    g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(x + k * 1.5, y); g.lineTo(x + k * 2.6, y - l); } g.stroke();
  }
  for (let i = 0; i < S * S / 6000; i++) {
    const x = tr() * S, y = tr() * S, s = 1 + tr() * 2.4;
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x + 0.8, y + 1, s, s * 0.7, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(${150 + tr() * 40 | 0},${140 + tr() * 30 | 0},${110 + tr() * 30 | 0},.55)`; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, 7); g.fill();
  }
  // shrubs (decoration only)
  for (let i = 0; i < S * S / 26000; i++) {
    const x = tr() * S, y = tr() * S;
    if (G.rocks.some(o => Math.hypot(o.x - x, o.y - y) < o.r + 30)) continue;
    if (G.players.some(p => Math.hypot(p.base.x - x, p.base.y - y) < 190)) continue;
    const n = 3 + (tr() * 4 | 0), base = 5 + tr() * 6;
    const blobs = []; for (let k = 0; k < n; k++) blobs.push([x + (tr() - 0.5) * base * 2.2, y + (tr() - 0.5) * base * 2.2, base * (0.6 + tr() * 0.6)]);
    g.fillStyle = "rgba(0,0,0,.35)"; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx + br * 0.5, by + br * 0.6, br, 0, 7); g.fill(); }
    for (const [bx, by, br] of blobs) {
      const gr = g.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
      gr.addColorStop(0, "#5f7a3c"); gr.addColorStop(0.6, "#33482a"); gr.addColorStop(1, "#1f2e1b");
      g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
    }
  }
  // rock contact shadows (light from top-left)
  for (const o of G.rocks) {
    const gr = g.createRadialGradient(o.x + o.r * 0.25, o.y + o.r * 0.3, o.r * 0.6, o.x + o.r * 0.25, o.y + o.r * 0.3, o.r * 1.6);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(o.x + o.r * 0.25, o.y + o.r * 0.3, o.r * 1.6, 0, 7); g.fill();
  }
  // map grid references, very faint
  const step = 200;
  g.strokeStyle = "rgba(233,229,211,.045)"; g.lineWidth = 1.5;
  for (let x = 0; x <= S; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  for (let y = 0; y <= S; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  g.fillStyle = "rgba(233,229,211,.13)"; g.font = "600 18px 'JetBrains Mono', monospace";
  for (let cx = 0; cx * step < S; cx++) for (let cy = 0; cy * step < S; cy++) g.fillText(String.fromCharCode(65 + cx) + (cy + 1), cx * step + 8, cy * step + 22);
  g.restore();

  // rock sprites
  for (const o of G.rocks) {
    const size = o.r * 2.6, rr = mulberry32(Math.floor(o.x * 13 + o.y));
    o.spr = sprite(size, c => {
      const n = o.verts.length, pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, q = o.r * o.verts[i]; pts.push([Math.cos(a) * q, Math.sin(a) * q]); }
      const poly = (k, ox, oy) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * k + ox, y * k + oy) : c.moveTo(x * k + ox, y * k + oy)); c.closePath(); };
      poly(1, 0, 0);
      const gr = c.createLinearGradient(-o.r, -o.r, o.r, o.r); gr.addColorStop(0, "#9c9886"); gr.addColorStop(0.45, "#6d6a5a"); gr.addColorStop(1, "#33322a");
      c.fillStyle = gr; c.fill(); c.lineWidth = 1.6; c.strokeStyle = "#22211b"; c.stroke();
      // facets
      c.save(); poly(1, 0, 0); c.clip();
      for (let i = 0; i < n; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n], cx = (x1 + x2) * 0.18 - o.r * 0.08, cy = (y1 + y2) * 0.18 - o.r * 0.1;
        const lit = Math.max(0, -(x1 + x2) * 0.6 - (y1 + y2) * 0.7) / (o.r * 2);
        c.fillStyle = `rgba(${lit > 0.2 ? "255,252,235" : "0,0,0"},${lit > 0.2 ? lit * 0.35 : 0.18 + rr() * 0.1})`;
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(cx, cy); c.closePath(); c.fill();
      }
      c.strokeStyle = "rgba(20,20,16,.5)"; c.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) { const a = rr() * 7, l = o.r * (0.3 + rr() * 0.5); c.beginPath(); c.moveTo(Math.cos(a) * o.r * 0.2, Math.sin(a) * o.r * 0.2); c.lineTo(Math.cos(a + 0.3) * l, Math.sin(a + 0.3) * l); c.stroke(); }
      // moss
      for (let i = 0; i < 6; i++) { const a = rr() * 7, q = o.r * rr() * 0.7; c.fillStyle = "rgba(78,104,52,.35)"; c.beginPath(); c.arc(Math.cos(a) * q, Math.sin(a) * q - o.r * 0.2, o.r * (0.1 + rr() * 0.15), 0, 7); c.fill(); }
      c.restore();
    }, 2);
  }

  decalCvs = document.createElement("canvas"); decalCvs.width = decalCvs.height = Math.ceil(S * 0.5);
  decalCtx = decalCvs.getContext("2d"); decalCtx.scale(0.5, 0.5);

  fogCvs = document.createElement("canvas"); fogCvs.width = G.gw; fogCvs.height = G.gh;
  fogCtx = fogCvs.getContext("2d"); fogImg = fogCtx.createImageData(G.gw, G.gh);

  // tileable drifting cloud texture for the fog
  if (!cloudCvs) {
    const N = 256, cn = makeNoise(77, 8), cn2 = makeNoise(91, 16);
    cloudCvs = document.createElement("canvas"); cloudCvs.width = cloudCvs.height = N;
    const ci = new ImageData(N, N), cd = ci.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0, a = 0.55, f = 1 / 32, t = 0;
      for (let o = 0; o < 4; o++) { v += (o < 2 ? cn : cn2)(x * f * (o < 2 ? 1 : 0.5) * Math.pow(2, o % 2), y * f * (o < 2 ? 1 : 0.5) * Math.pow(2, o % 2)) * a; t += a; a *= 0.5; }
      v /= t; v = clamp((v - 0.3) * 1.6, 0, 1);
      const i = (y * N + x) * 4; cd[i] = 14 + v * 46; cd[i + 1] = 18 + v * 50; cd[i + 2] = 24 + v * 54; cd[i + 3] = 255;
    }
    cloudCvs.getContext("2d").putImageData(ci, 0, 0);
  }
  miniGround = document.createElement("canvas"); miniGround.width = miniGround.height = mini.width;
  const mg = miniGround.getContext("2d"); mg.drawImage(groundCvs, 0, 0, mini.width, mini.width);
  for (const o of G.rocks) { mg.fillStyle = "#7a7766"; mg.beginPath(); mg.arc(o.x / S * mini.width, o.y / S * mini.width, o.r / S * mini.width, 0, 7); mg.fill(); }
  parts = [];
}

function drawFogTexture() {
  const d = fogImg.data, { visible, explored } = G;
  for (let i = 0, n = visible.length; i < n; i++) {
    const o = i * 4; d[o] = 10; d[o + 1] = 13; d[o + 2] = 16;
    d[o + 3] = visible[i] ? 0 : explored[i] ? 150 : 242;
  }
  fogCtx.putImageData(fogImg, 0, 0);
}

// ---------- particles ----------
function addPart(p) { if (parts.length < QP[Q.level].parts) parts.push(p); }
const rnd = Math.random;
function burst(x, y, kind, color, big) {
  const P = QP[Q.level];
  if (kind === "hit") {
    for (let i = 0; i < 3; i++) { const a = rnd() * 7, s = 40 + rnd() * 90; addPart({ k: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25, max: 0.25, s: 1.4, c: "255,210,120" }); }
    addPart({ k: "smoke", x, y, vx: 0, vy: -6, life: 0.5, max: 0.5, s: 7, g: 10 });
  } else if (kind === "death") {
    addPart({ k: "glow", x, y, life: 0.22, max: 0.22, s: big ? 70 : 38 });
    for (let i = 0; i < (big ? 22 : 9); i++) { const a = rnd() * 7, s = 60 + rnd() * (big ? 260 : 160); addPart({ k: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + rnd() * 0.4, max: 0.7, s: 1.6, c: "255,190,90" }); }
    for (let i = 0; i < (big ? 9 : 4); i++) { const a = rnd() * 7, s = 10 + rnd() * 30; addPart({ k: "smoke", x: x + Math.cos(a) * 4, y: y + Math.sin(a) * 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 8, life: 1.4 + rnd(), max: 2.4, s: big ? 22 : 12, g: big ? 30 : 16 }); }
    for (let i = 0; i < (big ? 8 : 4); i++) { const a = rnd() * 7, s = 50 + rnd() * 100; addPart({ k: "debris", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, s: 1.8, c: color, rot: rnd() * 7 }); }
    if (big) addPart({ k: "ring", x, y, life: 0.5, max: 0.5, s: 120, c: "255,220,160" });
    if (P.decals) { decalCtx.globalAlpha = 0.9; const s = big ? 60 : 30; decalCtx.drawImage(SPR.scorch, x - s / 2, y - s / 2, s, s); decalCtx.globalAlpha = 1; }
  } else if (kind === "boom") {
    shake.a = Math.max(shake.a, 16);
    addPart({ k: "glow", x, y, life: 0.6, max: 0.6, s: 260 });
    addPart({ k: "ring", x, y, life: 0.9, max: 0.9, s: 340, c: "255,210,150" });
    for (let i = 0; i < 50; i++) { const a = rnd() * 7, s = 80 + rnd() * 420; addPart({ k: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + rnd() * 0.9, max: 1.4, s: 2.2, c: "255,180,80" }); }
    for (let i = 0; i < 26; i++) { const a = rnd() * 7, s = 20 + rnd() * 80; addPart({ k: "smoke", x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 2.5 + rnd() * 2, max: 4.5, s: 40, g: 50 }); }
    for (let i = 0; i < 20; i++) { const a = rnd() * 7, s = 60 + rnd() * 200; addPart({ k: "debris", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, max: 1, s: 3.5, c: "#5a5648", rot: rnd() * 7 }); }
    decalCtx.drawImage(SPR.scorch, x - 120, y - 120, 240, 240);
  } else if (kind === "recall") {
    addPart({ k: "ring", x, y, life: 0.45, max: 0.45, s: -26, c: color });
    addPart({ k: "glow", x, y, life: 0.3, max: 0.3, s: 26, tint: true });
  } else if (kind === "level") {
    addPart({ k: "ring", x, y, life: 0.8, max: 0.8, s: 40, c: "243,215,124" });
  }
}
function consumeFx() {
  const me = G.human;
  for (const e of G.fx) {
    const seen = G.attract || e.owner === me || isVis(e.x, e.y);
    if (e.k === "level") {
      for (const u of G.units) if (u.alive && u.owner === e.owner && (G.attract || u.owner === me || isVis(u.x, u.y))) burst(u.x, u.y, "level");
      continue;
    }
    if (!seen) continue;
    burst(e.x, e.y, e.k, e.c, e.big);
    if (e.k === "death" && e.big && e.owner === me) shake.a = Math.max(shake.a, 8);
  }
  G.fx.length = 0;
  // fresh shots: muzzle flash, impact sparks
  for (const t of G.tracers) {
    if (!t.fresh) continue; t.fresh = false;
    if (!(G.attract || t.owner === me || isVis(t.x1, t.y1) || isVis(t.x2, t.y2))) continue;
    addPart({ k: "glow", x: t.x1 + Math.cos(t.a) * 10, y: t.y1 + Math.sin(t.a) * 10, life: 0.07, max: 0.07, s: t.w > 2 ? 30 : 18 });
    if (t.hit) burst(t.x2, t.y2, "hit");
  }
}
function stepParts(dt) {
  for (const p of parts) {
    p.life -= dt;
    if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; const f = p.k === "smoke" ? 0.96 : 0.9; p.vx *= f; p.vy *= f; }
    if (p.g) p.s += p.g * dt;
  }
  parts = parts.filter(p => p.life > 0);
}

// ---------- drawing ----------
const TAU = Math.PI * 2;
function drawSpr(img, x, y, a, size) {
  ctx.save(); ctx.translate(x, y); if (a) ctx.rotate(a);
  ctx.drawImage(img, -size / 2, -size / 2, size, size); ctx.restore();
}

function render(dtReal) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = "#07090a"; c.fillRect(0, 0, cvs.width, cvs.height);
  if (!G || !groundCvs) return;
  const now = performance.now() / 1000, P = QP[Q.level];
  consumeFx(); stepParts(dtReal || 0.016);
  shake.a *= 0.88; const sx = (rnd() - 0.5) * shake.a, sy = (rnd() - 0.5) * shake.a;
  const z = cam.z, ox = -(cam.x) * z + W / 2 + sx, oy = -(cam.y) * z + H / 2 + sy;
  c.setTransform(DPR * z, 0, 0, DPR * z, ox * DPR, oy * DPR);
  const vx0 = cam.x - W / 2 / z - 80, vx1 = cam.x + W / 2 / z + 80, vy0 = cam.y - H / 2 / z - 80, vy1 = cam.y + H / 2 / z + 80;
  const inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  const seeAll = !!G.attract;
  const vis = (x, y) => seeAll || isVis(x, y);

  c.imageSmoothingEnabled = true;
  c.drawImage(groundCvs, 0, 0, G.S, G.S);
  c.drawImage(decalCvs, 0, 0, G.S, G.S);
  // dark beyond the map edge
  c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 30; c.strokeRect(-15, -15, G.S + 30, G.S + 30);
  c.strokeStyle = "rgba(205,180,106,.35)"; c.lineWidth = 2; c.strokeRect(0, 0, G.S, G.S);

  // own general's aura
  const myGen = G.gens[G.human];
  if (!seeAll && myGen && myGen.alive) {
    const gr = c.createRadialGradient(myGen.x, myGen.y, CFG.auraR * 0.3, myGen.x, myGen.y, CFG.auraR);
    gr.addColorStop(0, "rgba(78,168,255,0)"); gr.addColorStop(1, "rgba(78,168,255,.09)");
    c.fillStyle = gr; c.beginPath(); c.arc(myGen.x, myGen.y, CFG.auraR, 0, TAU); c.fill();
    c.save(); c.translate(myGen.x, myGen.y); c.rotate(now * 0.15);
    c.strokeStyle = "rgba(120,190,255,.35)"; c.setLineDash([10, 14]); c.lineWidth = 1.5 / Math.max(z, 0.6);
    c.beginPath(); c.arc(0, 0, CFG.auraR, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
  }

  // bases
  for (const p of G.players) {
    const b = p.base; if (!b.alive) continue;
    const ghost = !(p.id === G.human || vis(b.x, b.y));
    if (ghost && !(seeAll || isExp(b.x, b.y))) continue;
    if (!inView(b.x, b.y)) continue;
    const S = SPR.team[p.id].fort;
    c.globalAlpha = ghost ? 0.5 : 1;
    c.drawImage(S, b.x - 75, b.y - 75, 150, 150);
    if (!ghost) {
      // turret
      c.save(); c.translate(b.x, b.y); c.rotate(b.aim || -Math.PI / 4);
      c.fillStyle = "#1c1c17"; c.fillRect(0, -2.4, 26, 4.8);
      c.fillStyle = "#3d3c33"; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.strokeStyle = p.team.c; c.lineWidth = 2; c.stroke(); c.restore();
      // flag
      const fx = b.x - 30, fy = b.y - 38;
      c.strokeStyle = "#2a261c"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(fx, fy + 18); c.lineTo(fx, fy - 6); c.stroke();
      c.fillStyle = p.team.c; c.beginPath(); c.moveTo(fx, fy - 6);
      for (let i = 0; i <= 8; i++) { const t = i / 8; c.lineTo(fx + t * 20, fy - 6 + Math.sin(now * 6 + t * 5) * 2.2 * t); }
      for (let i = 8; i >= 0; i--) { const t = i / 8; c.lineTo(fx + t * 20, fy + 5 + Math.sin(now * 6 + t * 5 + 0.4) * 2.2 * t); }
      c.closePath(); c.fill();
      if (b.flash > 0) { c.globalCompositeOperation = "lighter"; c.globalAlpha = 0.35; c.drawImage(SPR.glow, b.x - 50, b.y - 50, 100, 100); c.globalCompositeOperation = "source-over"; }
      // damaged bases burn
      const f = b.hp / CFG.base.hp;
      if (f < 0.6 && rnd() < (0.6 - f) * 0.6) addPart({ k: "smoke", x: b.x + (rnd() - 0.5) * 60, y: b.y + (rnd() - 0.5) * 60, vx: 4, vy: -14, life: 2.5, max: 2.5, s: 14, g: 20 });
      if (f < 0.35 && rnd() < 0.3) addPart({ k: "glow", x: b.x + (rnd() - 0.5) * 50, y: b.y + (rnd() - 0.5) * 50, life: 0.25, max: 0.25, s: 26 });
      // hp ring
      c.globalAlpha = 1; c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.45)"; c.beginPath(); c.arc(b.x, b.y, 64, 0, TAU); c.stroke();
      c.strokeStyle = f > 0.35 ? "rgba(233,229,211,.9)" : "#ff6b5e"; c.beginPath(); c.arc(b.x, b.y, 64, -Math.PI / 2, -Math.PI / 2 + TAU * f); c.stroke();
    }
    c.globalAlpha = 1;
  }

  // rocks
  for (const o of G.rocks) {
    if (!inView(o.x, o.y)) continue;
    const s = o.spr.size; c.drawImage(o.spr, o.x - s / 2, o.y - s / 2, s, s);
  }

  // selection rings + shadows
  const showU = [];
  for (const u of G.units) {
    if (!u.alive || !inView(u.x, u.y)) continue;
    if (u.owner !== G.human && !vis(u.x, u.y)) continue;
    showU.push(u);
  }
  for (const u of showU) { const r = CFG[u.kind].r; c.globalAlpha = 0.9; c.drawImage(SPR.shadow, u.x - r * 1.6 + 2.5, u.y - r * 1.6 + 3.5, r * 3.2, r * 3.2); }
  c.globalAlpha = 1;
  if (!seeAll) {
    const pulse = 0.65 + Math.sin(now * 5) * 0.2;
    c.strokeStyle = `rgba(240,236,214,${pulse})`; c.lineWidth = 1.3;
    c.beginPath();
    for (const u of showU) if (u.owner === G.human && UI.sel.has(u.id)) { const r = CFG[u.kind].r + 4.5; c.moveTo(u.x + r, u.y); c.arc(u.x, u.y, r, 0, TAU); }
    c.stroke();
  }
  // soldiers
  for (const u of showU) {
    const T = SPR.team[u.owner], gen = u.kind === "gen";
    const img = u.flash > 0 ? (gen ? T.genW : T.infW) : (gen ? T.gen : T.inf);
    const bob = u.moving ? Math.sin(now * 14 + u.id) * 0.6 : 0;
    drawSpr(img, u.x, u.y + bob, u.face, gen ? 44 : 28);
    const lv = G.players[u.owner].level;
    if (lv > 0) { c.fillStyle = "#e7c76a"; const n = Math.min(lv, 5), r = CFG[u.kind].r; for (let i = 0; i < n; i++) c.fillRect(u.x - r + i * 3.4, u.y - r - 8, 2.4, 2.4); }
    const mh = maxHp(u);
    if (u.hp < mh * 0.995) {
      const w = gen ? 26 : 14, r = CFG[u.kind].r, f = clamp(u.hp / mh, 0, 1);
      c.fillStyle = "rgba(0,0,0,.65)"; c.fillRect(u.x - w / 2 - 0.5, u.y + r + 3.5, w + 1, 3.6);
      c.fillStyle = f > 0.5 ? "#9fe07a" : f > 0.25 ? "#f2c94c" : "#ff6b5e"; c.fillRect(u.x - w / 2, u.y + r + 4, w * f, 2.6);
    }
  }

  // smoke (normal blend) above units
  for (const p of parts) {
    if (p.k !== "smoke" && p.k !== "debris") continue;
    if (!inView(p.x, p.y)) continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === "smoke") { c.globalAlpha = a * 0.8; c.drawImage(SPR.smoke, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); }
    else { c.globalAlpha = a; c.fillStyle = p.c; c.save(); c.translate(p.x, p.y); c.rotate(p.rot += 0.3); c.fillRect(-p.s, -p.s * 0.6, p.s * 2, p.s * 1.2); c.restore(); }
  }
  c.globalAlpha = 1;

  // cloud shadows drifting over the field
  if (P.shadows) {
    c.globalCompositeOperation = "multiply";
    for (let i = 0; i < 5; i++) {
      const R = 380 + i * 60, x = ((now * (8 + i * 2) + i * 900) % (G.S + R * 2)) - R, y = (i * 613 + Math.sin(now * 0.05 + i) * 200) % G.S;
      if (x + R < vx0 || x - R > vx1 || y + R < vy0 || y - R > vy1) continue;
      const gr = c.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, "rgba(120,130,140,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = gr; c.fillRect(x - R, y - R, R * 2, R * 2);
    }
    c.globalCompositeOperation = "source-over";
  }

  // light: tracers, flashes, sparks
  c.globalCompositeOperation = "lighter";
  c.lineCap = "round";
  for (const t of G.tracers) {
    if (!(seeAll || t.owner === G.human || isVis(t.x1, t.y1) || isVis(t.x2, t.y2))) continue;
    const a = clamp(t.t / 0.12, 0, 1);
    // bullet head travelling along the line
    const k = 1 - a, hx = t.x1 + (t.x2 - t.x1) * Math.min(1, k * 2.2), hy = t.y1 + (t.y2 - t.y1) * Math.min(1, k * 2.2);
    c.globalAlpha = a * 0.45; c.strokeStyle = t.c; c.lineWidth = t.w * 3.2;
    c.beginPath(); c.moveTo(t.x1, t.y1); c.lineTo(hx, hy); c.stroke();
    c.globalAlpha = a; c.strokeStyle = "rgba(255,244,214,.95)"; c.lineWidth = t.w * 0.8;
    c.beginPath(); c.moveTo(t.x1 + (hx - t.x1) * 0.5, t.y1 + (hy - t.y1) * 0.5); c.lineTo(hx, hy); c.stroke();
  }
  for (const p of parts) {
    if (!inView(p.x, p.y)) continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.k === "glow") { c.globalAlpha = a; c.drawImage(SPR.glow, p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    else if (p.k === "spark") { c.globalAlpha = a; c.strokeStyle = `rgba(${p.c},1)`; c.lineWidth = p.s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); c.stroke(); }
    else if (p.k === "ring") {
      const t = 1 - a, R = p.s > 0 ? p.s * (0.2 + t * 0.8) : -p.s * a;
      c.globalAlpha = a * 0.8; c.strokeStyle = p.c.startsWith("#") ? p.c : `rgba(${p.c},1)`; c.lineWidth = (p.s > 100 ? 6 : 2.2) * a + 0.5;
      c.beginPath(); c.arc(p.x, p.y, Math.max(1, R), 0, TAU); c.stroke();
    }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = "source-over";

  // fog of war with drifting clouds
  if (!seeAll) {
    drawFogTexture();
    const fl = fogLayerCtx, fw = fogLayer.width, fh = fogLayer.height;
    fl.setTransform(1, 0, 0, 1, 0, 0); fl.globalCompositeOperation = "source-over"; fl.clearRect(0, 0, fw, fh);
    fl.setTransform(z * 0.5, 0, 0, z * 0.5, ox * 0.5, oy * 0.5);
    fl.imageSmoothingEnabled = true;
    fl.drawImage(fogCvs, 0, 0, G.gw * CFG.fogCell, G.gh * CFG.fogCell);
    if (P.clouds) {
      fl.globalCompositeOperation = "source-atop";
      const pat = fl.createPattern(cloudCvs, "repeat");
      const m = new DOMMatrix().translateSelf(now * 9, now * 4).scaleSelf(3.2, 3.2);
      pat.setTransform(m); fl.fillStyle = pat; fl.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
      fl.globalAlpha = 0.5;
      const pat2 = fl.createPattern(cloudCvs, "repeat"); pat2.setTransform(new DOMMatrix().translateSelf(-now * 14, now * 7).scaleSelf(5.5, 5.5));
      fl.fillStyle = pat2; fl.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0); fl.globalAlpha = 1;
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(fogLayer, 0, 0, cvs.width, cvs.height);
    c.setTransform(DPR * z, 0, 0, DPR * z, ox * DPR, oy * DPR);
  }

  // order pings (above fog)
  for (const pg of UI.pings) {
    const a = pg.t / 0.7; c.globalAlpha = a;
    c.strokeStyle = pg.mode === "attack" ? "#ff6b5e" : "#e7c76a"; c.lineWidth = 2 / z;
    c.beginPath(); c.arc(pg.x, pg.y, (1 - a) * 26 + 5, 0, TAU); c.stroke();
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + Math.PI / 4, r1 = 10 + a * 22, r2 = r1 + 7;
      c.beginPath(); c.moveTo(pg.x + Math.cos(ang - 0.25) * r2, pg.y + Math.sin(ang - 0.25) * r2); c.lineTo(pg.x + Math.cos(ang) * r1, pg.y + Math.sin(ang) * r1); c.lineTo(pg.x + Math.cos(ang + 0.25) * r2, pg.y + Math.sin(ang + 0.25) * r2); c.stroke();
    }
  }
  c.globalAlpha = 1;
  if (!seeAll && myGen && myGen.alive && UI.sel.has(myGen.id)) {
    c.strokeStyle = "rgba(233,229,211,.25)"; c.lineWidth = 1 / z; c.setLineDash([4 / z, 6 / z]);
    c.beginPath(); c.arc(myGen.x, myGen.y, CFG.gen.range, 0, TAU); c.stroke(); c.setLineDash([]);
  }

  // screen space: vignette, selection box
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(vignetteCvs, 0, 0, cvs.width, cvs.height);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (UI.box) {
    const { x0, y0, x1, y1 } = UI.box;
    c.fillStyle = "rgba(205,180,106,.1)"; c.strokeStyle = "rgba(205,180,106,.8)"; c.lineWidth = 1;
    c.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    c.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
}

function renderMini() {
  if (!G || !miniGround) return;
  const M = mini.width, k = M / G.S, c = mctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(miniGround, 0, 0);
  if (!G.attract) { c.imageSmoothingEnabled = true; c.drawImage(fogCvs, 0, 0, G.gw * CFG.fogCell * k, G.gh * CFG.fogCell * k); }
  for (const p of G.players) {
    const b = p.base; if (!b.alive) continue;
    if (G.attract || p.id === G.human || isExp(b.x, b.y)) { c.fillStyle = p.team.c; c.fillRect(b.x * k - 6, b.y * k - 6, 12, 12); c.strokeStyle = "#000"; c.lineWidth = 2; c.strokeRect(b.x * k - 6, b.y * k - 6, 12, 12); }
  }
  for (const u of G.units) {
    if (!u.alive) continue;
    if (!G.attract && u.owner !== G.human && !isVis(u.x, u.y)) continue;
    c.fillStyle = G.players[u.owner].team.c;
    const s = u.kind === "gen" ? 7 : 3.5; c.fillRect(u.x * k - s / 2, u.y * k - s / 2, s, s);
  }
  c.strokeStyle = "rgba(233,229,211,.85)"; c.lineWidth = 2;
  c.strokeRect((cam.x - W / 2 / cam.z) * k, (cam.y - H / 2 / cam.z) * k, W / cam.z * k, H / cam.z * k);
}

// adaptive quality: watch real frame times and step down (or back up) when needed
function trackQuality(dtReal) {
  if (document.hidden || dtReal <= 0 || dtReal > 0.25) return;
  Q.ema = Q.ema * 0.95 + dtReal * 1000 * 0.05;
  if (Q.ema > 24) { Q.slowT += dtReal; Q.fastT = 0; } else if (Q.ema < 14) { Q.fastT += dtReal; Q.slowT = 0; } else { Q.slowT = 0; Q.fastT = 0; }
  if (Q.slowT > 2.5 && Q.level > 0) { Q.level--; Q.slowT = 0; Q.ema = 16; resize(); }
  else if (Q.fastT > 12 && Q.level < 2) { Q.level++; Q.fastT = 0; resize(); }
}
