// ===== Bench codes =====
// A bench travels as "BW1-" plus base64url JSON. The game makes and opens these codes, and tools/community.js
// reads the same codes from GitHub issues, so this file runs in the browser and in Node.
const BENCH = (() => {
  const E = typeof PIECES !== 'undefined' ? { PIECES, trace } : require('./engine.js');
  const SRC_COLORS = ['W', 'R', 'G', 'B', 'V'];
  const CELL_COLORS = ['any', 'R', 'O', 'Y', 'G', 'B', 'V'];
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
  const ang = a => ((Math.round(+a / 15) * 15) % 360 + 360) % 360;

  function encode(L, author) {
    const o = {
      n: L.name, a: author || L.author || undefined, w: L.w, h: L.h, t: L.tip || undefined,
      s: L.sources.map(s => [s.x, s.y, s.a, s.color || 'W']),
      c: L.targets.map(t => [t.x, t.y, t.need, t.color || 'any', t.r || 0.3]),
      x: L.walls, f: L.fixed.map(p => [p.type, p.x, p.y, p.a]), i: L.inv, p: L.par || 0,
      z: L.sol && L.sol.length ? L.sol.map(p => [p.type, p.x, p.y, p.a]) : undefined,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(o)); let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return 'BW1-' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Every field is range-checked, so a code from anywhere can only ever produce a legal bench.
  function decode(code) {
    try {
      const m = String(code).match(/BW1-([A-Za-z0-9_-]+)/); if (!m) return null;
      const raw = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(raw + '==='.slice((raw.length + 3) % 4)), o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
      const w = Math.max(5, Math.min(11, o.w | 0)), h = Math.max(4, Math.min(8, o.h | 0));
      const inB = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h;
      const L = {
        name: clean(o.n, 28) || 'Shared bench', author: clean(o.a, 32), w, h, tip: clean(o.t, 140), custom: true, mirage: [],
        sources: (o.s || []).filter(s => inB(s[0], s[1])).slice(0, 6).map(([x, y, a, c]) => ({ x, y, a: ang(a), ...(SRC_COLORS.includes(c) && c !== 'W' ? { color: c } : {}) })),
        targets: (o.c || []).filter(t => inB(t[0], t[1])).slice(0, 8).map(([x, y, need, c, r]) => ({ x, y, need: Math.max(0.5, Math.min(100, +need || 40)), ...(CELL_COLORS.includes(c) && c !== 'any' ? { color: c } : {}), ...(+r && +r !== 0.3 ? { r: Math.max(0.08, Math.min(0.45, +r)) } : {}) })),
        walls: (o.x || []).filter(([x, y]) => inB(x, y)).map(([x, y]) => [x, y]),
        fixed: (o.f || []).filter(p => E.PIECES[p[0]] && inB(p[1], p[2])).map(([type, x, y, a]) => ({ type, x, y, a: ang(a) })),
        inv: {}, par: Math.max(0, Math.min(20, o.p | 0)),
        sol: (o.z || []).filter(p => E.PIECES[p[0]] && inB(p[1], p[2])).slice(0, 20).map(([type, x, y, a]) => ({ type, x, y, a: ang(a) })),
      };
      for (const [t, n] of Object.entries(o.i || {})) if (E.PIECES[t] && (n | 0) > 0) L.inv[t] = Math.min(9, n | 0);
      if (!L.sources.length || !L.targets.length) return null;
      return L;
    } catch (e) { return null; }
  }

  // What's wrong with a bench and its solution, if anything (empty list = good to publish).
  function problems(L, sol) {
    const errs = [];
    const taken = new Set([...(L.walls || []), ...L.sources.map(s => [s.x, s.y]), ...L.targets.map(t => [t.x, t.y]), ...(L.fixed || []).map(p => [p.x, p.y])].map(c => c.join()));
    const cells = [...L.sources.map(s => [s.x, s.y]), ...L.targets.map(t => [t.x, t.y]), ...(L.fixed || []).map(p => [p.x, p.y]), ...(L.walls || [])];
    if (cells.length !== taken.size) errs.push('two things share one square');
    if (!sol || !sol.length) errs.push('no solution recorded');
    else {
      if (!E.trace(L, sol).win) errs.push('the solution does not light every cell');
      const used = {}; for (const p of sol) used[p.type] = (used[p.type] || 0) + 1;
      for (const t in used) if (!(L.inv[t] >= used[t])) errs.push(`the solution uses ${used[t]} ${t}, the player only gets ${L.inv[t] || 0}`);
      const seen = new Set();
      for (const p of sol) {
        const k = p.x + ',' + p.y;
        if (taken.has(k) || seen.has(k)) errs.push(`a solution part sits on an occupied square (${k})`);
        if (p.x < 0 || p.y < 0 || p.x >= L.w || p.y >= L.h) errs.push(`a solution part is off the bench (${k})`);
        seen.add(k);
      }
    }
    if (E.trace(L, []).win) errs.push('every cell is already lit with nothing placed');
    return errs;
  }
  return { encode, decode, problems, SRC_COLORS, CELL_COLORS };
})();
if (typeof module !== 'undefined') module.exports = BENCH;
