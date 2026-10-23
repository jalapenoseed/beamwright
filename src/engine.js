// ===== Beamwright optics engine (pure, no DOM) =====
const BANDS = ['R', 'O', 'Y', 'G', 'B', 'V'];
const SPEC = {
  W: { rgb: [255, 212, 120], nm: null, label: 'White' },
  R: { rgb: [255, 64, 52], nm: 650, label: 'Red' },
  O: { rgb: [255, 140, 36], nm: 600, label: 'Orange' },
  Y: { rgb: [255, 230, 60], nm: 575, label: 'Yellow' },
  G: { rgb: [60, 235, 110], nm: 530, label: 'Green' },
  B: { rgb: [60, 130, 255], nm: 470, label: 'Blue' },
  V: { rgb: [170, 80, 255], nm: 420, label: 'Violet' },
};
// refractive index per wavelength band; dispersion is exaggerated so bench-sized optics fan visibly
const PRISM_N = { R: 1.46, O: 1.50, Y: 1.53, G: 1.57, B: 1.63, V: 1.70, W: 1.56 };
const WATER_N = { R: 1.30, O: 1.315, Y: 1.325, G: 1.34, B: 1.36, V: 1.38, W: 1.333 };
const DIAMOND_N = { R: 2.30, O: 2.35, Y: 2.39, G: 2.43, B: 2.49, V: 2.56, W: 2.42 };

function rectPts(w, h) { return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]; }
function triPts(s) {
  const r = s / Math.sqrt(3); const p = [];
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; p.push([r * Math.cos(a), r * Math.sin(a)]); }
  return p;
}
function dPts() { // half-disc: flat face on top, curved face below
  const p = [], R = 0.42, y0 = -0.17, N = 16;
  for (let i = 0; i <= N; i++) { const t = Math.PI * i / N; p.push([R * Math.cos(t), y0 + R * Math.sin(t)]); }
  return p;
}
const BEND_N = 10, BEND_R1 = 0.3, BEND_R2 = 0.7;
function bendPts() { // quarter annulus around the cell's bottom-left corner: ports on left edge and bottom edge
  const p = [], C = [-0.5, 0.5];
  for (let i = 0; i <= BEND_N; i++) { const t = (Math.PI / 2) * i / BEND_N; p.push([C[0] + BEND_R2 * Math.cos(t), C[1] - BEND_R2 * Math.sin(t)]); }
  for (let i = BEND_N; i >= 0; i--) { const t = (Math.PI / 2) * i / BEND_N; p.push([C[0] + BEND_R1 * Math.cos(t), C[1] - BEND_R1 * Math.sin(t)]); }
  return p;
}
const DIAMOND_PTS = [[-0.2, -0.32], [0.2, -0.32], [0.42, -0.12], [0, 0.42], [-0.42, -0.12]];

const PIECES = {
  mirror:   { name: 'Plane Mirror',   shape: 'seg',  half: 0.42, act: 'mirror',  sym: 180, spec: 'R ≈ 100% · both faces' },
  splitter: { name: 'Beam Splitter',  shape: 'seg',  half: 0.40, act: 'split',   sym: 180, spec: '50% reflect · 50% pass' },
  convex:   { name: 'Convex Lens',    shape: 'seg',  half: 0.40, act: 'lens', f: 2,  sym: 180, spec: 'f = +2.0 cells' },
  concave:  { name: 'Concave Lens',   shape: 'seg',  half: 0.40, act: 'lens', f: -1, sym: 180, spec: 'f = −1.0 cells' },
  cmirror:  { name: 'Concave Mirror', shape: 'seg',  half: 0.42, act: 'cmirror', f: 2,  sym: 360, spec: 'f = +2.0 cells · front face' },
  xmirror:  { name: 'Convex Mirror',  shape: 'seg',  half: 0.42, act: 'cmirror', f: -1, sym: 360, spec: 'f = −1.0 cells · front face' },
  block:    { name: 'Glass Block',    shape: 'poly', pts: rectPts(0.84, 0.56), n: 1.52, sym: 180, spec: 'n = 1.52 · crown glass' },
  prism:    { name: 'Prism',          shape: 'poly', pts: triPts(0.82), tab: PRISM_N, sym: 120, spec: 'n = 1.46–1.70 · flint' },
  dblock:   { name: 'Critical Angle Block', shape: 'poly', pts: dPts(), n: 1.5, sym: 360, spec: 'n = 1.50 · critical angle 42°' },
  cateye:   { name: "Cat's Eye",      shape: 'disc', r: 0.34, n: 2.0, mirror: true, sym: 360, spec: 'n = 2.0 ball · silvered back · returns light' },
  droplet:  { name: 'Water Droplet',  shape: 'disc', r: 0.36, tab: WATER_N, partial: 0.4, sym: 15, spec: 'n = 1.30–1.38 · reflects inside' },
  diamond:  { name: 'Diamond',        shape: 'poly', pts: DIAMOND_PTS, tab: DIAMOND_N, sym: 360, spec: 'n = 2.30–2.56 · brilliant cut' },
  fiber:    { name: 'Optical Fiber',  shape: 'poly', pts: rectPts(1.0, 0.4), n: 2.2, ports: [1, 3], sym: 180, spec: 'core n = 2.2 · ends join up' },
  bend:     { name: 'Fiber Bend',     shape: 'poly', pts: bendPts(), n: 2.2, ports: [BEND_N, 2 * BEND_N + 1], sym: 360, spec: 'core n = 2.2 · 90° turn' },
};
const PIECE_ORDER = ['mirror', 'cmirror', 'xmirror', 'convex', 'concave', 'block', 'prism', 'splitter', 'dblock', 'cateye', 'droplet', 'diamond', 'fiber', 'bend'];

const RAYS_PER_BEAM = 5, RAY_SPACING = 0.08, LM_PER_BEAM = 100;
const EPS = 1e-7, MIRAGE_STEP = 0.08;

function cross(ax, ay, bx, by) { return ax * by - ay * bx; }

function buildScene(level, placed) {
  const objs = [];
  const all = [];
  (level.fixed || []).forEach((p, i) => all.push({ ...p, id: 'f' + i, fixed: true }));
  placed.forEach((p, i) => all.push({ ...p, id: p.uid || ('p' + i) }));
  const ports = [];
  for (const p of all) {
    const def = PIECES[p.type];
    const cx = p.x + 0.5, cy = p.y + 0.5, a = p.a * Math.PI / 180;
    const tx = Math.cos(a), ty = Math.sin(a);
    if (def.shape === 'seg') {
      objs.push({ kind: 'seg', id: p.id, act: def.act, f: def.f, cx, cy, tx, ty, nx: -ty, ny: tx, half: def.half });
    } else if (def.shape === 'disc') {
      objs.push({ kind: 'disc', id: p.id, cx, cy, r: def.r, n: def.n, tab: def.tab, partial: def.partial || 0, mir: def.mirror ? [tx, ty] : null });
    } else {
      const pts = def.pts.map(([u, v]) => [cx + u * tx - v * ty, cy + u * ty + v * tx]);
      let area2 = 0;
      for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area2 += x1 * y2 - x2 * y1; }
      const edges = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        const ex = x2 - x1, ey = y2 - y1, L = Math.hypot(ex, ey);
        const nx = area2 > 0 ? ey / L : -ey / L, ny = area2 > 0 ? -ex / L : ex / L;
        const port = !!(def.ports && def.ports.includes(i));
        const e = { x1, y1, ex, ey, nx, ny, port, mx: x1 + ex / 2, my: y1 + ey / 2 };
        edges.push(e); if (port) ports.push(e);
      }
      objs.push({ kind: 'poly', id: p.id, edges, n: def.n, tab: def.tab, fiber: !!def.ports });
    }
  }
  // fiber ends that touch another fiber end are joined: light passes straight across
  for (const e of ports) e.joined = ports.some(f => f !== e && Math.hypot(f.mx - e.mx, f.my - e.my) < 0.03);
  level.sources.forEach((s, i) => objs.push({ kind: 'circ', id: 's' + i, cx: s.x + 0.5, cy: s.y + 0.5, r: 0.3, absorb: true }));
  level.targets.forEach((t, i) => {
    const base = { id: 't' + i, ti: i, cx: t.x + 0.5 + (t.ox || 0), cy: t.y + 0.5 + (t.oy || 0), color: t.color || 'any' };
    if (t.profile) {
      const a = (t.a || 0) * Math.PI / 180;
      objs.push({ ...base, kind: 'seg', act: 'sensor', tx: -Math.sin(a), ty: Math.cos(a), nx: Math.cos(a), ny: Math.sin(a), half: t.half || 0.4 });
    } else objs.push({ ...base, kind: 'circ', r: t.r || 0.3 });
  });
  // An aperture is physical absorbing steel, with an open slit through its centre.
  for (const g of level.gates || []) {
    objs.push({kind:'box', id:'w', x0:g.x+0.46, x1:g.x+0.54, y0:0, y1:g.y+0.5-g.gap});
    objs.push({kind:'box', id:'w', x0:g.x+0.46, x1:g.x+0.54, y0:g.y+0.5+g.gap, y1:level.h});
  }
  for (const [x, y] of level.walls || []) objs.push({ kind: 'box', id: 'w', x0: x, y0: y, x1: x + 1, y1: y + 1 });
  const zones = [];
  for (const m of level.mirage || []) {
    const z = { kind: 'zone', id: 'z', x0: m.x, y0: m.y, x1: m.x + m.w, y1: m.y + m.h - 0.12, k: m.k || 0.3 };
    zones.push(z); objs.push(z);
    objs.push({ kind: 'box', id: 'w', x0: m.x, y0: m.y + m.h - 0.12, x1: m.x + m.w, y1: m.y + m.h }); // hot plate
  }
  return { objs, all, zones };
}

function slab(o, px, py, dx, dy) {
  let t0 = -Infinity, t1 = Infinity;
  if (Math.abs(dx) < 1e-12) { if (px < o.x0 || px > o.x1) return Infinity; }
  else { let a = (o.x0 - px) / dx, b = (o.x1 - px) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  if (Math.abs(dy) < 1e-12) { if (py < o.y0 || py > o.y1) return Infinity; }
  else { let a = (o.y0 - py) / dy, b = (o.y1 - py) / dy; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  if (t0 > t1 || t0 <= EPS) return Infinity;
  return t0;
}

function hitScene(objs, px, py, dx, dy, W, H) {
  let best = Infinity, bo = null, bh = 0, be = null;
  for (const o of objs) {
    if (o.kind === 'seg') {
      const den = cross(dx, dy, o.tx, o.ty); if (Math.abs(den) < 1e-12) continue;
      const qx = o.cx - px, qy = o.cy - py;
      const s = cross(qx, qy, o.tx, o.ty) / den;
      if (s <= EPS || s >= best) continue;
      const u = cross(qx, qy, dx, dy) / den;
      if (Math.abs(u) > o.half) continue;
      best = s; bo = o; bh = u;
    } else if (o.kind === 'poly') {
      for (const e of o.edges) {
        const den = cross(dx, dy, e.ex, e.ey); if (Math.abs(den) < 1e-12) continue;
        const qx = e.x1 - px, qy = e.y1 - py;
        const s = cross(qx, qy, e.ex, e.ey) / den;
        if (s <= EPS || s >= best) continue;
        const u = cross(qx, qy, dx, dy) / den;
        if (u < 0 || u > 1) continue;
        best = s; bo = o; be = e;
      }
    } else if (o.kind === 'circ' || o.kind === 'disc') {
      const qx = px - o.cx, qy = py - o.cy;
      const b = qx * dx + qy * dy, c = qx * qx + qy * qy - o.r * o.r;
      const disc = b * b - c; if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      let s = -b - sq; if (s <= EPS && o.kind === 'disc') s = -b + sq;
      if (s <= EPS || s >= best) continue;
      best = s; bo = o;
    } else if (o.kind === 'box' || o.kind === 'zone') {
      const s = slab(o, px, py, dx, dy);
      if (s < best) { best = s; bo = o; }
    }
  }
  let sb = Infinity;
  if (dx > 0) sb = Math.min(sb, (W - px) / dx); else if (dx < 0) sb = Math.min(sb, -px / dx);
  if (dy > 0) sb = Math.min(sb, (H - py) / dy); else if (dy < 0) sb = Math.min(sb, -py / dy);
  if (sb < best) return { s: sb, o: null };
  return { s: best, o: bo, h: bh, e: be };
}

function refract(dx, dy, nx, ny, n1, n2) {
  // n points against d (toward the incoming side)
  const cosi = -(dx * nx + dy * ny), eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const c = eta * cosi - Math.sqrt(k);
  const rx = eta * dx + c * nx, ry = eta * dy + c * ny, L = Math.hypot(rx, ry);
  return [rx / L, ry / L];
}

function trace(level, placed, opts = {}) {
  const W = level.w, H = level.h;
  const { objs, all, zones } = buildScene(level, placed);
  const segs = [];
  const tgt = level.targets.map(() => 0);
  const profiles = level.targets.map(t => t.profile ? { bins: Array(t.bins || 5).fill(0), accepted: 0, anglePower: 0 } : null);
  const hits = {};
  const stack = [];
  level.sources.forEach(s => {
    const a = s.a * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx;
    const count = s.rays || RAYS_PER_BEAM;
    const spacing = s.width == null ? RAY_SPACING : s.width / Math.max(1, count - 1);
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * spacing;
      stack.push({ x: s.x + 0.5 + dx * 0.32 + px * off, y: s.y + 0.5 + dy * 0.32 + py * off, dx, dy, I: 1 / count, c: s.color || 'W', d: 0, k, st: 0, L: 0 });
    }
  });
  let guard = 0;
  const maxSegs = opts.maxSegs || 6000;
  while (stack.length && guard++ < maxSegs) {
    const r = stack.pop();
    const h = hitScene(objs, r.x, r.y, r.dx, r.dy, W, H);
    // inside hot air: march in small steps, bending away from the hot plate
    const z = zones.length ? zones.find(q => r.x > q.x0 && r.x < q.x1 && r.y > q.y0 && r.y < q.y1) : null;
    if (z && h.s > MIRAGE_STEP && r.st < 500) {
      const nx = r.x + r.dx * MIRAGE_STEP, ny = r.y + r.dy * MIRAGE_STEP;
      segs.push({ x1: r.x, y1: r.y, x2: nx, y2: ny, c: r.c, I: r.I, k: r.k, d0: r.L, d1: r.L + MIRAGE_STEP, ev: '' });
      let dx = r.dx, dy = r.dy - z.k * MIRAGE_STEP; const L = Math.hypot(dx, dy);
      stack.push({ ...r, x: nx, y: ny, dx: dx / L, dy: dy / L, st: r.st + 1, L: r.L + MIRAGE_STEP });
      continue;
    }
    const hx = r.x + r.dx * h.s, hy = r.y + r.dy * h.s;
    // every segment records how far the light has travelled and what it met at the end (drives the sound)
    const seg = { x1: r.x, y1: r.y, x2: hx, y2: hy, c: r.c, I: r.I, k: r.k, d0: r.L, d1: r.L + h.s, ev: '' };
    segs.push(seg);
    const o = h.o;
    if (!o) { seg.ev = 'edge'; continue; }
    if (r.d > 80 || r.I < 0.004) { seg.ev = 'fade'; continue; }
    if (o.id && o.id !== 'w' && o.id !== 'z') hits[o.id] = (hits[o.id] || 0) + r.I;
    const next = (ndx, ndy, I, c) => stack.push({ x: hx + ndx * 1e-5, y: hy + ndy * 1e-5, dx: ndx, dy: ndy, I, c: c || r.c, d: r.d + 1, k: r.k, st: r.st, L: r.L + h.s });
    if (o.act === 'sensor') {
      const tg = level.targets[o.ti], p = profiles[o.ti];
      const forward = r.dx * o.nx + r.dy * o.ny;
      const angle = Math.acos(Math.max(-1, Math.min(1, forward))) * 180 / Math.PI;
      if (o.color === 'any' || o.color === r.c) {
        tgt[o.ti] += r.I; seg.ti = o.ti;
        if (angle <= (tg.tolerance == null ? 89 : tg.tolerance)) {
          const bin = Math.max(0, Math.min(p.bins.length - 1, Math.floor((h.h + o.half) / (2 * o.half) * p.bins.length)));
          p.bins[bin] += r.I * LM_PER_BEAM; p.accepted += r.I * LM_PER_BEAM;
        }
        p.anglePower += angle * r.I * LM_PER_BEAM;
      }
      seg.ev = 'target'; continue;
    }
    if (o.kind === 'circ') {
      const counts = o.ti !== undefined && (o.color === 'any' || o.color === r.c);
      if (counts) { tgt[o.ti] += r.I; seg.ti = o.ti; }
      seg.ev = counts ? 'target' : 'wall';
      continue;
    }
    if (o.kind === 'box') { seg.ev = 'wall'; continue; }
    if (o.kind === 'zone') { next(r.dx, r.dy, r.I); continue; }
    seg.ev = o.kind === 'seg' ? o.act : '';
    if (o.kind === 'seg') {
      const dn = r.dx * o.nx + r.dy * o.ny;
      if (o.act === 'mirror' || o.act === 'split') {
        const rx = r.dx - 2 * dn * o.nx, ry = r.dy - 2 * dn * o.ny;
        if (o.act === 'mirror') next(rx, ry, r.I);
        else { next(rx, ry, r.I / 2); next(r.dx, r.dy, r.I / 2); }
      } else if (o.act === 'lens') {
        const sgn = dn >= 0 ? 1 : -1, ax = o.nx * sgn, ay = o.ny * sgn;
        const da = r.dx * ax + r.dy * ay; const dt = r.dx * o.tx + r.dy * o.ty;
        const s = dt / Math.max(da, 0.05) - h.h / o.f;
        const L = Math.hypot(1, s); next((ax + s * o.tx) / L, (ay + s * o.ty) / L, r.I);
      } else if (o.act === 'cmirror') {
        if (dn >= 0) { seg.ev = 'wall'; continue; } // back face absorbs (front faces +n)
        const rx = r.dx - 2 * dn * o.nx, ry = r.dy - 2 * dn * o.ny;
        const da = rx * o.nx + ry * o.ny, dt = rx * o.tx + ry * o.ty;
        const s = dt / Math.max(da, 0.05) - h.h / o.f;
        const L = Math.hypot(1, s); next((o.nx + s * o.tx) / L, (o.ny + s * o.ty) / L, r.I);
      }
      continue;
    }
    // refracting bodies: polygons and discs
    let enx, eny;
    if (o.kind === 'poly') {
      const e = h.e;
      if (e.port && e.joined) { next(r.dx, r.dy, r.I); continue; }   // silent hand-over between fibers
      enx = e.nx; eny = e.ny;
    } else {
      enx = (hx - o.cx) / o.r; eny = (hy - o.cy) / o.r;
      if (o.mir && enx * o.mir[0] + eny * o.mir[1] > 0) { // silvered back of the cat's eye
        const dd = r.dx * enx + r.dy * eny; next(r.dx - 2 * dd * enx, r.dy - 2 * dd * eny, r.I); seg.ev = 'retro'; continue;
      }
    }
    const dn = r.dx * enx + r.dy * eny, entering = dn < 0;
    const nx = entering ? enx : -enx, ny = entering ? eny : -eny; // against d
    const part = !entering && o.partial ? o.partial : 0;
    seg.ev = entering ? (o.tab && r.c === 'W' ? 'disperse' : 'glassIn') : 'glassOut';
    const emit = (c, I) => {
      const ng = o.tab ? o.tab[c] : o.n;
      const n1 = entering ? 1 : ng, n2 = entering ? ng : 1;
      const t = refract(r.dx, r.dy, nx, ny, n1, n2);
      const dd = r.dx * nx + r.dy * ny, rx = r.dx - 2 * dd * nx, ry = r.dy - 2 * dd * ny;
      if (!t) { next(rx, ry, I, c); seg.ev = o.fiber ? 'fiberTir' : 'tir'; }
      else if (part) { next(t[0], t[1], I * (1 - part), c); next(rx, ry, I * part, c); }
      else next(t[0], t[1], I, c);
    };
    if (o.tab && entering && r.c === 'W') { for (const b of BANDS) emit(b, r.I / BANDS.length); }
    else emit(r.c, r.I);
  }
  const lm = tgt.map(v => v * LM_PER_BEAM);
  const quality = level.targets.map((t, i) => {
    const p = profiles[i];
    if (!p) return Math.min(1, lm[i] / t.need);
    p.covered = p.bins.filter(v => v >= (t.binNeed || 5) - 1e-6).length;
    p.meanAngle = lm[i] ? p.anglePower / lm[i] : 0;
    return Math.min(1, p.accepted / t.need, ...p.bins.map(v => v / (t.binNeed || 5)));
  });
  const lit = quality.map(q => q >= 1 - 1e-6);
  return { segs, lm, lit, profiles, quality, hits, win: lit.every(Boolean) && lit.length > 0, all };
}

if (typeof module !== 'undefined') module.exports = { trace, PIECES, PIECE_ORDER, SPEC, BANDS, buildScene, BEND_R1, BEND_R2 };
