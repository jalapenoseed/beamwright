// ===== Game core: state, sequencer, level flow =====
// (bundled with game-input.js, game-draw.js, game-ui.js, maker.js, community.js
//  and boot.js inside one scope by tools/build.js; keep the order in build.js)
const $ = s => document.querySelector(s);
const stage = $('#stage');
const cv = $('#cv'), ctx = cv.getContext('2d');          // objects layer (premultiplied, over the table)
const bv = $('#bv'), bctx = bv.getContext('2d');         // light layer (additive, feeds the bloom)
const RAD = Math.PI / 180;
const FONT_MONO = '"B612 Mono", ui-monospace, monospace', FONT_SANS = '"B612", "Segoe UI", Roboto, sans-serif';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('beamwright.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('beamwright.' + k, JSON.stringify(v)); } catch (e) {} },
};

LEVELS.forEach((lv, i) => {
  const s = SOLS[i];
  lv.sol = lv.handSol || (s && s.sol) || [];
  lv.par = lv.handSol ? lv.handSol.length : (s && s.par) || Object.values(lv.inv).reduce((a, b) => a + b, 0);
});

const ALL_INV = {}; PIECE_ORDER.forEach(t => ALL_INV[t] = Infinity);
const SANDBOX = {
  name: 'Free Bench', w: 11, h: 7, sandbox: true,
  tip: 'Unlimited parts. Build anything. The photocells are just for fun.',
  sources: [{ x: 0, y: 3, a: 0 }, { x: 0, y: 6, a: 0, color: 'B' }],
  targets: [{ x: 10, y: 0, need: 30 }, { x: 10, y: 6, need: 30 }, { x: 5, y: 0, need: 5, color: 'R', r: 0.36 }],
  walls: [], inv: ALL_INV, sol: [], par: 0,
  mirage: [{ x: 6, y: 5, w: 4, h: 2, k: 0.5 }],
};
const DEMO = {
  name: 'demo', w: 11, h: 7,
  sources: [{ x: 0, y: 2, a: 0 }],
  targets: [], walls: [],
  fixed: [{ type: 'convex', x: 3, y: 2, a: 90 }, { type: 'prism', x: 5, y: 2, a: 0 }],
};
const DEFAULT_A = { mirror: 135, splitter: 135, convex: 90, concave: 90, cmirror: 90, xmirror: 90, block: 90, prism: 0, dblock: 0, cateye: 0, droplet: 0, diamond: 270, fiber: 0, bend: 0 };
// each part rings at its own pitch, all inside D major pentatonic
// each part rings at its own pitch, all inside D major pentatonic
const NOTE = { mirror: 880, cmirror: 739.99, xmirror: 659.26, convex: 1174.66, concave: 987.77, block: 587.33, prism: 1318.51, splitter: 1479.98, dblock: 493.88, cateye: 1975.53, droplet: 2349.32, diamond: 2959.96, fiber: 440, bend: 554.37 };
const SPARKLY = { prism: 1, droplet: 1, diamond: 1 };
const TNOTE = [1174.66, 1479.98, 1760, 2349.32];
const CHAPTERS = {
  1: { numeral: 'I', name: 'The Bench' },
  2: { numeral: 'II', name: 'Exotic Optics' },
  3: { numeral: 'III', name: 'Masterworks' },
};
const IDLE_MS = 15000;   // how long without a move before the hint key glows

// ---------- the light sequencer ----------
// Sources fire a pulse of light on the downbeat. It travels one cell per 16th note, so the shape of the
// light path becomes the rhythm: every place a ray meets something is a drum hit at that step.
const BPM = 112, STEP_MS = 60000 / BPM / 4;
const SEQ = { steps: 16, byStep: [], sig: '', loopStart: performance.now(), nextStep: 0, nextTime: performance.now() };
function buildPattern(res) {
  const L = S.level, acc = new Map();
  const add = (step, type, I, x, y) => {
    const k = step + '|' + type; const e = acc.get(k) || { step, type, I: 0, x: 0, y: 0, n: 0 };
    e.I += I; e.x += x; e.y += y; e.n++; acc.set(k, e);
  };
  L.sources.forEach(s => add(0, 'emit', 1, s.x + 0.5, s.y + 0.5));
  let maxStep = 0;
  for (const g of res.segs) {
    if (!g.ev) continue;
    const step = Math.max(1, Math.round(g.d1));
    if (step > 47) continue;
    add(step, g.ev, g.I, g.x2, g.y2); maxStep = Math.max(maxStep, step);
  }
  const steps = maxStep + 2 <= 8 ? 8 : Math.min(48, Math.ceil((maxStep + 2) / 16) * 16);   // short paths loop every half bar
  const byStep = Array.from({ length: steps }, () => []);
  for (const e of acc.values()) {
    const vel = e.type === 'emit' ? 0.9 : Math.min(1, Math.sqrt(e.I / 0.4));
    if (vel < 0.07 || e.step >= steps) continue;
    byStep[e.step].push({ type: e.type, vel, pan: panOf(e.x / e.n, e.y / e.n) });
  }
  const sig = steps + ':' + [...acc.keys()].sort().join(',');
  return { steps, byStep, sig };
}
function restartLoop() {
  let now = performance.now() + 25;
  // when filming the trailer, pulses snap to the soundtrack's beat grid
  const al = window.__bwAlign; if (al) { const g = STEP_MS * (al.every || 1); now = al.origin + Math.ceil((now - al.origin) / g) * g; }
  SEQ.loopStart = now; SEQ.nextTime = now; SEQ.nextStep = 0;
}
function seqTick(now) {
  // keep the loop clock running even when silent, so the pulses keep travelling
  while (SEQ.nextTime < now + 110) {
    const st = SEQ.nextStep;
    if (S.screen === 'play' && AU.ready()) {
      const duck = !$('#win').hidden || !$('#levels').hidden ? 0.45 : 1;
      for (const e of SEQ.byStep[st] || []) AU.hit(e.type, e.vel * duck, e.pan, AU.at(SEQ.nextTime));
    }
    SEQ.nextStep = (st + 1) % SEQ.steps; SEQ.nextTime += STEP_MS;
    if (SEQ.nextStep === 0) SEQ.loopStart = SEQ.nextTime;
  }
}
setInterval(() => seqTick(performance.now()), 40);

// ---------- state ----------
const progress = store.get('progress', {});
const S = {
  screen: 'title', li: 0, level: DEMO, placed: [], inv: {}, uid: 1,
  sel: null, armed: null, drag: null, press: null, rot: null,
  res: null, dirty: true, hint: 0, winAt: 0, winShown: false,
  litT: [], litP: {}, cool: {}, pointer: null, demoT: 0, titleT0: 0, lastAct: 0, nudging: false,
};

// ---------- view ----------
const V = { cell: 40, ox: 0, oy: 0, rot: false, w: 0, h: 0, left: 0, top: 0 };
let DPR = 1, statics = null;
function layout() {
  const r = stage.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  for (const c of [cv, bv]) { c.width = Math.max(1, Math.round(r.width * DPR)); c.height = Math.max(1, Math.round(r.height * DPR)); }
  V.w = r.width; V.h = r.height; V.left = r.left; V.top = r.top;
  const L = S.level;
  V.rot = r.height > r.width * 1.15 && L.w > L.h;
  const cols = V.rot ? L.h : L.w, rows = V.rot ? L.w : L.h;
  V.cell = Math.max(10, Math.min(r.width / (cols + 0.5), (r.height - 18) / (rows + 0.6)));
  const cinematic = S.screen === 'title' || S.screen === 'gate' || S.screen === 'ident';
  if (cinematic) V.cell = Math.max(r.width / cols, r.height / rows);
  V.bw = cols * V.cell; V.bh = rows * V.cell;
  V.ox = (r.width - V.bw) / 2; V.oy = (r.height - V.bh) / 2 - (cinematic ? 0 : 4);
  statics = null;
}
function w2s(x, y) { return V.rot ? [V.ox + (S.level.h - y) * V.cell, V.oy + x * V.cell] : [V.ox + x * V.cell, V.oy + y * V.cell]; }
function s2w(sx, sy) { return V.rot ? [(sy - V.oy) / V.cell, S.level.h - (sx - V.ox) / V.cell] : [(sx - V.ox) / V.cell, (sy - V.oy) / V.cell]; }
function setWorld(g) { const c = V.cell * DPR; if (V.rot) g.setTransform(0, c, -c, 0, (V.ox + S.level.h * V.cell) * DPR, V.oy * DPR); else g.setTransform(c, 0, 0, c, V.ox * DPR, V.oy * DPR); }
function setScreen(g) { g.setTransform(DPR, 0, 0, DPR, 0, 0); }
function panOf(wx, wy) { const [sx] = w2s(wx, wy); return ((V.left + sx) / innerWidth) * 1.6 - 0.8; }

// ---------- level control ----------
function occupiedBy(x, y, ignoreUid) {
  const L = S.level;
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return 'out';
  if ((L.walls || []).some(([a, b]) => a === x && b === y)) return 'wall';
  if (L.sources.some(s => s.x === x && s.y === y)) return 'source';
  if (L.targets.some(t => t.x === x && t.y === y)) return 'target';
  if ((L.fixed || []).some(p => p.x === x && p.y === y)) return 'fixed';
  if ((L.mirage || []).some(m => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h)) return 'zone';
  if (S.placed.some(p => p.x === x && p.y === y && p.uid !== ignoreUid)) return 'piece';
  return null;
}
// i >= 0: campaign bench; -1: free bench; -2: a bench from the maker, passed in as `custom`;
// -4: community bench number S.ci (community.js)
function loadLevel(i, keep, custom) {
  AU.allOff();
  if (i === -2) { custom = custom || S.testLevel; S.testLevel = custom; }
  if (i === -4) custom = custom || communityLevel(S.ci);
  S.li = i; S.level = i === -2 || i === -4 ? custom : i < 0 ? SANDBOX : LEVELS[i];
  S.placed = keep ? keep.map(p => ({ ...p, uid: S.uid++ })) : [];
  S.inv = { ...S.level.inv };
  for (const p of S.placed) if (S.inv[p.type] !== Infinity) S.inv[p.type]--;
  S.sel = null; S.armed = null; S.drag = null; S.hint = 0; S.winAt = 0; S.winShown = false;
  S.litT = []; S.litP = {}; S.dirty = true;
  if (i >= 0) store.set('last', i);
  S.lastAct = performance.now();
  layout(); buildParts(); updateHeader(); updateStatus();
}
function updateHeader() {
  const L = S.level;
  $('#lvlNum').textContent = S.li === -2 ? 'TEST' : S.li === -4 ? 'C' + String(S.ci + 1).padStart(2, '0') : S.li < 0 ? 'LAB' : String(S.li + 1).padStart(2, '0');
  $('#lvlName').textContent = L.name;
  $('#lvlPar').textContent = S.li === -1 ? '' : `${S.placed.length} placed${L.par ? ' / par ' + L.par : ''}${S.li === -4 ? ' · by ' + L.author : ''}`;
  $('#hintBtn').hidden = !(L.sol && L.sol.length);
  $('#hintTxt').textContent = S.hint ? `hint ${S.hint}/${L.sol.length}` : 'hint';
  $('#soundBtn').setAttribute('aria-pressed', AU.on ? 'true' : 'false');
}

