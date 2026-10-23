# Architecture

Beamwright is plain HTML, CSS and JavaScript with no framework and no runtime dependencies. `tools/build.js` bundles `src/` into one self-contained `dist/index.html`.

## Build pipeline

`node tools/build.js` (see the script for the exact logic):

1. Reads each `src/*.js` file and inlines them into `src/index.html` at the `<!--SCRIPTS-->` marker.
2. Injects generated constants: `SOLS` (from `data/solutions.json`), `COMMUNITY` (from `community/benches/*.json`), `REPO` (from `package.json`'s `repository`), and `WORKER_SRC` (engine + solver source for the bench-maker Web Worker).
3. Lifts `<title>`, `<meta>`, `<link>` and `<style>` into a proper `<head>` and writes `dist/index.html`.

`node tools/build.js --fragment` writes `dist/fragment.html` (body-only) instead, for hosts that supply the document shell.

## Script load order (globals)

Order matters — everything loads as globals. From `tools/build.js`:

1. `src/engine.js` — optics: `PIECES`, `buildScene`, `trace(level, placed)`
2. `src/levels.js` — the 32 campaign benches
3. `SOLS` — par + hint solutions (generated, `data/solutions.json`)
4. `src/solver.js` — `SOLVER.solveID`, iterative deepening (browser + Node)
5. `src/codes.js` — `BENCH.encode/decode`, `BW1-…` share codes, strictly validated
6. `COMMUNITY` — accepted community benches (built from `community/benches/`)
7. `REPO` — `owner/name` of this repo, used by the maker's submit flow
8. `WORKER_SRC` — engine + solver source string for the maker's solver Web Worker
9. `src/audio.js` — Web Audio synth (no samples)
10. `src/skins.js` — readable skins + beam-glow setting
11. `src/gl.js` — WebGL2 compositor

Then one IIFE wraps, in order:

12. `src/game.js` — core: DOM refs, constants, sequencer, state (`S`, `V`), layout, `loadLevel`
13. `src/game-input.js` — selection, pointer/drag, place/rotate/return, `retrace`, win flow
14. `src/game-draw.js` — all canvas drawing: bench, beams, pieces, sources, cells, labels
15. `src/game-ui.js` — frame loop, modals, pause menu, level picker, title/ident, `start`
16. `src/maker.js` — bench maker (tools, inspector, settings, check, submit)
17. `src/community.js` — community benches in the picker, play, remix
18. `src/boot.js` — start-up once fonts are ready

`window.__bw` exposes hooks for tests and the trailer. All of the above share one IIFE scope — do not reorder them without checking cross-references. The `game-*.js` split is purely organizational: the concatenated bundle is token-identical to the old single `game.js` (verified by build diff).

## Key modules

| File | Role |
|---|---|
| `engine.js` | Pure optics engine (no DOM). Safe to use in Node and workers. |
| `solver.js` | Iterative-deepening solver, shared by `tools/`, the maker, and its worker. |
| `codes.js` | Share-code encode/decode with field-by-field validation. Treat codes as untrusted input. |
| `audio.js` | Synthesized sound: the light path *is* the drum machine (see README). |
| `gl.js` | WebGL2 compositor; draws breadboard, bloom, and all `data-plate` UI. `.no-gl` 2D fallback. |
| `game.js` + `game-input.js` + `game-draw.js` + `game-ui.js` | The app, split by concern (was one 71 KB file): state machine, input, rendering layers, menus. |
| `maker.js` | Level editor, including the solver-backed **check** step. |

## Data flow

- **Light:** each source fires 5 parallel rays; `trace()` returns `{segs, lm, lit, hits, win}`. Segments carry `d0`/`d1` (distance in cells) and `ev` (what the ray met).
- **Community benches:** submitted via a GitHub issue form → `bench-submission.yml` validates with the solver → maintainer adds the `accepted` label → workflow commits to `community/benches/` → redeploy. See `community/README.md`.
- **Deploy:** `.github/workflows/deploy.yml` runs `verify` + `build` on pushes to `main`, then deploys `dist/` to GitHub Pages (and itch.io via butler, once configured).

