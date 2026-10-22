# Contributing to Beamwright

## Setup

Requires **Node 18+**. There are no runtime dependencies — Node is only needed for the build tools.

```sh
git clone https://github.com/jalapenoseed/beamwright.git
cd beamwright
npm run build   # src/ -> dist/index.html, then open dist/index.html in a browser
```

## Commands

```sh
npm run build     # bundle src/ into dist/index.html (self-contained, no server needed)
npm run verify    # every campaign + community bench: hint solution wins, empty bench doesn't, parts fit
npm test          # verify + build (this is what CI runs before deploying)
npm run solve     # recompute par + hints in data/solutions.json (add an index for one level: npm run solve -- 7)
npm run itch      # build, then package itch-build/beamwright-html5.zip
npm run trailer   # film dist/trailer.mp4 (needs Playwright + ffmpeg)
npm run community:check -- BW1-…        # is a share code publishable?
npm run community:add -- BW1-… --author "Name"   # add a code by hand (see community/README.md)
```

## Adding or editing a campaign bench

1. Edit the bench object in `src/levels.js` (board size, sources, targets, walls, fixed parts, inventory).
2. Run `npm run solve -- <index>` to recompute par and the hint solution.
3. Run `npm run verify` — every bench must be solvable with its inventory and not already solved empty.
4. Run `npm run build` and play it.

## Working with branches

- Branch from `main` with a short name: `cleanup/…`, `bench/…`, `fix/…`.
- Keep PRs focused; one concern per PR.
- CI runs `verify` + `build` on every push — a PR that fails `verify` can't ship a broken bench.
- `dist/index.html` is committed on purpose (double-click to play). Rebuild it with `npm run build` before pushing anything that changes `src/`, `data/` or `community/benches/`.

## Code notes

- The game is plain HTML/CSS/JS, no framework. See [ARCHITECTURE.md](ARCHITECTURE.md) for the build order and module map — script load order matters.
- `src/engine.js` is pure (no DOM) and shared with Node tools and the bench-maker Web Worker. Keep it that way.
- Share codes (`BW1-…`) are untrusted input: `src/codes.js` range-checks every field on decode. Never trust a code without decoding it.
- Keep the studio look: dark lab hardware, amber readouts, B612/B612 Mono. Avoid the "classic AI look".
