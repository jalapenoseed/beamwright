// Node entry for the level solver (the solver itself lives in src/solver.js and also runs in the browser).
// Usage: node tools/solver.js [levelIndex]   prints par and a few solutions
const { trace } = require('../src/engine.js');
const { solveID } = require('../src/solver.js');
module.exports = { solveID };

if (require.main === module) {
  const { LEVELS } = require('../src/levels.js');
  const only = process.argv[2] ? +process.argv[2] : null;
  LEVELS.forEach((lv, i) => {
    if (only !== null && i !== only) return;
    const base = trace(lv, []);
    const r = solveID(lv, lv.searchDepth || 3, 3);
    console.log(`#${i + 1} ${lv.name}: base lm=[${base.lm.map(v => v.toFixed(1))}] win0=${base.win} par=${r.par} nodes=${r.nodes} ${r.ms}ms`);
    r.sols.forEach(s => console.log('   ', JSON.stringify(s)));
  });
}
