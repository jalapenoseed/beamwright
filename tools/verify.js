// Checks every level: its hint solution lights every cell, an empty bench does not,
// the solution only uses parts from the level's inventory, and no part sits on an occupied square.
const { trace } = require('../src/engine.js');
const { LEVELS } = require('../src/levels.js');
const SOLS = require('../data/solutions.json');

let failed = 0;
LEVELS.forEach((lv, i) => {
  const sol = lv.handSol || (SOLS[i] && SOLS[i].sol);
  const errs = [];
  if (!sol) errs.push('no solution recorded (run: npm run solve -- ' + i + ')');
  else {
    if (!trace(lv, sol).win) errs.push('hint solution does not light every cell');
    const used = {};
    for (const p of sol) used[p.type] = (used[p.type] || 0) + 1;
    for (const t in used) if (!(lv.inv[t] >= used[t])) errs.push(`solution uses ${used[t]} ${t}, inventory has ${lv.inv[t] || 0}`);
    const taken = new Set([...(lv.walls || []), ...lv.sources.map(s => [s.x, s.y]), ...lv.targets.map(t => [t.x, t.y]), ...(lv.fixed || []).map(p => [p.x, p.y])].map(c => c.join()));
    for (const p of sol) {
      if (taken.has(p.x + ',' + p.y)) errs.push(`part on occupied square ${p.x},${p.y}`);
      if (p.x < 0 || p.y < 0 || p.x >= lv.w || p.y >= lv.h) errs.push(`part off the bench ${p.x},${p.y}`);
    }
  }
  if (trace(lv, []).win) errs.push('an empty bench already wins');
  const tag = errs.length ? 'FAIL' : 'ok  ';
  console.log(`${tag} ${String(i + 1).padStart(2)} ${lv.name}${errs.length ? '  ← ' + errs.join('; ') : ''}`);
  failed += errs.length ? 1 : 0;
});
console.log(failed ? `\n${failed} level(s) failed` : `\nAll ${LEVELS.length} levels verified.`);
process.exit(failed ? 1 : 0);
