// Content regression checks: advanced maps must retain their routing challenge.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LEVELS } = require('../src/levels');
const E = require('../src/engine');
const { solveID } = require('../src/solver');

const start = LEVELS.findIndex(l => l.chapter === 4);
for (const level of LEVELS.slice(start)) {
  test(`Masterworks: ${level.name} is solvable and has no two-part shortcut`, () => {
    const sol = level.handSol;
    assert.ok(E.trace(level, sol).win);
    const taken = new Set();
    for (const item of [...level.sources, ...level.targets, ...(level.fixed || []), ...sol,
      ...level.walls.map(([x, y]) => ({ x, y }))]) {
      const cell = `${item.x},${item.y}`;
      assert.ok(!taken.has(cell), `overlapping board objects at ${cell}`);
      taken.add(cell);
      assert.ok(item.x >= 0 && item.x < level.w && item.y >= 0 && item.y < level.h);
    }
    for (let i = 0; i < sol.length; i++) {
      assert.ok(!E.trace(level, sol.filter((_, j) => j !== i)).win,
        `hint part ${i + 1} is unnecessary`);
    }
    // Exhaustive within the game's 15-degree placement grid, not a claim that par is minimal.
    const easy = solveID(level, 2, 1);
    assert.equal(easy.par, null, 'map can be bypassed with only one or two pieces');
  });
}
