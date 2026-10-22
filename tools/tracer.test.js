// Tracer unit tests: optics behavior of trace() in src/engine.js.
//
// Run:  node --test tools/        (from the repo root)
// These use only Node's built-in test runner and assert — no dependencies.
//
// Conventions: x = column (right), y = row (down). Angles in degrees, 0 = right, 90 = down.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { trace, PIECES, BANDS } = require('../src/engine.js');

// A minimal level: source fires right from (0, 2) unless overridden.
function bench(over = {}) {
  return {
    name: 'test', w: 9, h: 7,
    sources: [{ x: 0, y: 2, a: 0 }],
    targets: [],
    ...over,
  };
}
const evs = (r) => new Set(r.segs.map((s) => s.ev));
const colors = (r) => new Set(r.segs.map((s) => s.c));

describe('trace(): basics', () => {
  it('a straight shot lights the cell and wins', () => {
    const lv = bench({ targets: [{ x: 4, y: 2, need: 80 }] });
    const r = trace(lv, []);
    assert.equal(r.win, true);
    assert.deepEqual(r.lit, [true]);
    assert.ok(evs(r).has('target'), 'expected a target hit event');
    // five parallel rays, 100 lm per beam
    assert.ok(r.lm[0] > 95 && r.lm[0] <= 100, `lm=${r.lm[0]}`);
  });

  it('a beam that misses every cell does not win', () => {
    const lv = bench({ targets: [{ x: 4, y: 0, need: 80 }] });
    const r = trace(lv, []);
    assert.equal(r.win, false);
    assert.deepEqual(r.lit, [false]);
    assert.ok(evs(r).has('edge'), 'beam should leave the bench');
  });

  it('walls absorb the beam', () => {
    const lv = bench({ targets: [{ x: 6, y: 2, need: 10 }], walls: [[3, 2]] });
    const r = trace(lv, []);
    assert.ok(evs(r).has('wall'));
    assert.equal(r.win, false);
  });

  it('an empty level with no targets never wins', () => {
    assert.equal(trace(bench(), []).win, false);
  });
});

describe('trace(): mirrors and splitters', () => {
  it('a 45° mirror turns the beam 90° into the cell', () => {
    const lv = bench({
      w: 7, h: 7,
      sources: [{ x: 0, y: 3, a: 0 }],
      targets: [{ x: 3, y: 6, need: 80 }],
    });
    const r = trace(lv, [{ type: 'mirror', x: 3, y: 3, a: 45 }]);
    assert.ok(evs(r).has('mirror'), 'expected a mirror event');
    assert.equal(r.win, true);
  });

  it('a beam splitter sends half the light each way', () => {
    const lv = bench({
      w: 9, h: 9,
      sources: [{ x: 0, y: 3, a: 0 }],
      targets: [{ x: 6, y: 3, need: 40 }, { x: 3, y: 6, need: 40 }],
    });
    const r = trace(lv, [{ type: 'splitter', x: 3, y: 3, a: 45 }]);
    assert.ok(evs(r).has('split'), 'expected a split event');
    assert.equal(r.win, true, 'both cells should light at half intensity');
    for (const lm of r.lm) assert.ok(lm > 40 && lm < 60, `lm=${lm}`);
  });

  it('a concave mirror reflects off its front face only', () => {
    const lv = bench({
      w: 7, h: 7,
      sources: [{ x: 0, y: 3, a: 0 }],
      targets: [{ x: 3, y: 6, need: 60 }],
    });
    const front = trace(lv, [{ type: 'cmirror', x: 3, y: 3, a: 45 }]);
    assert.equal(front.win, true, 'front face should reflect and focus onto the cell');
    const back = trace(lv, [{ type: 'cmirror', x: 3, y: 3, a: 225 }]);
    assert.equal(back.win, false, 'back face should absorb, not reflect');
    assert.ok(evs(back).has('wall'));
  });
});

describe('trace(): lenses and glass', () => {
  it('a convex lens focuses the beam (lens event)', () => {
    const lv = bench({ targets: [{ x: 6, y: 2, need: 80 }] });
    const r = trace(lv, [{ type: 'convex', x: 3, y: 2, a: 90 }]);
    assert.ok(evs(r).has('lens'));
    assert.equal(r.win, true);
  });

  it('a glass block refracts in and back out', () => {
    const lv = bench({ targets: [{ x: 6, y: 2, need: 80 }] });
    const r = trace(lv, [{ type: 'block', x: 3, y: 2, a: 0 }]);
    const e = evs(r);
    assert.ok(e.has('glassIn'), 'expected glassIn');
    assert.ok(e.has('glassOut'), 'expected glassOut');
    assert.equal(r.win, true, 'a straight block should not stop the beam');
  });

  it('a tilted block shifts the beam sideways', () => {
    // a 30° block walks some rays off the pinhole: less light arrives
    const lv = bench({ targets: [{ x: 6, y: 2, need: 10, r: 0.12 }] });
    const straight = trace(lv, [{ type: 'block', x: 3, y: 2, a: 0 }]);
    const shifted = trace(lv, [{ type: 'block', x: 3, y: 2, a: 30 }]);
    assert.ok(straight.lm[0] > shifted.lm[0],
      `tilted block should spill light: ${straight.lm[0]} vs ${shifted.lm[0]}`);
  });
});

describe('trace(): dispersion and color', () => {
  it('a prism fans white light into bands', () => {
    const lv = bench({
      sources: [{ x: 0, y: 2, a: 0, color: 'W' }],
      targets: [],
    });
    const r = trace(lv, [{ type: 'prism', x: 4, y: 2, a: 0 }]);
    assert.ok(evs(r).has('disperse'), 'expected a disperse event');
    assert.ok(colors(r).size > 2, `expected several bands, got ${[...colors(r)]}`);
  });

  it('a red cell ignores blue light', () => {
    const redTarget = { x: 4, y: 2, need: 50, color: 'R' };
    const lvRed = bench({ sources: [{ x: 0, y: 2, a: 0, color: 'R' }], targets: [redTarget] });
    assert.equal(trace(lvRed, []).win, true);
    const lvBlue = bench({ sources: [{ x: 0, y: 2, a: 0, color: 'B' }], targets: [{ ...redTarget }] });
    const r = trace(lvBlue, []);
    assert.equal(r.win, false);
    assert.ok(evs(r).has('wall'), 'wrong color should not count as a hit');
  });
});

describe('trace(): exotic optics', () => {
  it("a cat's eye returns the beam (retro)", () => {
    const lv = bench({ targets: [] });
    const r = trace(lv, [{ type: 'cateye', x: 3, y: 2, a: 0 }]);
    assert.ok(evs(r).has('retro'), `expected retro, got ${[...evs(r)]}`);
  });

  it('a fiber carries light to the far cell', () => {
    const lv = bench({ targets: [{ x: 5, y: 2, need: 60 }] });
    const r = trace(lv, [{ type: 'fiber', x: 2, y: 2, a: 0 }]);
    assert.equal(r.win, true, 'light should pass through the fiber');
  });

  it('steep light inside a fiber totally internally reflects', () => {
    // beam enters the fiber end at 60°; inside it strikes the walls past the
    // critical angle (n = 2.2) and zig-zags instead of leaking out
    const lv = bench({
      w: 9, h: 9,
      sources: [{ x: 1, y: 5, a: -60 }],
      targets: [],
    });
    const r = trace(lv, [{ type: 'fiber', x: 3, y: 2, a: 0 }]);
    assert.ok(evs(r).has('fiberTir'), `expected fiberTir, got ${[...evs(r)]}`);
  });

  it('a droplet partially reflects inside', () => {
    const lv = bench({ targets: [{ x: 7, y: 2, need: 10 }] });
    const r = trace(lv, [{ type: 'droplet', x: 3, y: 2, a: 0 }]);
    assert.ok(r.segs.length > 10, 'droplet should split the beam into several paths');
    assert.equal(r.win, true);
  });
});

describe('trace(): engine invariants', () => {
  it('every piece type is defined and traceable without crashing', () => {
    for (const type of Object.keys(PIECES)) {
      const lv = bench({ targets: [] });
      const r = trace(lv, [{ type, x: 4, y: 2, a: 0 }]);
      assert.ok(Array.isArray(r.segs), `${type}: segs should be an array`);
      assert.equal(typeof r.win, 'boolean', `${type}: win should be boolean`);
    }
  });

  it('white light disperses into exactly the six bands', () => {
    assert.deepEqual([...BANDS], ['R', 'O', 'Y', 'G', 'B', 'V']);
  });

  it('segments record travel distance and what they met', () => {
    const lv = bench({ targets: [{ x: 4, y: 2, need: 80 }] });
    const r = trace(lv, []);
    for (const s of r.segs) {
      assert.ok(s.d1 >= s.d0, 'd1 should be >= d0');
      assert.equal(typeof s.ev, 'string');
    }
  });
});
