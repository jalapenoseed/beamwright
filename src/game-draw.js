// ===== Game drawing: bench, beams, pieces, sources, cells, labels =====
// (same IIFE scope as game.js; see tools/build.js for order)
// ---------- drawing: shared helpers ----------
function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// static parts of the bench (walls, hot plate, edge scale) cached in their own transparent canvas
function drawStatics() {
  const L = S.level;
  statics = document.createElement('canvas'); statics.width = cv.width; statics.height = cv.height;
  const g = statics.getContext('2d');
  if (!GLR.ok) {
    // no shader table: paint a plain breadboard so the game still reads
    setScreen(g); g.fillStyle = '#1d2025'; g.fillRect(0, 0, V.w, V.h);
    setWorld(g); g.fillStyle = '#2a2e35'; g.fillRect(0, 0, L.w, L.h);
    g.fillStyle = '#121418';
    for (let x = 0; x < L.w; x++) for (let y = 0; y < L.h; y++) { g.beginPath(); g.arc(x + 0.5, y + 0.5, 0.075, 0, 7); g.fill(); }
  }
  setWorld(g);
  for (const m of L.mirage || []) {
    const hz = g.createLinearGradient(0, m.y + m.h, 0, m.y);
    hz.addColorStop(0, 'rgba(255,110,40,0.14)'); hz.addColorStop(0.5, 'rgba(255,110,40,0.04)'); hz.addColorStop(1, 'rgba(255,110,40,0)');
    g.fillStyle = hz; g.fillRect(m.x, m.y, m.w, m.h);
    const pg = g.createLinearGradient(0, m.y + m.h - 0.14, 0, m.y + m.h);
    pg.addColorStop(0, '#ff9a55'); pg.addColorStop(0.4, '#c25a2c'); pg.addColorStop(1, '#4a1d0c');
    g.fillStyle = pg; g.fillRect(m.x + 0.03, m.y + m.h - 0.13, m.w - 0.06, 0.12);
  }
  // beam blocks: blackened steel with a machined top
  for (const [x, y] of L.walls || []) {
    g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, x + 0.09, y + 0.14, 0.88, 0.88, 0.06); g.fill();
    const wg = g.createLinearGradient(x, y, x + 1, y + 1); wg.addColorStop(0, '#596b80'); wg.addColorStop(1, '#263445');
    g.fillStyle = wg; rr(g, x + 0.06, y + 0.06, 0.88, 0.88, 0.06); g.fill();
    g.strokeStyle = 'rgba(215,235,255,0.65)'; g.lineWidth = 1 / V.cell; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.035)'; g.beginPath();
    for (let k = 0.2; k < 0.9; k += 0.12) { g.moveTo(x + 0.14, y + k + 0.06); g.lineTo(x + 0.86, y + k + 0.06); }
    g.stroke();
    g.fillStyle = '#07080a'; for (const [ax, ay] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) { g.beginPath(); g.arc(x + ax, y + ay, 0.035, 0, 7); g.fill(); }
  }
  for (const q of L.gates || []) {
    g.fillStyle = '#12171d'; g.strokeStyle = '#71808b'; g.lineWidth = 0.018;
    for (const [y,h] of [[0,q.y+0.5-q.gap],[q.y+0.5+q.gap,L.h-q.y-0.5-q.gap]]) {
      g.fillRect(q.x+0.46,y,0.08,h); g.strokeRect(q.x+0.46,y,0.08,h);
    }
    g.fillStyle = '#ffcf7f';
    g.fillRect(q.x+0.37,q.y+0.5-q.gap-0.025,0.26,0.025);
    g.fillRect(q.x+0.37,q.y+0.5+q.gap,0.26,0.025);
  }
  // engraved scale along two edges, like a real breadboard
  if (S.screen === 'play' && V.cell >= 40) {
    setScreen(g);
    g.font = `${Math.max(9, Math.min(11, V.cell * 0.13))}px ${FONT_MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(240,246,255,0.9)';
    for (let x = 0; x < L.w; x++) { const [sx, sy] = w2s(x + 0.5, -0.001); g.fillText(String.fromCharCode(65 + x), V.rot ? sx + 9 : sx, V.rot ? sy : sy - 9); }
    for (let y = 0; y < L.h; y++) { const [sx, sy] = w2s(-0.001, y + 0.5); g.fillText(String(y + 1), V.rot ? sx : sx - 10, V.rot ? sy - 9 : sy); }
  }
}

function drawBeams(t) {
  const segs = S.res ? S.res.segs : []; if (!segs.length) return;
  setWorld(bctx); bctx.globalCompositeOperation = 'lighter'; bctx.lineCap = 'round';
  const passes = GLR.ok ? [[0.07, 0.16], [0.022, 0.95]] : [[0.17, 0.045], [0.075, 0.13], [0.024, 0.9]];
  passes.forEach(([w, al], pi) => {
    bctx.lineWidth = w;
    for (const s of segs) {
      const rgb = SPEC[s.c].rgb, a = Math.min(1, Math.sqrt(s.I / 0.2)) * (reduceMotion ? 1 : 1 + 0.07 * Math.sin(t * 0.003 + s.k * 1.9 + pi));
      let col = rgb;
      if (pi === passes.length - 1) col = rgb.map(v => Math.round(v + (255 - v) * 0.55));
      bctx.strokeStyle = rgba(col, al * a);
      bctx.beginPath(); bctx.moveTo(s.x1, s.y1); bctx.lineTo(s.x2, s.y2); bctx.stroke();
    }
  });
}
const sparks = [];
function stepSparks(dt) {
  if (reduceMotion || !S.res || !sparkTotal) { sparks.length = 0; return; }
  const segs = S.res.segs;
  for (let k = 0; k < 2 && sparks.length < 70; k++) {
    const r = Math.random() * sparkTotal; const i = sparkCum.findIndex(v => v >= r); if (i < 0) continue;
    const s = segs[i], L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); if (L < 0.05) continue;
    sparks.push({ s, u: Math.random(), v: 2.6 / L, life: 0.5 + Math.random() * 0.5, age: 0 });
  }
  for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.u += p.v * dt; p.age += dt; if (p.u > 1 || p.age > p.life || !segs.includes(p.s)) sparks.splice(i, 1); }
}
function drawSparks() {
  setWorld(bctx); bctx.globalCompositeOperation = 'lighter';
  for (const p of sparks) {
    const s = p.s, x = s.x1 + (s.x2 - s.x1) * p.u, y = s.y1 + (s.y2 - s.y1) * p.u;
    const a = Math.sin(Math.PI * p.age / p.life) * Math.min(1, Math.sqrt(s.I / 0.2));
    bctx.fillStyle = rgba(SPEC[s.c].rgb, 0.22 * a); bctx.beginPath(); bctx.arc(x, y, 0.03, 0, 7); bctx.fill();
    bctx.fillStyle = `rgba(255,250,235,${0.7 * a})`; bctx.beginPath(); bctx.arc(x, y, 0.011, 0, 7); bctx.fill();
  }
}
// pulses: a bright packet of light running along every ray, in time with the beat
function drawPulses(t) {
  const segs = S.res ? S.res.segs : []; if (!segs.length || reduceMotion) return;
  let d = (t - SEQ.loopStart) / STEP_MS; if (d < 0) d += SEQ.steps;
  setWorld(bctx); bctx.globalCompositeOperation = 'lighter';
  for (const s of segs) {
    if (d < s.d0 || d > s.d1 + 0.001 || s.d1 - s.d0 < 1e-6) continue;
    const a = Math.min(1, Math.sqrt(s.I / 0.2)), rgb = SPEC[s.c].rgb;
    for (let k = 0; k < 5; k++) {
      const dk = d - k * 0.09; if (dk < s.d0) break;
      const u = (dk - s.d0) / (s.d1 - s.d0), x = s.x1 + (s.x2 - s.x1) * u, y = s.y1 + (s.y2 - s.y1) * u;
      const fall = 1 - k / 5;
      if (k === 0) { bctx.fillStyle = rgba(rgb, 0.22 * a); bctx.beginPath(); bctx.arc(x, y, 0.11, 0, 7); bctx.fill(); }
      bctx.fillStyle = rgba(rgb.map(v => Math.round(v + (255 - v) * 0.65)), Math.min(1, 1.1 * a * fall));
      bctx.beginPath(); bctx.arc(x, y, 0.05 * (0.55 + 0.45 * fall), 0, 7); bctx.fill();
    }
  }
}
// ---------- the Jalapeño Seed Productions ident ----------
// A beam crosses the bench and strikes a seed; a jalapeño traces itself in light around it; the name glows in.
const IDENT_MS = 4600;
function bez(p0, p1, p2, p3, n, out) { for (let i = 1; i <= n; i++) { const u = i / n, v = 1 - u; out.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]); } }
const PEPPER = (() => {
  const body = [[-0.22, -0.48]];
  bez([-0.22, -0.48], [-0.05, -0.62], [0.15, -0.62], [0.26, -0.52], 14, body);
  bez([0.26, -0.52], [0.42, -0.2], [0.42, 0.15], [0.3, 0.35], 18, body);
  bez([0.3, 0.35], [0.22, 0.55], [0.12, 0.72], [0.05, 0.78], 12, body);
  bez([0.05, 0.78], [0.0, 0.8], [-0.06, 0.72], [-0.06, 0.62], 8, body);
  bez([-0.06, 0.62], [-0.08, 0.2], [-0.32, -0.1], [-0.22, -0.48], 20, body);
  const stem = [[0.02, -0.58]];
  bez([0.02, -0.58], [0.0, -0.68], [0.0, -0.78], [0.05, -0.82], 8, stem);
  bez([0.05, -0.82], [0.1, -0.88], [0.16, -0.92], [0.22, -0.9], 8, stem);
  const len = pts => pts.reduce((a, p, i) => i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
  return { body, stem, bodyLen: len(body), stemLen: len(stem) };
})();
function strokePartial(g, pts, frac, map) {
  let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * frac; g.beginPath(); g.moveTo(...map(pts[0]));
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= left) { g.lineTo(...map(pts[i])); left -= d; }
    else { const u = left / d; g.lineTo(...map([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u])); left = 0; }
  }
  g.stroke();
}
function drawIdent(t) {
  const e = t - S.identT0, g = bctx; setScreen(g); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
  const u = Math.min(V.w, V.h) * 0.2, cx = V.w / 2, cy = V.h * 0.42;
  const fadeOut = 1 - Math.max(0, Math.min(1, (e - 3800) / 700));
  const map = p => [cx + p[0] * u, cy + p[1] * u];
  const seed = map([0.04, 0.08]);
  // the beam arriving from the left edge
  const k = Math.min(1, e / 650), ease = 1 - Math.pow(1 - k, 2);
  const beamFade = Math.max(0, 1 - Math.max(0, e - 900) / 900) * fadeOut;
  if (beamFade > 0) {
    const hx = seed[0] * ease;
    for (const [w, a] of [[10, 0.1], [4, 0.3], [1.6, 0.95]]) { g.lineWidth = w; g.strokeStyle = `rgba(255,214,140,${a * beamFade})`; g.beginPath(); g.moveTo(0, seed[1]); g.lineTo(hx, seed[1]); g.stroke(); }
  }
  if (e < 650) return;
  // strike flash
  const fl = Math.max(0, 1 - (e - 650) / 500);
  if (fl > 0) { const rg = g.createRadialGradient(seed[0], seed[1], 0, seed[0], seed[1], u * 0.9); rg.addColorStop(0, `rgba(255,240,200,${0.9 * fl})`); rg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = rg; g.beginPath(); g.arc(seed[0], seed[1], u * 0.9, 0, 7); g.fill(); }
  // the seed
  g.fillStyle = `rgba(255,210,120,${0.85 * fadeOut})`; g.beginPath(); g.ellipse(seed[0], seed[1], u * 0.045, u * 0.07, -0.4, 0, 7); g.fill();
  // the pepper drawing itself in green light, then the stem
  const p = Math.max(0, Math.min(1, (e - 700) / 1300)), pe = 1 - Math.pow(1 - p, 2.4);
  const ps = Math.max(0, Math.min(1, (e - 1700) / 500));
  const shimmer = reduceMotion ? 1 : 0.9 + 0.1 * Math.sin(e * 0.006);
  for (const [w, a] of [[9, 0.12], [3.5, 0.35], [1.6, 1]]) {
    g.lineWidth = w * u / 120;
    g.strokeStyle = `rgba(110,235,120,${a * fadeOut * shimmer})`; strokePartial(g, PEPPER.body, pe, map);
    g.strokeStyle = `rgba(150,240,110,${a * fadeOut * shimmer})`; if (ps > 0) strokePartial(g, PEPPER.stem, ps, map);
  }
  // pen-tip spark while drawing
  if (p > 0 && p < 1) {
    const pts = PEPPER.body, idx = Math.min(pts.length - 1, Math.floor(pe * (pts.length - 1))), [px, py] = map(pts[idx]);
    const rg = g.createRadialGradient(px, py, 0, px, py, u * 0.12); rg.addColorStop(0, 'rgba(255,255,240,1)'); rg.addColorStop(1, 'rgba(160,255,140,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(px, py, u * 0.12, 0, 7); g.fill();
  }
  const nameOn = e > 1500 && e < 3800;
  $('#identName').classList.toggle('show', nameOn);
  if (e > IDENT_MS) toTitle();
}
function startIdent() {
  S.screen = 'ident'; S.identT0 = performance.now();
  $('#gate').hidden = true; $('#ident').hidden = false; $('#title').hidden = true;
  layout(); AU.sting();
}
function toTitle() {
  if (S.screen === 'title') return;
  closeModals(); AU.allOff(); document.body.classList.add('on-title'); document.body.classList.remove('in-maker');
  S.screen = 'title'; S.level = DEMO; S.titleT0 = performance.now(); S.placed = []; S.sel = null; S.drag = null; S.dirty = true;
  $('#gate').hidden = true; $('#ident').hidden = true; $('#identName').classList.remove('show'); $('#title').hidden = false;
  layout(); AU.music('title');
}
// the title, written in light: a laser pen traces the word, then it hums
function drawTitleLight(t) {
  let slot = $('#logoSlot').getBoundingClientRect();
  if (!slot.width) { const w = Math.min(V.w * 0.92, 860), h = Math.max(70, Math.min(150, V.w * 0.15)); slot = { left: V.left + (V.w - w) / 2, top: V.top + V.h * 0.62 - h / 2, width: w, height: h }; }
  const g = bctx; setScreen(g);
  const word = 'BEAMWRIGHT';
  g.font = `700 100px ${FONT_MONO}`; const w100 = g.measureText(word).width;
  const fs = Math.min(slot.height * 0.95, (Math.min(slot.width, V.w * 0.92) * 0.94) / w100 * 100);
  g.font = `700 ${fs}px ${FONT_MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  const tw = g.measureText(word).width, x0 = (V.w - tw) / 2, y0 = slot.top - V.top + slot.height / 2;
  const k = reduceMotion ? 1 : Math.min(1, (t - S.titleT0) / 2200);
  const ease = 1 - Math.pow(1 - k, 2.2), clipX = x0 + tw * ease;
  g.save(); g.beginPath(); g.rect(x0 - 10, y0 - fs, clipX - x0 + 10, fs * 2); g.clip();
  g.globalCompositeOperation = 'lighter';
  const shimmer = reduceMotion ? 1 : 0.92 + 0.08 * Math.sin(t * 0.004);
  g.lineJoin = 'round';
  g.lineWidth = Math.max(2, fs * 0.05); g.strokeStyle = `rgba(255,190,90,${0.22 * shimmer})`; g.strokeText(word, x0, y0);
  g.lineWidth = Math.max(1, fs * 0.016); g.strokeStyle = `rgba(255,236,200,${0.95 * shimmer})`; g.strokeText(word, x0, y0);
  g.restore();
  if (k < 1) {
    g.globalCompositeOperation = 'lighter';
    const py = y0 + Math.sin(t * 0.05) * fs * 0.32;
    const rg = g.createRadialGradient(clipX, py, 0, clipX, py, fs * 0.25);
    rg.addColorStop(0, 'rgba(255,250,235,1)'); rg.addColorStop(0.2, 'rgba(255,200,110,0.6)'); rg.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(clipX, py, fs * 0.25, 0, 7); g.fill();
  }
}

function glassFill(g, x0, y0, x1, y1, a = 1) {
  const lg = g.createLinearGradient(x0, y0, x1, y1);
  lg.addColorStop(0, `rgba(190,215,230,${0.26 * a})`); lg.addColorStop(0.5, `rgba(60,75,90,${0.22 * a})`); lg.addColorStop(1, `rgba(150,180,200,${0.2 * a})`);
  return lg;
}
function piecePath(g, type) {
  const d = PIECES[type];
  g.beginPath();
  if (type === 'convex') { const h = d.half; g.moveTo(-h, 0); g.quadraticCurveTo(0, -0.26, h, 0); g.quadraticCurveTo(0, 0.26, -h, 0); }
  else if (type === 'concave') { const h = d.half; g.moveTo(-h, -0.13); g.quadraticCurveTo(0, 0.02, h, -0.13); g.lineTo(h, 0.13); g.quadraticCurveTo(0, -0.02, -h, 0.13); g.closePath(); }
  else if (d.shape === 'poly') { d.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
  else if (d.shape === 'disc') { g.arc(0, 0, d.r, 0, Math.PI * 2); }
}
function drawPiece(g, p, o = {}) {
  const d = PIECES[p.type], h = d.half;
  g.save();
  if (!o.icon) g.translate(p.x + 0.5, p.y + 0.5);
  if (o.alpha != null) g.globalAlpha = o.alpha;
  const lw = o.icon ? 1.4 / 70 : 1 / V.cell;
  // post holder: the round magnetic base the optic stands on (not for fibers, which lie on the table)
  if (!o.icon && !o.ghost && p.type !== 'fiber' && p.type !== 'bend') {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(0.03, 0.05, 0.27, 0, 7); g.fill();
    const bg = g.createRadialGradient(-0.08, -0.1, 0.02, 0, 0, 0.26); bg.addColorStop(0, '#2a2e34'); bg.addColorStop(1, '#14161a');
    g.fillStyle = bg; g.beginPath(); g.arc(0, 0, 0.25, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = lw; g.stroke();
  }
  g.rotate((p.a || 0) * RAD);
  if (!o.icon && !o.ghost) { g.save(); g.translate(0.04, 0.06); g.fillStyle = 'rgba(0,0,0,0.35)'; shadowShape(g, p.type, d); g.restore(); }
  if (p.type === 'mirror' || p.type === 'splitter') {
    const th = p.type === 'mirror' ? 0.05 : 0.06;
    if (p.type === 'mirror') {
      const mg = g.createLinearGradient(0, -th, 0, th); mg.addColorStop(0, '#d9e1ea'); mg.addColorStop(0.25, '#555a62'); mg.addColorStop(0.75, '#2a2d33'); mg.addColorStop(1, '#d9e1ea');
      g.fillStyle = mg;
    } else g.fillStyle = 'rgba(80,185,240,0.32)';
    rr(g, -h, -th, 2 * h, 2 * th, 0.015); g.fill();
    g.strokeStyle = p.type === 'mirror' ? 'rgba(235,242,250,0.85)' : 'rgba(110,210,255,0.95)'; g.lineWidth = lw * 1.2; g.stroke();
    if (p.type === 'splitter') { g.setLineDash([0.04, 0.04]); g.beginPath(); g.moveTo(-h + 0.02, 0); g.lineTo(h - 0.02, 0); g.strokeStyle = 'rgba(230,240,250,0.7)'; g.stroke(); g.setLineDash([]); }
  } else if (p.type === 'cmirror' || p.type === 'xmirror') {
    const s = 0.1, k = p.type === 'cmirror' ? 1 : -1, th = 0.075;
    g.beginPath(); g.moveTo(-h, k * s); g.quadraticCurveTo(0, -k * s, h, k * s);
    g.lineTo(h, k * s - th); g.quadraticCurveTo(0, -k * s - th, -h, k * s - th); g.closePath();
    const mg = g.createLinearGradient(0, -0.15, 0, 0.12); mg.addColorStop(0, '#1d1f24'); mg.addColorStop(1, '#4a4f57');
    g.fillStyle = mg; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = lw; g.stroke();
    g.beginPath(); g.moveTo(-h, k * s); g.quadraticCurveTo(0, -k * s, h, k * s);
    g.strokeStyle = 'rgba(235,242,250,0.95)'; g.lineWidth = lw * 2.2; g.stroke();
  } else if (p.type === 'droplet') {
    const r = d.r, wg = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
    wg.addColorStop(0, 'rgba(225,245,255,0.55)'); wg.addColorStop(0.35, 'rgba(110,170,215,0.22)'); wg.addColorStop(1, 'rgba(40,80,120,0.4)');
    piecePath(g, p.type); g.fillStyle = wg; g.fill(); g.strokeStyle = 'rgba(190,230,255,0.75)'; g.lineWidth = lw * 1.3; g.stroke();
    g.beginPath(); g.arc(0, 0, r * 0.72, Math.PI * 1.1, Math.PI * 1.45); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.03; g.stroke();
    if (o.lit) rainbowFill(g, p.type, o, 0.1);
  } else if (p.type === 'cateye') {
    const r = d.r;
    piecePath(g, p.type); g.fillStyle = glassFill(g, -r, -r, r, r, 1.2); g.fill();
    g.strokeStyle = 'rgba(215,235,248,0.7)'; g.lineWidth = lw * 1.2; g.stroke();
    g.beginPath(); g.arc(0, 0, r + 0.025, -Math.PI / 2, Math.PI / 2);
    const sg = g.createLinearGradient(0, -r, 0, r); sg.addColorStop(0, '#f2f5f8'); sg.addColorStop(0.5, '#7d838c'); sg.addColorStop(1, '#eef2f6');
    g.strokeStyle = sg; g.lineWidth = 0.06; g.stroke();
    g.beginPath(); g.arc(-r * 0.25, -r * 0.3, r * 0.22, 0, 7); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
  } else if (p.type === 'fiber' || p.type === 'bend') {
    piecePath(g, p.type);
    const fg = g.createLinearGradient(-0.5, -0.5, 0.5, 0.5); fg.addColorStop(0, 'rgba(120,215,255,0.26)'); fg.addColorStop(1, 'rgba(60,140,200,0.2)');
    g.fillStyle = fg; g.fill(); g.strokeStyle = 'rgba(160,225,255,0.75)'; g.lineWidth = lw * 1.3; g.stroke();
    g.beginPath();
    if (p.type === 'fiber') { g.moveTo(-0.5, 0); g.lineTo(0.5, 0); }
    else g.arc(-0.5, 0.5, (BEND_R1 + BEND_R2) / 2, -Math.PI / 2, 0);
    g.strokeStyle = 'rgba(200,240,255,0.18)'; g.lineWidth = 0.14; g.stroke();
  } else {
    piecePath(g, p.type);
    g.fillStyle = glassFill(g, -0.4, -0.3, 0.4, 0.3); g.fill();
    g.strokeStyle = 'rgba(215,235,248,0.8)'; g.lineWidth = lw * 1.3; g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 0.05; piecePath(g, p.type); g.stroke(); g.restore();
    if (p.type === 'diamond') {
      g.beginPath(); const P = PIECES.diamond.pts;
      g.moveTo(P[4][0], P[4][1]); g.lineTo(P[2][0], P[2][1]);
      g.moveTo(P[0][0], P[0][1]); g.lineTo(P[3][0], P[3][1]); g.lineTo(P[1][0], P[1][1]);
      g.moveTo(P[0][0], P[0][1]); g.lineTo(-0.1, -0.12); g.lineTo(P[3][0], P[3][1]); g.lineTo(0.1, -0.12); g.lineTo(P[1][0], P[1][1]);
      g.strokeStyle = 'rgba(230,240,250,0.35)'; g.lineWidth = lw; g.stroke();
    }
    if ((p.type === 'prism' || p.type === 'diamond') && o.lit) rainbowFill(g, p.type, o, p.type === 'diamond' ? 0.2 : 0.12);
  }
  if (o.lit && !o.icon) {
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,214,130,${0.3 * Math.min(1, o.lit * 3)})`; g.lineWidth = 0.04;
    if (d.shape === 'seg' && p.type !== 'convex' && p.type !== 'concave') { g.beginPath(); g.moveTo(-h, 0); g.lineTo(h, 0); g.stroke(); }
    else { piecePath(g, p.type); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
  }
  if (o.fixed && p.type !== 'fiber' && p.type !== 'bend') {
    g.fillStyle = '#8c8a84'; g.strokeStyle = '#1a1a1c'; g.lineWidth = lw;
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * (h - 0.02), 0.2, 0.035, 0, 7); g.fill(); g.stroke(); }
  }
  if (o.bad) { g.strokeStyle = 'rgba(255,90,70,0.8)'; g.lineWidth = lw * 2; g.beginPath(); g.arc(0, 0, 0.42, 0, 7); g.stroke(); }
  g.restore();
}
function rainbowFill(g, type, o, amt) {
  const pg = g.createLinearGradient(-0.4, 0, 0.4, 0);
  ['#ff4a3c', '#ffa024', '#ffe63c', '#3ceb6e', '#3c82ff', '#aa50ff'].forEach((c, i) => pg.addColorStop(i / 5, c));
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = amt * (o.alpha ?? 1); piecePath(g, type); g.fillStyle = pg; g.fill();
  g.globalAlpha = o.alpha ?? 1; g.globalCompositeOperation = 'source-over';
}
function shadowShape(g, type, d) {
  if (d.shape === 'seg' && type !== 'convex' && type !== 'concave') { rr(g, -d.half, -0.05, 2 * d.half, 0.1, 0.02); g.fill(); }
  else { piecePath(g, type); g.fill(); }
}
// ---------- emitters and photocells ----------
// A source is a laser head on a fork clamp: finned tube, coloured ID band, a silver nose and a lens
// that glows. It flashes when it fires the pulse on the downbeat.
function emitterBody(g, c, lw) {
  // fork clamp bolted across the bench
  const cg = g.createLinearGradient(-0.12, 0, 0.1, 0); cg.addColorStop(0, '#1a1c20'); cg.addColorStop(0.5, '#3a3e45'); cg.addColorStop(1, '#16181b');
  g.fillStyle = cg; rr(g, -0.13, -0.41, 0.22, 0.82, 0.06); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = lw; g.stroke();
  for (const by of [-0.32, 0.32]) {
    const bg = g.createRadialGradient(-0.035, by - 0.02, 0, -0.02, by, 0.055); bg.addColorStop(0, '#6a7079'); bg.addColorStop(1, '#202328');
    g.fillStyle = bg; g.beginPath(); g.arc(-0.02, by, 0.05, 0, 7); g.fill();
    g.fillStyle = '#0b0c0e'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(-0.02 + Math.cos(a) * 0.022, by + Math.sin(a) * 0.022); } g.closePath(); g.fill();
  }
  // the tube, lit like a cylinder from above
  const tg = g.createLinearGradient(0, -0.19, 0, 0.19);
  tg.addColorStop(0, '#111215'); tg.addColorStop(0.22, '#4b5058'); tg.addColorStop(0.36, '#30343a'); tg.addColorStop(0.75, '#17191c'); tg.addColorStop(1, '#0a0b0d');
  g.fillStyle = tg; rr(g, -0.43, -0.19, 0.6, 0.38, 0.07); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = lw; g.stroke();
  // heat-sink fins at the back
  for (let x = -0.4; x < -0.27; x += 0.033) {
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.moveTo(x, -0.17); g.lineTo(x, 0.17); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); g.moveTo(x + lw * 1.5, -0.17); g.lineTo(x + lw * 1.5, 0.17); g.stroke();
  }
  // coloured ID band (white light gets a spectrum band)
  const band = g.createLinearGradient(0, -0.19, 0, 0.19);
  if (c) { band.addColorStop(0, rgba(c.map(v => v * 0.35 | 0), 1)); band.addColorStop(0.28, rgba(c, 1)); band.addColorStop(1, rgba(c.map(v => v * 0.25 | 0), 1)); }
  else ['#ff4a3c', '#ffa024', '#ffe63c', '#3ceb6e', '#3c82ff', '#aa50ff'].forEach((h, i) => band.addColorStop(i / 5, h));
  g.fillStyle = band; g.fillRect(-0.235, -0.19, 0.045, 0.38);
  if (!c) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-0.235, -0.19, 0.045, 0.38); }
  // status lamp socket
  g.fillStyle = '#08090b'; g.beginPath(); g.arc(0.02, 0, 0.034, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.stroke();
  // silver nose and lens bezel
  const ng = g.createLinearGradient(0, -0.13, 0, 0.13);
  ng.addColorStop(0, '#22252a'); ng.addColorStop(0.25, '#a3aab3'); ng.addColorStop(0.45, '#5d636b'); ng.addColorStop(1, '#16181b');
  g.fillStyle = ng; rr(g, 0.15, -0.13, 0.15, 0.26, 0.025); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; for (let x = 0.19; x < 0.29; x += 0.03) { g.beginPath(); g.moveTo(x, -0.12); g.lineTo(x, 0.12); g.stroke(); }
  g.fillStyle = '#0b0c0e'; rr(g, 0.295, -0.155, 0.045, 0.31, 0.02); g.fill();
}
function srcColor(s) { return s.color && s.color !== 'W' ? SPEC[s.color].rgb : null; }
function drawSource(s, t) {
  const c = srcColor(s), lc = c || SPEC.W.rgb, lw = 1 / V.cell;
  ctx.save(); ctx.translate(s.x + 0.5, s.y + 0.5);
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.save(); ctx.translate(0.035, 0.06); ctx.rotate(s.a * RAD); rr(ctx, -0.43, -0.2, 0.62, 0.4, 0.08); ctx.fill(); rr(ctx, -0.13, -0.41, 0.22, 0.82, 0.06); ctx.fill(); ctx.restore();
  ctx.rotate(s.a * RAD); emitterBody(ctx, c, lw);
  ctx.restore();
  // the lens, the lamp and the firing flash belong to the light layer, so they bloom
  let d = (t - SEQ.loopStart) / STEP_MS; if (d < 0) d += SEQ.steps;
  const fire = S.screen === 'play' && !reduceMotion ? Math.exp(-d * 0.9) : 0;
  bctx.save(); setWorld(bctx); bctx.translate(s.x + 0.5, s.y + 0.5); bctx.rotate(s.a * RAD);
  bctx.globalCompositeOperation = 'lighter';
  const hot = lc.map(v => Math.round(v + (255 - v) * 0.5));
  bctx.fillStyle = rgba(hot, 0.95); bctx.fillRect(0.305, -0.12, 0.028, 0.24);
  const gl = bctx.createRadialGradient(0.32, 0, 0, 0.32, 0, 0.26); gl.addColorStop(0, rgba(lc, 0.32 + 0.45 * fire)); gl.addColorStop(1, rgba(lc, 0));
  bctx.fillStyle = gl; bctx.beginPath(); bctx.arc(0.32, 0, 0.26, 0, 7); bctx.fill();
  if (fire > 0.03) {   // a thin flare across the lens as the pulse leaves
    const fg = bctx.createLinearGradient(0, -0.42, 0, 0.42); fg.addColorStop(0, rgba(lc, 0)); fg.addColorStop(0.5, rgba(hot, 0.55 * fire)); fg.addColorStop(1, rgba(lc, 0));
    bctx.fillStyle = fg; bctx.fillRect(0.31, -0.42, 0.016, 0.84);
  }
  bctx.fillStyle = rgba(lc, 0.95); bctx.beginPath(); bctx.arc(0.02, 0, 0.02, 0, 7); bctx.fill();
  bctx.fillStyle = rgba(lc, 0.22 + 0.3 * fire); bctx.beginPath(); bctx.arc(0.02, 0, 0.06, 0, 7); bctx.fill();
  bctx.restore();
}

// A photocell is a silicon die in a machined can, behind a filter glass if it only takes one colour.
// Pinhole cells close an iris over the die. A ring of LED segments reads out the light it's getting.
const CELL_SEGS = 24;
function cellGeom(tg) { const r = tg.r || 0.3, big = r >= 0.38, ring = big ? r + 0.045 : Math.max(r + 0.07, 0.35); return { r, ring, R: ring + (big ? 0.05 : 0.075), pin: r <= 0.12 }; }
function cellBody(g, cx, cy, tg, lw) {
  const { r, ring, R, pin } = cellGeom(tg), col = tg.color && tg.color !== 'any' ? SPEC[tg.color].rgb : null;
  // housing: brushed can with a knurled rim
  const hg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); hg.addColorStop(0, '#4a4f57'); hg.addColorStop(0.45, '#25282d'); hg.addColorStop(1, '#0e0f12');
  g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.lineWidth = lw; g.strokeStyle = 'rgba(255,255,255,0.16)'; g.stroke();
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2; g.strokeStyle = k % 2 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.09)';
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 0.004), cy + Math.sin(a) * (R - 0.004)); g.lineTo(cx + Math.cos(a) * (R - 0.03), cy + Math.sin(a) * (R - 0.03)); g.stroke();
  }
  // recessed well for the meter
  g.fillStyle = '#0a0b0d'; g.beginPath(); g.arc(cx, cy, ring + 0.032, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(cx, cy, ring + 0.032, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  // unlit meter segments
  g.lineWidth = 0.034; g.lineCap = 'butt';
  for (let k = 0; k < CELL_SEGS; k++) {
    const a0 = -Math.PI / 2 + (k + 0.18) / CELL_SEGS * Math.PI * 2, a1 = -Math.PI / 2 + (k + 0.82) / CELL_SEGS * Math.PI * 2;
    g.strokeStyle = col ? rgba(col.map(v => v * 0.22 | 0), 1) : '#1d1a16'; g.beginPath(); g.arc(cx, cy, ring, a0, a1); g.stroke();
  }
  // the die
  const face = pin ? ring - 0.045 : r;
  g.fillStyle = '#0c1018'; g.beginPath(); g.arc(cx, cy, face, 0, 7); g.fill();
  const s = face * 1.18, x0 = cx - s / 2, y0 = cy - s / 2;
  g.save(); g.beginPath(); g.arc(cx, cy, face, 0, 7); g.clip();
  const dg = g.createLinearGradient(x0, y0, x0 + s, y0 + s); dg.addColorStop(0, '#2a3c5c'); dg.addColorStop(0.5, '#16233a'); dg.addColorStop(1, '#0b1322');
  g.fillStyle = dg; g.fillRect(x0, y0, s, s);
  g.lineWidth = lw * 0.8; g.strokeStyle = 'rgba(170,190,230,0.2)';
  for (let k = 1; k < 9; k++) { const y = y0 + k * s / 9; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + s, y); g.stroke(); }
  g.lineWidth = Math.max(lw * 1.4, 0.014); g.strokeStyle = 'rgba(214,172,96,0.55)';
  for (const fx of [0.33, 0.67]) { g.beginPath(); g.moveTo(x0 + s * fx, y0); g.lineTo(x0 + s * fx, y0 + s); g.stroke(); }
  g.restore();
  if (pin) {
    // iris: six blades closing down to the pinhole
    g.save(); g.beginPath(); g.arc(cx, cy, face, 0, Math.PI * 2); g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2, true); g.clip();
    const ig = g.createRadialGradient(cx, cy, r, cx, cy, face); ig.addColorStop(0, '#3a3e45'); ig.addColorStop(1, '#17191c');
    g.fillStyle = ig; g.fillRect(cx - face, cy - face, face * 2, face * 2);
    g.lineWidth = lw; g.strokeStyle = 'rgba(0,0,0,0.6)';
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.quadraticCurveTo(cx + Math.cos(a + 0.9) * face * 0.55, cy + Math.sin(a + 0.9) * face * 0.55, cx + Math.cos(a + 1.4) * face, cy + Math.sin(a + 1.4) * face); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  }
  // filter glass for single-colour cells, then a specular glint
  if (col) { g.fillStyle = rgba(col, 0.24); g.beginPath(); g.arc(cx, cy, face, 0, 7); g.fill(); g.strokeStyle = rgba(col, 0.7); g.lineWidth = lw * 1.5; g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = Math.max(lw, 0.012); g.beginPath(); g.arc(cx, cy, face * 0.82, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
}
function drawProfileTarget(tg, i) {
  const p = S.res && S.res.profiles[i], n = tg.bins || 5, half = tg.half || 0.4;
  ctx.save(); ctx.translate(tg.x+0.5, tg.y+0.5); ctx.rotate((tg.a || 0)*RAD);
  ctx.fillStyle = '#12171d'; ctx.strokeStyle = '#8997a2'; ctx.lineWidth = 0.02;
  rr(ctx,-0.10,-half-0.09,0.25,half*2+0.18,0.05); ctx.fill(); ctx.stroke();
  for (let k=0;k<n;k++) {
    const v = p ? p.bins[k] : 0, on = v >= (tg.binNeed || 5)-1e-6;
    ctx.fillStyle = on ? '#ffdc95' : v ? '#85612d' : '#29343e';
    ctx.fillRect(-0.07,-half+k*2*half/n+0.012,0.17,2*half/n-0.024);
    if(on) { ctx.shadowBlur=9;ctx.shadowColor='#ffd88b';ctx.fillRect(-0.07,-half+k*2*half/n+0.012,0.05,2*half/n-0.024);ctx.shadowBlur=0; }
  }
  // Arrow points in the accepted arrival direction.
  ctx.strokeStyle='#d6e1e8';ctx.lineWidth=0.018;ctx.beginPath();ctx.moveTo(-0.35,-half-0.2);ctx.lineTo(0.08,-half-0.2);ctx.lineTo(-0.02,-half-0.26);ctx.moveTo(0.08,-half-0.2);ctx.lineTo(-0.02,-half-0.14);ctx.stroke();
  ctx.restore();
}
function drawTarget(tg, i, t) {
  if (tg.profile) { drawProfileTarget(tg, i); return; }
  const res = S.res, lm = res ? res.lm[i] : 0, on = res ? res.lit[i] : false;
  const cx = tg.x + 0.5 + (tg.ox || 0), cy = tg.y + 0.5 + (tg.oy || 0), { r, ring, R, pin } = cellGeom(tg);
  const col = tg.color && tg.color !== 'any' ? SPEC[tg.color].rgb : SPEC.W.rgb;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(cx + 0.04, cy + 0.06, R, 0, 7); ctx.fill();
  cellBody(ctx, cx, cy, tg, 1 / V.cell);
  ctx.strokeStyle = on ? '#ffe5a8' : '#d4e7fa'; ctx.lineWidth = 1.5 / V.cell; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  // light layer: meter segments, the die glowing, a flash when a pulse lands, a ripple when it switches on
  const f = Math.min(1, lm / tg.need), n = on ? CELL_SEGS : Math.floor(f * CELL_SEGS + 1e-6);
  let flash = 0;
  if (S.screen === 'play' && !reduceMotion && S.arrive && S.arrive[i]) {
    let d = (t - SEQ.loopStart) / STEP_MS; if (d < 0) d += SEQ.steps;
    for (const a of S.arrive[i]) { const k = d - a; if (k >= 0 && k < 4) flash = Math.max(flash, Math.exp(-k * 1.3)); }
  }
  bctx.save(); setWorld(bctx); bctx.globalCompositeOperation = 'lighter'; bctx.lineCap = 'butt';
  const hot = col.map(v => Math.round(v + (255 - v) * 0.35));
  bctx.lineWidth = 0.034;
  for (let k = 0; k < n; k++) {
    const a0 = -Math.PI / 2 + (k + 0.18) / CELL_SEGS * Math.PI * 2, a1 = -Math.PI / 2 + (k + 0.82) / CELL_SEGS * Math.PI * 2;
    bctx.strokeStyle = rgba(on ? hot : col, on ? 0.95 : 0.7); bctx.beginPath(); bctx.arc(cx, cy, ring, a0, a1); bctx.stroke();
  }
  if (!on && f > 0 && n < CELL_SEGS) {   // the segment that is filling
    const k = n, u = f * CELL_SEGS - n, a0 = -Math.PI / 2 + (k + 0.18) / CELL_SEGS * Math.PI * 2, a1 = -Math.PI / 2 + (k + 0.82) / CELL_SEGS * Math.PI * 2;
    bctx.strokeStyle = rgba(col, 0.7 * u); bctx.beginPath(); bctx.arc(cx, cy, ring, a0, a1); bctx.stroke();
  }
  const face = r;
  const glow = on ? (reduceMotion ? 1 : 0.88 + 0.12 * Math.cos((t - SEQ.loopStart) / (STEP_MS * 4) * Math.PI * 2)) : f * 0.35;
  const amt = Math.min(1.4, glow + flash * 0.8);
  if (amt > 0.01) {
    const gl = bctx.createRadialGradient(cx, cy, 0, cx, cy, face * 1.25); gl.addColorStop(0, rgba(hot, 0.75 * amt)); gl.addColorStop(0.6, rgba(col, 0.35 * amt)); gl.addColorStop(1, rgba(col, 0));
    bctx.fillStyle = gl; bctx.beginPath(); bctx.arc(cx, cy, face * 1.25, 0, 7); bctx.fill();
  }
  if (flash > 0.02) { bctx.strokeStyle = rgba(hot, 0.5 * flash); bctx.lineWidth = 0.02; bctx.beginPath(); bctx.arc(cx, cy, ring + 0.035, 0, 7); bctx.stroke(); }
  const age = S.litAt && S.litAt[i] ? t - S.litAt[i] : 1e9;
  if (on && age < 700 && !reduceMotion) {
    const u = age / 700; bctx.strokeStyle = rgba(hot, 0.65 * (1 - u) * (1 - u)); bctx.lineWidth = 0.03 * (1 - u) + 0.006;
    bctx.beginPath(); bctx.arc(cx, cy, R + u * 0.38, 0, 7); bctx.stroke();
  }
  bctx.restore();
}
function labelAt(wx, wy, lines, dy = 0.5) {
  const [sx, sy] = w2s(wx, wy);
  const fs = Math.max(11, Math.min(13, V.cell * 0.17));
  let y = sy + dy * V.cell + fs;
  for (const [txt, mono, col] of lines) {
    ctx.font = mono ? `${fs - 0.5}px ${FONT_MONO}` : `${fs}px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(txt).width; ctx.fillStyle = 'rgba(8,9,11,0.74)'; rr(ctx, sx - tw / 2 - 5, y - fs + 1, tw + 10, fs + 4, 3); ctx.fill();
    ctx.fillStyle = col || 'rgba(236,239,243,0.96)'; ctx.fillText(txt, sx, y);
    y += fs + 4;
  }
}
function drawLabels() {
  if (V.cell < 46 || S.screen === 'title') return;
  setScreen(ctx);
  const L = S.level, res = S.res;
  L.sources.forEach(s => labelAt(s.x + 0.5, s.y + 0.5, [[s.color && s.color !== 'W' ? `Laser · ${SPEC[s.color].nm} nm` : 'White source']], s.a % 180 ? 0.46 : 0.44));
  L.targets.forEach((tg, i) => {
    const lm = res ? res.lm[i] : 0, on = res && res.lit[i];
    const nm = tg.profile ? (tg.tolerance ? 'Parallel receiver' : 'Strip receiver') : tg.color && tg.color !== 'any' ? `${SPEC[tg.color].nm} nm cell` : (tg.r && tg.r <= 0.12 ? 'Pinhole cell' : 'Photocell');
    const fmt = v => tg.need < 10 ? v.toFixed(1) : Math.round(v);
    labelAt(tg.x + 0.5 + (tg.ox || 0), tg.y + 0.5 + (tg.oy || 0), [[nm], [`${fmt(lm)} / ${fmt(tg.need)} lm`, true, on ? '#ffc366' : 'rgba(216,221,227,0.92)']], (tg.profile ? tg.half + 0.12 : cellGeom(tg).R + 0.03));
  });
  for (const p of (L.fixed || [])) if (p.type !== 'fiber' && p.type !== 'bend') labelAt(p.x + 0.5, p.y + 0.5, [[PIECES[p.type].name]], 0.42);
  for (const m of (L.mirage || [])) labelAt(m.x + m.w / 2, m.y + m.h - 0.62, [['Hot plate · mirage']], 0);
  for (const p of S.placed) labelAt(p.x + 0.5, p.y + 0.5, [[PIECES[p.type].name]], PIECES[p.type].shape === 'disc' ? 0.44 : 0.42);
}
function drawHints(t) {
  if (!S.hint || S.screen !== 'play') return;
  const pulse = reduceMotion ? 0.6 : 0.45 + 0.25 * Math.sin(t * 0.004);
  for (const hp of S.level.sol.slice(0, S.hint)) {
    const done = S.placed.some(p => p.type === hp.type && p.x === hp.x && p.y === hp.y && (p.a % PIECES[p.type].sym) === (hp.a % PIECES[hp.type].sym));
    if (done) continue;
    ctx.save(); ctx.setLineDash([0.06, 0.05]); ctx.strokeStyle = `rgba(255,195,102,${pulse})`; ctx.lineWidth = 1.5 / V.cell;
    rr(ctx, hp.x + 0.06, hp.y + 0.06, 0.88, 0.88, 0.1); ctx.stroke(); ctx.restore();
    drawPiece(ctx, hp, { ghost: true, alpha: pulse * 0.8 });
  }
}
function drawSelection() {
  const p = selPiece(); if (!p) return;
  const cx = p.x + 0.5, cy = p.y + 0.5;
  // engraved degree ring around the selected mount, with a knob to drag
  ctx.save();
  ctx.strokeStyle = 'rgba(255,195,102,0.35)'; ctx.lineWidth = 1 / V.cell;
  for (let k = 0; k < 24; k++) { const a = k * 15 * RAD, r0 = k % 6 ? 0.58 : 0.55; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * 0.64, cy + Math.sin(a) * 0.64); ctx.stroke(); }
  const kx = cx + Math.cos(p.a * RAD) * 0.62, ky = cy + Math.sin(p.a * RAD) * 0.62;
  ctx.strokeStyle = 'rgba(255,195,102,0.5)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(kx, ky); ctx.stroke();
  ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(kx, ky, 0.085, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
  ctx.restore();
  bctx.save(); setWorld(bctx); bctx.globalCompositeOperation = 'lighter';
  bctx.fillStyle = 'rgba(255,190,90,0.9)'; bctx.beginPath(); bctx.arc(kx, ky, 0.03, 0, 7); bctx.fill();
  bctx.restore();
}
function draw(t) {
  if (!statics) drawStatics();
  setScreen(ctx); ctx.clearRect(0, 0, V.w, V.h); ctx.drawImage(statics, 0, 0, V.w, V.h);
  setScreen(bctx); bctx.clearRect(0, 0, V.w, V.h);
  setWorld(ctx);
  if (S.screen === 'gate' || S.screen === 'ident') { if (S.screen === 'ident') drawIdent(t); if (window.__bwOverlay) { setScreen(ctx); setScreen(bctx); window.__bwOverlay(ctx, bctx, V, t); } return; }
  const L = S.level, hits = S.res ? S.res.hits : {};
  (L.fixed || []).forEach((p, i) => drawPiece(ctx, p, { fixed: true, lit: hits['f' + i] }));
  for (const p of S.placed) drawPiece(ctx, p, { lit: hits[p.uid] });
  L.targets.forEach((tg, i) => { setWorld(ctx); drawTarget(tg, i, t); });
  for (const m of L.mirage || []) {
    ctx.save(); setWorld(ctx); ctx.beginPath(); ctx.rect(m.x, m.y, m.w, m.h); ctx.clip();
    ctx.strokeStyle = 'rgba(255,150,90,0.06)'; ctx.lineWidth = 1.2 / V.cell;
    for (let k = 0; k < 6; k++) {
      const yy = m.y + m.h - 0.3 - k * (m.h / 6) - (reduceMotion ? 0 : (t * 0.0003 * (1 + k * 0.1)) % 0.5);
      ctx.beginPath(); for (let x = m.x; x <= m.x + m.w + 0.01; x += 0.1) { const w = Math.sin(x * 5 + t * 0.002 + k) * 0.03; x === m.x ? ctx.moveTo(x, yy + w) : ctx.lineTo(x, yy + w); } ctx.stroke();
    }
    ctx.restore();
  }
  setWorld(ctx); drawHints(t);
  drawBeams(t);
  drawSparks();
  drawPulses(t);
  L.sources.forEach(s => { setWorld(ctx); drawSource(s, t); });
  setWorld(ctx); drawSelection();
  if (S.screen === 'maker') drawMakerMarks(t);
  if (S.drag && S.pointer) {
    const d = S.drag; setWorld(ctx);
    if (d.cell) drawPiece(ctx, { type: d.type, x: d.cell[0], y: d.cell[1], a: d.a }, { lit: hits[d.uid], alpha: 0.95 });
    else drawPiece(ctx, { type: d.type, x: d.wx - 0.5, y: d.wy - 0.5, a: d.a }, { ghost: true, alpha: 0.7, bad: d.inside });
  }
  drawLabels();
  if (S.screen === 'title') drawTitleLight(t);
  if (S.screen === 'ident') drawIdent(t);
  if (window.__bwOverlay) { setScreen(ctx); setScreen(bctx); window.__bwOverlay(ctx, bctx, V, t); }
}
