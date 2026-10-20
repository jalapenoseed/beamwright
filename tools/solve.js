// Regenerates data/solutions.json: the par (fewest pieces) and a hint solution for each level.
// Usage: node tools/solve.js [levelIndex ...]   (no args = every level without a handSol)
const fs = require('fs');
const path = require('path');
const { LEVELS } = require('../src/levels.js');
const { solveID } = require('./solver.js');

const file = path.join(__dirname, '..', 'data', 'solutions.json');
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const which = process.argv.slice(2).map(Number);
const list = which.length ? which : LEVELS.map((_, i) => i).filter(i => !LEVELS[i].handSol);

// prefer solutions whose angles are multiples of 45°, they read best as hints
const oddness = sol => sol.reduce((n, p) => n + (p.a % 45 ? 1 : 0), 0);

for (const i of list) {
  const lv = LEVELS[i];
  const r = solveID(lv, lv.searchDepth || 3, lv.maxSol || 150);
  r.sols.sort((a, b) => oddness(a) - oddness(b));
  out[i] = { par: r.par, sol: r.sols[0], count: r.sols.length };
  console.log(`${String(i + 1).padStart(2)} ${lv.name.padEnd(18)} par ${r.par}  ${r.sols.length} solutions  ${r.ms} ms`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
}
