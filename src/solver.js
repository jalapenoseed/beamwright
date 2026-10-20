// ===== Level solver =====
// Brute force with iterative deepening, so the first solution found uses the fewest parts. It only tries
// cells the light currently crosses (a part anywhere else cannot change anything), every allowed angle,
// and every part left in the inventory. Used by tools/ in Node and by the bench maker's "check" in a worker.
const SOLVER = (() => {
  const E = typeof trace !== 'undefined' ? { trace, PIECES } : require('./engine.js');
  function occupied(level, placed) {
    const occ = new Set(), add = (x, y) => occ.add(x + ',' + y);
    (level.walls || []).forEach(([x, y]) => add(x, y));
    level.sources.forEach(s => add(s.x, s.y));
    level.targets.forEach(t => add(t.x, t.y));
    (level.fixed || []).forEach(p => add(p.x, p.y));
    (level.mirage || []).forEach(m => { for (let x = m.x; x < m.x + m.w; x++) for (let y = m.y; y < m.y + m.h; y++) add(x, y); });
    placed.forEach(p => add(p.x, p.y));
    return occ;
  }
  function candCells(level, res, occ) {
    const c = new Set();
    for (const s of res.segs) {
      const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = Math.max(1, Math.ceil(L / 0.1));
      for (let i = 0; i <= n; i++) {
        const x = Math.floor(s.x1 + (s.x2 - s.x1) * i / n), y = Math.floor(s.y1 + (s.y2 - s.y1) * i / n);
        if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
        const k = x + ',' + y; if (!occ.has(k)) c.add(k);
      }
    }
    return [...c].map(k => k.split(',').map(Number));
  }
  function angles(type) { const sym = E.PIECES[type].sym, out = []; for (let a = 0; a < sym; a += 15) out.push(a); return out; }
  // budgetMs: give up after this long (returns timedOut: true with whatever depth was finished)
  function solveID(level, maxDepth = 3, maxSol = 3, budgetMs = Infinity) {
    const deadline = Date.now() + budgetMs, t0 = Date.now();
    let nodes = 0, timedOut = false;
    if (E.trace(level, []).win) return { par: 0, sols: [[]], nodes: 1, ms: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      const sols = [], inv = { ...level.inv };
      for (const k in inv) if (inv[k] === Infinity || inv[k] > d) inv[k] = d;
      (function dfs(placed, depth) {
        if (sols.length >= maxSol || timedOut) return;
        if ((nodes & 255) === 0 && Date.now() > deadline) { timedOut = true; return; }
        const res = E.trace(level, placed); nodes++;
        if (res.win) { if (placed.length === d) sols.push(placed.map(p => ({ ...p }))); return; }
        if (depth >= d) return;
        const cells = candCells(level, res, occupied(level, placed));
        for (const type of Object.keys(inv)) {
          if (!inv[type]) continue; inv[type]--;
          for (const [x, y] of cells) for (const a of angles(type)) {
            placed.push({ type, x, y, a }); dfs(placed, depth + 1); placed.pop();
            if (sols.length >= maxSol || timedOut) break;
          }
          inv[type]++;
          if (sols.length >= maxSol || timedOut) return;
        }
      })([], 0);
      if (sols.length) return { par: d, sols, nodes, ms: Date.now() - t0 };
      if (timedOut) return { par: null, sols: [], nodes, ms: Date.now() - t0, timedOut: true, depth: d - 1 };
    }
    return { par: null, sols: [], nodes, ms: Date.now() - t0 };
  }
  return { solveID };
})();
if (typeof module !== 'undefined') module.exports = SOLVER;
