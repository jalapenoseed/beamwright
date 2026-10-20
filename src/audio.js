// ===== Sound and music: synthesized with the Web Audio API, no samples =====
// In play, the light itself is the drum machine: sources fire a pulse on the beat, it travels one cell per
// 16th note, and every ray hit is a percussion step (a hi-hat off a mirror, a glassy tok through a lens, a
// kick into a photocell...). Under that sit glass bells, sustained photocell tones and a low bench hum.
// The title and the bench picker have their own music, built from the same pure sine/triangle voices.
// Everything can also be rendered offline (used to make the trailer soundtrack).
const AU = (() => {
  const store = {
    get(k, d) { try { const v = localStorage.getItem('beamwright.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('beamwright.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  let c = null, master, bus, noise, hum, musicBus, offline = false, forced = null;
  const tones = {};
  const A = { on: store.get('sound', true) };
  const now = () => forced ?? c.currentTime;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function build(ctx) {
    c = ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.connect(c.destination);
    master = c.createGain(); master.gain.value = offline || A.on ? 0.85 : 0; master.connect(comp);
    const len = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4); }
    const rev = c.createConvolver(); rev.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.34; rev.connect(wet); wet.connect(master);
    const dry = c.createGain(); dry.gain.value = 0.8; dry.connect(master);
    bus = c.createGain(); bus.connect(dry); bus.connect(rev);
    musicBus = c.createGain(); musicBus.gain.value = 0.9; musicBus.connect(bus);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; noise = nb;
    // bench hum: a soft low chord that swells with the amount of light on the bench
    hum = c.createGain(); hum.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    [[73.42, 'triangle', 0.5], [110, 'sine', 0.3], [146.83, 'sine', 0.16], [220.5, 'sine', 0.05]].forEach(([f, ty, g]) => {
      const o = c.createOscillator(); o.type = ty; o.frequency.value = f; const gg = c.createGain(); gg.gain.value = g; o.connect(gg); gg.connect(lp); o.start();
    });
    lp.connect(hum); hum.connect(bus);
  }
  A.init = function () {
    if (c && !offline) { if (c.state === 'suspended') c.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    build(new AC());
  };
  A.ready = () => !!c && (offline || (A.on && c.state === 'running'));
  // browsers only start audio after a gesture: resume on the first tap anywhere
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (c && !offline && c.state !== 'running') c.resume(); }, true));
  A.setOn = function (b) { A.on = b; store.set('sound', b); if (master) master.gain.setTargetAtTime(b ? 0.85 : 0, now(), 0.05); };
  A.setHum = function (v) { if (hum && !offline && c.state === 'running') hum.gain.setTargetAtTime(v, now(), 0.5); };

  // ---------- voices ----------
  function bellAt(t, f, v, dur, dest) {
    [[1, 1], [2.0, 0.42], [2.76, 0.3], [4.07, 0.14], [5.93, 0.07]].forEach(([r, a], i) => {
      if (f * r > 16000) return;
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * r;
      const d = dur / (1 + i * 0.9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.05);
    });
  }
  A.bell = function (f, v = 0.2, dur = 2.2, delay = 0) { if (A.ready()) bellAt(now() + delay, f, v, dur, bus); };
  A.tick = function () {
    if (!A.ready()) return; const t = now();
    const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 2900;
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.05);
    nz(t, 0.025, 'bandpass', 5200, 2.5, 0.09, bus);
  };
  A.whoosh = function (up = true, v = 0.12) {
    if (!A.ready()) return; const t = now();
    const n = c.createBufferSource(); n.buffer = noise; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(up ? 380 : 2400, t); bp.frequency.exponentialRampToValueAtTime(up ? 2600 : 340, t + 0.26);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(bp); bp.connect(g); g.connect(bus); n.start(t, Math.random() * 0.4); n.stop(t + 0.32);
  };
  A.sparkle = function (n = 10, base = 2600, v = 0.035, delay = 0) {
    if (!A.ready()) return;
    for (let i = 0; i < n; i++) {
      const t = now() + delay + i * 0.04 + Math.random() * 0.03, f = base * (1 + Math.random() * 1.8);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.32);
    }
  };
  A.toneOn = function (id, f) {
    if (!A.ready() || offline || tones[id]) return; const t = now();
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.016, t + 0.6);
    const os = [f, f * 1.0035, f * 2].map((ff, i) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = ff; const gg = c.createGain(); gg.gain.value = i === 2 ? 0.25 : 0.5; o.connect(gg); gg.connect(g); o.start(t); return o; });
    g.connect(bus); tones[id] = { g, os };
  };
  A.toneOff = function (id) {
    const tn = tones[id]; if (!tn) return; delete tones[id];
    const t = now(); tn.g.gain.cancelScheduledValues(t); tn.g.gain.setTargetAtTime(0, t, 0.25); tn.os.forEach(o => o.stop(t + 1.5));
  };
  A.allOff = function () { Object.keys(tones).forEach(A.toneOff); };

  // ---------- beam percussion ----------
  // convert a performance.now() timestamp into audio-clock time, so hits line up with the drawn pulses
  A.at = (ms) => c ? Math.max(c.currentTime, c.currentTime + (ms - performance.now()) / 1000) : 0;
  function voice(pan, dest = bus) {
    const g = c.createGain(); let node = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-0.8, Math.min(0.8, pan)); g.connect(p); node = p; }
    node.connect(dest); return g;
  }
  function decay(g, t, peak, d) { g.gain.setValueAtTime(Math.max(peak, 0.0002), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); }
  function nz(t, d, type, f, q, peak, dest, fEnd) {
    const n = c.createBufferSource(); n.buffer = noise; const bf = c.createBiquadFilter(); bf.type = type; bf.frequency.setValueAtTime(f, t); bf.Q.value = q;
    if (fEnd) bf.frequency.exponentialRampToValueAtTime(fEnd, t + d);
    const g = c.createGain(); decay(g, t, peak, d); n.connect(bf); bf.connect(g); g.connect(dest); n.start(t, Math.random() * 0.8); n.stop(t + d + 0.03);
  }
  function tone(t, d, type, f, peak, dest, fEnd) {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + d * 0.7);
    const g = c.createGain(); decay(g, t, peak, d); o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + 0.03);
  }
  const HITS = {
    emit(t, v, o) { tone(t, 0.16, 'sine', 120, 0.3 * v, o, 46); nz(t, 0.006, 'highpass', 2000, 0.7, 0.05 * v, o); },          // pulse leaves the source
    mirror(t, v, o) { nz(t, 0.045, 'highpass', 7200, 0.8, 0.11 * v, o); tone(t, 0.03, 'square', 5400, 0.012 * v, o); },      // closed hat
    split(t, v, o) { HITS.mirror(t, v, o); HITS.mirror(t + 0.028, v * 0.6, o); },                                         // flam: half bounces, half passes
    lens(t, v, o) { tone(t, 0.07, 'sine', 1500, 0.16 * v, o, 1080); nz(t, 0.012, 'bandpass', 2300, 4, 0.08 * v, o); },        // glassy tok
    cmirror(t, v, o) { tone(t, 0.045, 'triangle', 1750, 0.1 * v, o); nz(t, 0.035, 'bandpass', 3000, 1.5, 0.1 * v, o); },      // rimshot
    glassIn(t, v, o) { tone(t, 0.05, 'sine', 3300, 0.06 * v, o); },
    glassOut(t, v, o) { tone(t, 0.05, 'sine', 2700, 0.055 * v, o); },
    tir(t, v, o) { tone(t, 0.08, 'sine', 4200, 0.06 * v, o); tone(t, 0.05, 'sine', 6300, 0.025 * v, o); },                  // trapped by total internal reflection
    fiberTir(t, v, o) { nz(t, 0.016, 'bandpass', 6500, 3, 0.05 * v, o); },                                                 // light rattling down a fiber
    disperse(t, v, o) { for (let i = 0; i < 3; i++) nz(t + i * 0.03, 0.04, 'bandpass', 5500 + i * 1200, 2, 0.06 * v, o); [4400, 5600, 7000].forEach((f, i) => tone(t + 0.02 + i * 0.03, 0.12, 'sine', f, 0.018 * v, o)); },  // shaker + sparkle
    retro(t, v, o) { tone(t, 0.07, 'sine', 800, 0.09 * v, o, 1700); },                                                     // cat's eye sends it home
    target(t, v, o) { tone(t, 0.24, 'sine', 155, 0.34 * v, o, 62); nz(t, 0.01, 'highpass', 1500, 0.7, 0.05 * v, o); },        // kick into the photocell
    wall(t, v, o) { nz(t, 0.08, 'lowpass', 520, 0.8, 0.16 * v, o); tone(t, 0.06, 'sine', 115, 0.1 * v, o); },                 // muffled thud, light absorbed
    edge(t, v, o) { nz(t, 0.3, 'bandpass', 3200, 1.2, 0.045 * v, o, 650); },                                               // leaves the bench and fades
    fade(t, v, o) { nz(t, 0.25, 'bandpass', 2600, 1.2, 0.03 * v, o, 600); },
  };
  A.hit = function (type, vel, pan, t) {
    if (!A.ready() || !HITS[type]) return;
    HITS[type](Math.max(t, c.currentTime), Math.min(1, vel), voice(pan));
  };

  // ---------- music ----------
  // glassy pluck: triangle + a quiet octave, through a low-pass that closes as it rings
  function pluck(t, f, v, dest, len = 0.4) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + len); lp.Q.value = 0.8;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(g); g.connect(dest);
    [['triangle', f, 1], ['sine', f * 2.003, 0.3]].forEach(([ty, ff, a]) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = ff; const gg = c.createGain(); gg.gain.value = a; o.connect(gg); gg.connect(lp); o.start(t); o.stop(t + len + 0.05); });
  }
  // warm pad note: sine + slightly detuned triangle + soft octave, slow swell and release (no vocal timbre)
  function padNote(t, f, dur, v, dest) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.7, dur * 0.4));
    g.gain.setValueAtTime(v, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    lp.connect(g); g.connect(dest);
    [['sine', f, 1], ['triangle', f * 1.003, 0.45], ['sine', f * 2, 0.12]].forEach(([ty, ff, a]) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = ff; const gg = c.createGain(); gg.gain.value = a; o.connect(gg); gg.connect(lp); o.start(t); o.stop(t + dur + 1); });
  }
  function bass(t, f, dur, v, dest) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(v * 0.5, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(dest);
    [['sine', f, 1], ['triangle', f, 0.35]].forEach(([ty, ff, a]) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = ff; const gg = c.createGain(); gg.gain.value = a; o.connect(gg); gg.connect(lp); o.start(t); o.stop(t + dur + 0.05); });
  }

  // chords as MIDI notes, lowest first
  const CH = {
    Dmaj9: [50, 57, 61, 64, 66], Bm9: [47, 54, 57, 61, 62], Gmaj9: [43, 50, 54, 57, 59], Asus: [45, 52, 57, 59, 62],
    A: [45, 52, 57, 61, 64], Fsm7: [42, 49, 52, 57, 61], Em9: [40, 47, 54, 55, 59], Cmaj7s11: [36, 43, 52, 54, 59], D69: [38, 45, 54, 59, 64], Gmaj7: [43, 50, 54, 59, 62],
  };
  const TRACKS = {
    // title theme, 112 BPM like the light drum machine: 2 bars of pads and arpeggio, then bass and drums, then a bell melody
    title: {
      bpm: 112, bars: 16,
      chords: ['Dmaj9', 'Bm9', 'Gmaj9', 'Asus', 'Dmaj9', 'Bm9', 'Gmaj9', 'A', 'Gmaj9', 'A', 'Fsm7', 'Bm9', 'Gmaj9', 'A', 'Dmaj9', 'Asus'],
      melody: { 8: [[0, 78, 4], [6, 76, 2], [10, 74, 4]], 9: [[0, 73, 4], [8, 76, 6]], 10: [[0, 81, 4], [6, 78, 2], [10, 76, 4]], 11: [[0, 74, 8]],
                12: [[0, 79, 4], [6, 78, 2], [10, 76, 4]], 13: [[0, 76, 4], [8, 73, 4], [12, 76, 4]], 14: [[0, 74, 10]], 15: [[8, 69, 4], [12, 73, 4]] },
      step(bar, s, t, sp, out) {
        const ch = CH[this.chords[bar]];
        if (s === 0) ch.forEach((m, i) => padNote(t, mtof(m + 12 * (i < 2 ? 0 : 0)), sp * 16, 0.028, out));
        const arp = [2, 3, 4, 3, 1, 2, 4, 2, 3, 4, 2, 3, 1, 4, 3, 2];
        pluck(t, mtof(ch[arp[s]] + 12 + (s % 8 === 6 ? 12 : 0)), s % 4 === 0 ? 0.045 : 0.026, out, 0.26);
        if (bar >= 2) {
          if (s === 0 || s === 10) bass(t, mtof(ch[0] - 12), sp * (s === 0 ? 7 : 5), 0.2, out);
          if (s === 0 || s === 8 || (bar >= 8 && s === 11)) HITS.emit(t, 0.8, voice(0, out));
          if (s === 4 || s === 12) HITS.cmirror(t, 0.75, voice(0.1, out));
          if (s % 2 === 0) HITS.mirror(t, s % 4 === 2 ? 0.7 : 0.4, voice(-0.25, out));
          else if (bar >= 8) HITS.fiberTir(t, 0.6, voice(0.3, out));
        }
        const mel = this.melody[bar];
        if (mel) for (const [ms, m, len] of mel) if (ms === s) bellAt(t, mtof(m), 0.085, sp * len * 1.6, out);
      },
    },
    // bench picker: slower and calmer, no kick, sparse bells
    menu: {
      bpm: 84, bars: 8,
      chords: ['Gmaj7', 'Em9', 'Cmaj7s11', 'D69', 'Gmaj7', 'Em9', 'Cmaj7s11', 'D69'],
      bells: { 0: [[0, 79], [8, 74]], 1: [[4, 76]], 2: [[0, 78], [10, 76]], 3: [[6, 74]], 4: [[0, 83], [8, 79]], 5: [[4, 78]], 6: [[0, 76], [10, 74]], 7: [[2, 69], [8, 74]] },
      step(bar, s, t, sp, out) {
        const ch = CH[this.chords[bar]];
        if (s === 0) { ch.forEach(m => padNote(t, mtof(m), sp * 16, 0.03, out)); bass(t, mtof(ch[0] - 12), sp * 12, 0.15, out); }
        if (s % 2 === 0) { const arp = [1, 2, 3, 4, 3, 2, 4, 3]; pluck(t, mtof(ch[arp[s / 2]] + 12), 0.04, out, 0.6); }
        if (s % 4 === 2) HITS.fiberTir(t, 0.5, voice(0.2, out));
        if (s === 12) HITS.glassIn(t, 0.7, voice(-0.2, out));
        for (const [bs, m] of this.bells[bar] || []) if (bs === s) bellAt(t, mtof(m), 0.06, 2.6, out);
      },
    },
  };
  // schedule one 16th step of a track
  function trackStep(tr, i, t, out) { const sp = 60 / tr.bpm / 4, n = tr.bars * 16, k = ((i % n) + n) % n; tr.step(Math.floor(k / 16), k % 16, t, sp, out); }

  const M = { name: null, out: null, i: 0, next: 0, timer: null };
  A.music = function (name) {
    if (!c || offline) { M.want = name; return; }
    if (M.name === name) return;
    const t = c.currentTime;
    if (M.out) { const o = M.out; o.gain.cancelScheduledValues(t); o.gain.setTargetAtTime(0, t, 0.35); setTimeout(() => o.disconnect(), 3000); }
    clearInterval(M.timer); M.name = name; M.out = null;
    if (!name) return;
    const tr = TRACKS[name], sp = 60 / tr.bpm / 4;
    const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(1, t + 1.2); out.connect(musicBus);
    M.out = out; M.i = 0; M.next = t + 0.08;
    const tick = () => { while (M.next < c.currentTime + 0.3) { trackStep(tr, M.i, M.next, out); M.i++; M.next += sp; } };
    tick(); M.timer = setInterval(tick, 60);
  };
  A.musicWanted = () => M.want;

  // ---------- the Jalapeño Seed Productions sting ----------
  // a beam strikes a seed (kick + ping), sparkle rises as the pepper draws itself, then a warm Dmaj9 blooms
  A.sting = function (delay = 0) {
    if (!A.ready()) return; const t = now() + delay, o = voice(0);
    HITS.emit(t, 1, o); bellAt(t, 1760, 0.12, 1.6, bus);
    for (let i = 0; i < 16; i++) { const tt = t + 0.15 + i * 0.07 + Math.random() * 0.03; tone(tt, 0.25, 'sine', 2600 + i * 180 + Math.random() * 600, 0.025, bus); }
    const tc = t + 1.25;
    [50, 57, 61, 64, 66, 69, 73].forEach((m, i) => bellAt(tc + i * 0.06, mtof(m + 12), 0.09, 3.2, bus));
    CH.Dmaj9.forEach(m => padNote(tc, mtof(m), 2.4, 0.035, bus));
    bass(tc, mtof(38), 2.8, 0.25, bus);
  };

  // the game's events, voiced the original way
  A.ting = (f) => A.bell(f, 0.05, 1.4);
  A.place = (f) => { A.bell(f * 2, 0.07, 0.5); A.tick(); };
  A.ratchet = () => A.tick();
  A.select = () => A.tick();
  A.key = () => {};
  A.release = () => A.whoosh(true, 0.06);
  A.stow = () => A.whoosh(false, 0.08);
  A.charge = (id, f) => { A.bell(f, 0.2, 2.6); A.toneOn(id, f / 2); };
  A.discharge = (id) => A.toneOff(id);
  A.hint = () => A.bell(1760, 0.06, 1);
  A.nudge = () => A.bell(1760, 0.03, 1);
  A.setLight = (light, busy, quiet) => A.setHum(quiet ? 0.0 : 0.05 + 0.05 * busy);
  // every cell lit: a short phrase in the title theme's own voices, on its 112 BPM grid, kept gentle
  A.win = () => {
    if (!A.ready()) return;
    const t = now() + 0.04, sp = 60 / 112 / 4, out = c.createGain(); out.gain.value = 0.75; out.connect(bus);
    [[0, 74], [2, 78], [4, 81], [6, 86], [10, 85], [12, 81]].forEach(([s, m], i) => pluck(t + s * sp, mtof(m), i === 3 ? 0.05 : 0.04, out, 0.5));
    CH.Dmaj9.forEach(m => padNote(t, mtof(m + 12), sp * 14, 0.012, out));
    bass(t, mtof(38), sp * 12, 0.09, out);
    bellAt(t + sp * 6, mtof(90), 0.035, 2.2, out);
    for (let i = 0; i < 6; i++) tone(t + sp * (7 + i * 1.3), 0.25, 'sine', 4200 + i * 420, 0.01, out);
  };

  // ---------- offline render (trailer soundtrack) ----------
  // events: [{ fn, args, t }] replayed at time t (seconds); music: [{ name, from, to }]; returns a WAV as base64
  A.renderOffline = async function ({ duration, events = [], music = [], sampleRate = 44100 }) {
    const saved = { c, master, bus, noise, hum, musicBus };
    offline = true;
    const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
    build(ctx);
    for (const m of music) {
      const tr = TRACKS[m.name], sp = 60 / tr.bpm / 4, out = c.createGain();
      const f0 = Math.max(0, m.from);
      out.gain.setValueAtTime(m.from < 0 ? 1 : 0.0001, f0); if (m.from >= 0) out.gain.exponentialRampToValueAtTime(1, m.from + 0.8);
      out.gain.setValueAtTime(1, Math.max(m.from + 0.9, m.to - 1.2)); out.gain.exponentialRampToValueAtTime(0.0001, m.to);
      const duck = c.createGain(); out.connect(duck); duck.connect(musicBus);
      const gs = m.gains || [], before = gs.filter(([t]) => t <= 0).pop();
      duck.gain.setValueAtTime(before ? before[1] : (gs[0] ? gs[0][1] : 1), 0);
      gs.filter(([t]) => t > 0).forEach(([t, g]) => duck.gain.linearRampToValueAtTime(g, t));
      for (let i = 0, t = m.from; t < m.to; i++, t += sp) if (t >= 0) trackStep(tr, i, t, out);   // a negative start picks the track up mid-way
    }
    for (const e of events) { forced = e.t; try { A[e.fn](...(e.args || [])); } catch (err) { console.warn(err); } }
    forced = null;
    const buf = await ctx.startRendering();
    ({ c, master, bus, noise, hum, musicBus } = saved); offline = false;
    // 16-bit PCM WAV
    const n = buf.length, ch = 2, bytes = 44 + n * ch * 2, dv = new DataView(new ArrayBuffer(bytes));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0, o = 44; i < n; i++) for (const s of [L[i], R[i]]) { dv.setInt16(o, Math.max(-1, Math.min(1, s)) * 32767, true); o += 2; }
    let bin = ''; const u8 = new Uint8Array(dv.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  return A;
})();
