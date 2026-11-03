// ======================================================================
// AUDIO: synthesized effects + adaptive score (calm when quiet, tense in battle)
// ======================================================================
const SND = (() => {
  let ac = null, master, sfxBus, musBus, comp, noise, verb, verbIn;
  let pref = { m: 1, s: 1 };
  try { Object.assign(pref, JSON.parse(localStorage.getItem("hr-sound") || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem("hr-sound", JSON.stringify(pref)); } catch (e) {} };
  let tension = 0, heat = 0, lastHp = null, duck = 1, voices = 0, voiceT = 0;
  const S = { get on() { return !!ac; }, get pref() { return pref; } };

  function init() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC();
    comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = pref.s ? 0.8 : 0; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = pref.m ? 0.55 : 0; musBus.connect(master);
    const n = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = n;
    // small synthetic reverb for space
    const L = ac.sampleRate * 2.2, ir = ac.createBuffer(2, L, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < L; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 3.2); }
    verb = ac.createConvolver(); verb.buffer = ir; const vg = ac.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
    verbIn = verb;
    music.start();
  }
  ["pointerdown", "keydown", "touchend"].forEach(ev => window.addEventListener(ev, init, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

  // ---- helpers ----
  const now = () => ac.currentTime;
  function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  function out(gain, pan, wet, bus) {
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = clamp(pan, -1, 1); gain.connect(p); p.connect(bus); if (wet) p.connect(wetSend(wet)); }
    else { gain.connect(bus); }
  }
  function wetSend(w) { const g = ac.createGain(); g.gain.value = w; g.connect(verbIn); return g; }
  function nz(t, dur, type, f, q, peak, a, pan, wet, bus = sfxBus, f2) {
    const s = ac.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = ac.createGain(); env(g, t, a, peak, dur);
    s.connect(fl); fl.connect(g); out(g, pan, wet, bus);
    s.start(t, Math.random() * 1.2, a + dur + 0.05);
  }
  function tone(t, type, f0, f1, dur, peak, a, pan, wet, bus = sfxBus, filt) {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, a, peak, dur);
    let src = o; if (filt) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filt; fl.Q.value = 0.7; o.connect(fl); src = fl; }
    src.connect(g); out(g, pan, wet, bus);
    o.start(t); o.stop(t + a + dur + 0.05);
  }
  // position on screen -> volume + pan; far away or off screen gets quiet
  function place(x, y) {
    const dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z, R = Math.hypot(W, H) * 0.55;
    const d = Math.hypot(dx, dy) / R;
    const zoomV = clamp(0.55 + cam.z * 0.5, 0.6, 1.25);
    return { v: clamp(1.15 - d * 0.75, 0.06, 1) * zoomV, pan: clamp(dx / (W * 0.6), -0.9, 0.9), d };
  }
  function budget() {
    const t = performance.now(); if (t - voiceT > 60) { voiceT = t; voices = 0; }
    return ++voices <= 5;
  }

  // ---- effects ----
  S.shot = (x, y, w, mine) => {
    if (!ac || !pref.s) return;
    const P = place(x, y); heat += (P.d < 1.2 ? 1 : 0.35) * (mine ? 1.2 : 1);
    if (!budget()) return;
    const t = now() + Math.random() * 0.012, v = P.v * (G && G.attract ? 0.25 : 1);
    if (w > 2.3) { // base turret: heavy thump
      nz(t, 0.25, "lowpass", 900, 0.7, 0.5 * v, 0.003, P.pan, 0.25);
      tone(t, "sine", 110, 42, 0.28, 0.6 * v, 0.004, P.pan, 0.1);
    } else if (w > 2) { // general: sharp crack + tail
      nz(t, 0.18, "bandpass", 2600, 0.9, 0.55 * v, 0.002, P.pan, 0.35, sfxBus, 700);
      tone(t, "triangle", 220, 70, 0.16, 0.35 * v, 0.003, P.pan, 0.2);
    } else { // rifle
      nz(t, 0.07, "bandpass", 1500 + Math.random() * 900, 1.1, 0.26 * v, 0.0015, P.pan, 0.18);
    }
  };
  S.fx = e => {
    if (!ac || !pref.s) return;
    const P = place(e.x, e.y), t = now(), v = P.v * (G && G.attract ? 0.25 : 1);
    if (e.k === "death") {
      heat += 1.5;
      if (e.big) { // general down: impact + low boom
        nz(t, 0.9, "lowpass", 600, 0.8, 0.7 * v, 0.004, P.pan, 0.4, sfxBus, 120);
        tone(t, "sine", 90, 34, 0.8, 0.7 * v, 0.005, P.pan, 0.3);
      } else if (budget()) {
        nz(t, 0.16, "lowpass", 1100, 1.2, 0.22 * v, 0.003, P.pan, 0.15, sfxBus, 300);
        tone(t + 0.01, "sine", 160, 70, 0.1, 0.18 * v, 0.003, P.pan, 0);
      }
    } else if (e.k === "boom") { // base destroyed: long rumble
      heat += 12;
      nz(t, 3.2, "lowpass", 1400, 0.6, 0.9, 0.01, P.pan, 0.6, sfxBus, 60);
      tone(t, "sine", 70, 24, 2.6, 0.9, 0.01, P.pan, 0.3);
      nz(t + 0.25, 1.6, "bandpass", 500, 0.8, 0.4, 0.05, -P.pan, 0.6, sfxBus, 150);
    } else if (e.k === "recall") {
      if (budget()) tone(t, "sawtooth", 700, 120, 0.22, 0.08 * v, 0.004, P.pan, 0.3, sfxBus, 1800);
    } else if (e.k === "level" && (G.attract || e.owner === G.human)) {
      [0, 4, 7, 12].forEach((s, i) => tone(t + i * 0.08, "triangle", 587 * Math.pow(2, s / 12), 587 * Math.pow(2, s / 12), 0.5, 0.18, 0.006, 0, 0.5));
    }
  };
  S.order = mode => {
    if (!ac || !pref.s) return;
    const t = now(), f = mode === "attack" ? 1320 : 990;
    tone(t, "square", f, f, 0.035, 0.05, 0.002, 0, 0, sfxBus, 3000);
    tone(t + 0.05, "square", f * 1.26, f * 1.26, 0.04, 0.045, 0.002, 0, 0, sfxBus, 3000);
  };
  S.ui = () => { if (ac && pref.s) tone(now(), "triangle", 880, 660, 0.05, 0.06, 0.002, 0, 0); };
  S.sting = win => {
    if (!ac) return; const t = now() + 0.05;
    const notes = win ? [0, 7, 12, 16, 19] : [0, -2, -5, -9];
    notes.forEach((s, i) => { const f = 293.66 * Math.pow(2, s / 12); tone(t + i * 0.16, "sawtooth", f, f, 1.4 - i * 0.1, 0.12, 0.02, 0, 0.6, musBus, 1600); tone(t + i * 0.16, "triangle", f / 2, f / 2, 1.6, 0.14, 0.02, 0, 0.4, musBus); });
  };

  // ---- adaptive music ----
  // D minor; calm = slow pad + sparse plucks; tension = driving bass ostinato, drums, string stabs
  const music = (() => {
    const BPM = 112, beat = 60 / BPM, six = beat / 4;
    const chords = [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]]; // Dm  Bb  F/A  C
    const roots = [0, -4, -9, -2];
    let next = 0, idx = 0, timer = null, padNodes = [];
    const hz = s => 146.83 * Math.pow(2, s / 12); // D3
    function pad(t, ch, len) {
      for (const g of padNodes) { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.6); } catch (e) {} }
      padNodes = [];
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500 + tension * 1800; lp.Q.value = 0.5;
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 1.2); g.gain.setTargetAtTime(0.0001, t + len, 0.8);
      lp.connect(g); g.connect(musBus); g.connect(wetSend(0.7));
      for (const s of ch) for (const det of [-6, 6]) {
        const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(s); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + len + 4);
      }
      padNodes.push(g);
    }
    function kick(t, v) { tone(t, "sine", 120, 40, 0.28, 0.55 * v, 0.003, 0, 0, musBus); nz(t, 0.02, "highpass", 3000, 0.7, 0.08 * v, 0.001, 0, 0, musBus); }
    function snare(t, v) { nz(t, 0.16, "bandpass", 1800, 0.6, 0.22 * v, 0.002, 0, 0.35, musBus); tone(t, "triangle", 210, 160, 0.08, 0.12 * v, 0.002, 0, 0, musBus); }
    function hat(t, v) { nz(t, 0.03, "highpass", 8000, 0.7, 0.05 * v, 0.001, (Math.random() - 0.5) * 0.4, 0, musBus); }
    function tom(t, v, f) { tone(t, "sine", f, f * 0.55, 0.35, 0.4 * v, 0.003, 0, 0.3, musBus); nz(t, 0.08, "lowpass", 900, 0.6, 0.1 * v, 0.002, 0, 0.2, musBus); }
    function schedule() {
      if (!ac) return;
      // tension follows battle heat: rises fast, falls slowly
      const target = clamp(heat / 14, 0, 1) * (G && G.attract ? 0.55 : 1);
      tension += (target - tension) * (target > tension ? 0.22 : 0.025);
      heat *= 0.86;
      if (G && !G.attract && !G.over) {
        const hp = G.players[G.human].base.hp;
        if (lastHp !== null && hp < lastHp - 1) heat += 4; // our base is being hit
        lastHp = hp;
      }
      const dTarget = (UI.paused && G && !G.attract && !G.over) ? 0.35 : 1;
      duck += (dTarget - duck) * 0.2;
      musBus.gain.setTargetAtTime(pref.m ? 0.55 * duck : 0, now(), 0.15);
      while (next < now() + 0.25) {
        const t = next, bar = Math.floor(idx / 16), st = idx % 16, cI = Math.floor(bar / 2) % 4, T = tension;
        if (idx % 32 === 0) pad(t, chords[cI], beat * 8);
        const root = roots[cI];
        // calm layer: sparse plucked arpeggio, fades out as tension rises
        if (T < 0.75 && st % 2 === 0 && Math.random() < 0.45 - T * 0.3) {
          const ch = chords[cI], s = ch[Math.floor(Math.random() * 3)] + 12 * (Math.random() < 0.5 ? 1 : 2);
          tone(t, "triangle", hz(s), hz(s), 0.9, 0.07 * (1 - T), 0.005, (Math.random() - 0.5) * 0.6, 0.6, musBus);
        }
        // tension layers
        if (T > 0.12) { // bass ostinato
          const pat = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 3, 0, 7, 12];
          if (st % (T > 0.45 ? 1 : 2) === 0) tone(t, "sawtooth", hz(root - 12 + pat[st]), hz(root - 12 + pat[st]), six * 0.9, 0.11 * Math.min(1, T * 1.6), 0.004, 0, 0, musBus, 300 + T * 900);
        }
        if (T > 0.2 && st % 2 === 1) hat(t, Math.min(1, T * 1.4));
        if (T > 0.28 && (st === 0 || st === 8 || (T > 0.6 && (st === 6 || st === 11)))) kick(t, Math.min(1, T * 1.3));
        if (T > 0.45 && (st === 4 || st === 12)) snare(t, Math.min(1, T * 1.2));
        if (T > 0.65 && bar % 2 === 1 && st >= 12) tom(t, T, [180, 160, 140, 120][st - 12]);
        if (T > 0.7 && (st === 0 || st === 3 || st === 6 || st === 10)) { // string stabs
          for (const s of chords[cI]) tone(t, "sawtooth", hz(s + 12), hz(s + 12), six * 1.6, 0.035 * T, 0.006, 0, 0.4, musBus, 2400);
        }
        next += six; idx++;
      }
    }
    return { start() { next = now() + 0.1; idx = 0; timer = setInterval(schedule, 60); }, get tension() { return tension; } };
  })();
  S.music = music;
  S.setPref = (k, v) => {
    pref[k] = v ? 1 : 0; save();
    if (ac) { sfxBus.gain.setTargetAtTime(pref.s ? 0.8 : 0, now(), 0.05); musBus.gain.setTargetAtTime(pref.m ? 0.55 : 0, now(), 0.05); }
  };
  S.reset = () => { heat = 0; lastHp = null; };
  return S;
})();
