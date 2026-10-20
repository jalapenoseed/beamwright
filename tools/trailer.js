// Films the Beamwright trailer straight from the game.
// Drives dist/index.html frame by frame on a virtual clock (so slow machines still get smooth video),
// scripts the scenes through the game's window.__bw hooks, logs every sound the game makes, renders the
// soundtrack offline with the same synth, and muxes it all with ffmpeg.
//
//   npm run build && node tools/trailer.js [--out dist/trailer.mp4] [--fps 24] [--width 1280] [--height 720] [--from 0 --to 32]
//
// Needs: Playwright (npm i -D playwright, with a Chromium) and ffmpeg on PATH.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.join(__dirname, '..');
const FPS = +arg('fps', 24), W = +arg('width', 1280), H = +arg('height', 720);
const OUT = path.resolve(arg('out', path.join(root, 'dist', 'trailer.mp4')));
const FROM = +arg('from', 0), TO = +arg('to', 32);
// --audio-only <video.mp4>: re-run the script without filming, re-render the soundtrack, and swap it into that video
const AUDIO_ONLY = arg('audio-only', null);
const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bw-trailer-'));

// ---------- the script (times in seconds) ----------
// Each scene: when it starts, and what to do. Actions run once when the clock passes their time.
const SCENES = [
  { at: 0.0, name: 'ident', run: 'B.startIdent()' },
  { at: 4.6, name: 'title', run: 'window.__demoA = 40; B.toTitle()' },
  { at: 9.0, name: 'periscope', run: 'play(9)', caption: ['Bend light.', 'mirrors · lenses · 22 benches'] },
  { at: 9.7, run: "drop('mirror', 1, 5, 0, 135)" },
  { at: 10.9, run: "drop('mirror', 1, 0, 0, 135)" },
  { at: 12.1, run: "drop('convex', 4, 0, 0, 45)" },
  { at: 14.6, name: 'grand', run: 'play(13)', caption: ['Split it. Focus it. Colour it.', 'real ray-traced optics'] },
  { at: 15.0, run: "drop('splitter', 2, 3, 90, 135)" },
  { at: 15.6, run: "drop('mirror', 4, 3, 0, 45)" },
  { at: 16.2, run: "drop('mirror', 4, 6, 0, 45)" },
  { at: 16.8, run: "drop('convex', 6, 6, 90, 90)" },
  { at: 17.4, run: "drop('splitter', 2, 1, 90, 135)" },
  { at: 18.0, run: "drop('prism', 5, 1, 0, 45)" },
  { at: 20.2, name: 'mirage', run: 'play(18)', caption: ['Heat haze. Raindrops. Diamonds.', 'chapter II · exotic optics'] },
  { at: 20.8, run: "drop('mirror', 2, 1, 0, 30)" },
  { at: 24.4, name: 'jam', run: 'play(-1)', caption: ['Every bench is a beat.', 'the light is the drum machine'] },
  { at: 24.6, run: "drop('convex', 2, 3, 90, 90)" },
  { at: 24.9, run: "drop('prism', 4, 3, 0, 15)" },
  { at: 25.2, run: "drop('cateye', 8, 3, 180, 180)" },
  { at: 25.5, run: "drop('splitter', 3, 6, 0, 45)" },
  { at: 25.8, run: "drop('cmirror', 3, 1, 90, 90)" },
  { at: 26.1, run: "drop('droplet', 7, 1, 0, 0)" },
  { at: 28.0, name: 'end', run: 'endCard()' },
];
const MUSIC = [{ name: 'title', from: 4.6, to: 32, gains: [[4.6, 1], [9.0, 1], [9.4, 0.55], [27.6, 0.55], [28.2, 1]] }];

// ---------- page-side helpers, injected before the game boots ----------
const INIT = `
  window.__vt = 0;
  const realNow = performance.now.bind(performance);
  performance.now = () => window.__vt;
  const rafs = [];
  window.requestAnimationFrame = cb => { rafs.push(cb); return rafs.length; };
  window.__advance = ms => { window.__vt += ms; const list = rafs.splice(0); for (const cb of list) cb(window.__vt); };
  window.__log = [];
  window.__bwAlign = { origin: ${MUSIC[0].from * 1000}, every: 4 };
`;
const SETUP = `
  document.documentElement.classList.add('trailer');
  // log every sound instead of playing it; the soundtrack is rendered offline afterwards
  for (const fn of ['sting', 'hit', 'place', 'tick', 'whoosh', 'bell', 'sparkle', 'charge', 'win', 'ting', 'ratchet', 'release', 'stow', 'select', 'hint', 'nudge'])
    AU[fn] = (...args) => { window.__log.push({ fn, args, t: performance.now() / 1000 }); };
  AU.ready = () => true; AU.init = () => {}; AU.music = () => {}; AU.at = ms => ms / 1000; AU.setLight = () => {}; AU.discharge = () => {}; AU.allOff = () => {};
  const B = window.__bw;
  window.play = i => { B.startPlay(i); B.layout(); };
  // a part dropped onto the bench, then turned to its angle one 15° detent at a time
  window.drop = (type, x, y, a0, a1) => {
    const p = B.placePiece(type, x, y, a0); const inv = B.S.inv; if (inv[type] !== Infinity && inv[type] > 0) inv[type]--;
    const steps = Math.round(((a1 - a0) % 360 + 360) % 360 / 15), dir = 15;
    const start = performance.now();
    for (let k = 1; k <= steps; k++) window.__later.push({ t: start + k * 70, fn: () => B.rotatePiece(p, dir) });
  };
  window.__later = [];
  window.endCard = () => { B.S.screen = 'play'; B.toTitle(); window.__end = performance.now(); };
`;
// captions and card text, drawn into the game's object layer so the shader composites them
const OVERLAY = `
  const CAP = window.__caps = window.__caps || [];
  const fontSans = '"B612", "DejaVu Sans", "Liberation Sans", sans-serif', fontMono = '"B612 Mono", "DejaVu Sans Mono", monospace';
  function fade(t, a, b, f = 400) { return Math.max(0, Math.min(1, (t - a) / f, (b - t) / f)); }
  window.__bwOverlay = (ctx, bctx, V, t) => {
    ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (const c of CAP) {
      const a = fade(t, c.from, c.to); if (a <= 0) continue;
      const x = 64, y = V.h - 84, rise = (1 - a) * 10;
      ctx.globalAlpha = a; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(8,9,11,0.55)'; ctx.fillRect(x - 24, y - 70 + rise, 640, 104);
      ctx.fillStyle = '#ffc366'; ctx.fillRect(x - 24, y - 70 + rise, 3, 104);
      ctx.font = '700 44px ' + fontSans; ctx.fillStyle = '#f4f1ea'; ctx.fillText(c.text, x, y - 16 + rise);
      ctx.font = '18px ' + fontMono; ctx.fillStyle = '#ffc366'; ctx.fillText(c.sub, x, y + 18 + rise);
    }
    const S = window.__bw.S;
    if (S.screen === 'ident') {
      const e = t - S.identT0, a = Math.max(0, Math.min(1, (e - 1500) / 700, (3800 - e) / 500));
      if (a > 0) { ctx.globalAlpha = a; ctx.font = '26px ' + fontMono; ctx.textAlign = 'center'; ctx.fillStyle = '#fff4dc';
        ctx.shadowColor = 'rgba(255,190,90,0.8)'; ctx.shadowBlur = 16; ctx.fillText('J A L A P E Ñ O   S E E D   P R O D U C T I O N S', V.w / 2, V.h * 0.78); ctx.shadowBlur = 0; }
    }
    if (S.screen === 'title') {
      const end = window.__end != null, e = t - (end ? window.__end : S.titleT0), a = Math.max(0, Math.min(1, (e - 900) / 800));
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      if (!end) { ctx.font = '18px ' + fontMono; ctx.fillStyle = '#e8ebef'; ctx.fillText('Jalapeño Seed Productions presents', V.w / 2, V.h * 0.475); }
      ctx.font = '20px ' + fontMono; ctx.fillStyle = '#ffc366'; ctx.fillText(end ? '22 benches of real ray-traced light' : 'an optics bench puzzle', V.w / 2, V.h * 0.8);
      if (end) {
        ctx.font = '700 30px ' + fontSans; ctx.fillStyle = '#f4f1ea'; ctx.fillText('Play free in your browser', V.w / 2, V.h * 0.875);
        ctx.font = '16px ' + fontMono; ctx.fillStyle = '#bcc3cb'; ctx.fillText('a Jalapeño Seed Productions game', V.w / 2, V.h * 0.935);
      }
    }
    ctx.restore();
  };
`;

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await page.addInitScript(INIT);
  await page.addStyleTag({ content: '' }).catch(() => {});
  await page.goto('file://' + path.join(root, 'dist', 'index.html'));
  await page.addStyleTag({ content: 'html.trailer .ov, html.trailer .bar, html.trailer .drawer { display: none !important; }' });
  await page.evaluate(SETUP);
  await page.evaluate(OVERLAY);
  await page.evaluate(caps => { window.__caps.push(...caps); }, SCENES.filter(s => s.caption).map(s => {
    const next = SCENES.find(n => n.name && n.at > s.at);
    return { from: (s.at + 0.3) * 1000, to: ((next ? next.at : TO) - 0.3) * 1000, text: s.caption[0], sub: s.caption[1] };
  }));

  const dt = 1000 / FPS, total = Math.round((TO - FROM) * FPS);
  const pending = SCENES.slice();
  // fast-forward to FROM without capturing
  let tms = 0;
  const step = async (capture) => {
    while (pending.length && pending[0].at * 1000 <= tms) { const s = pending.shift(); await page.evaluate(`(() => { const B = window.__bw; ${s.run}; })()`); }
    return page.evaluate(([ms, cap]) => {
      window.__skipGL = !cap;
      for (const l of window.__later.splice(0)) { if (l.t <= window.__vt + ms) l.fn(); else window.__later.push(l); }
      const w = document.getElementById('win'); if (!w.hidden) w.hidden = true;   // keep the bench in view after a win
      window.__advance(ms);
      return cap ? document.getElementById('gl').toDataURL('image/jpeg', 0.92) : null;
    }, [dt, capture]);
  };
  while (tms < FROM * 1000) { await step(false); tms += dt; }
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    const url = await step(!AUDIO_ONLY); tms += dt;
    if (AUDIO_ONLY) continue;
    fs.writeFileSync(path.join(work, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    if (f % FPS === 0) process.stdout.write(`\rframe ${f}/${total}  ${((Date.now() - t0) / 1000 / (f + 1)).toFixed(2)} s/frame   `);
  }
  console.log('\nrendering soundtrack...');
  const log = await page.evaluate(() => window.__log);
  const events = log.filter(e => e.t >= FROM && e.t < TO).map(e => ({ ...e, t: e.t - FROM, args: e.fn === 'hit' ? [e.args[0], e.args[1], e.args[2], e.args[3] - FROM] : e.args }));
  const music = MUSIC.map(m => ({ ...m, from: m.from - FROM, to: Math.min(TO, m.to) - FROM, gains: (m.gains || []).map(([t, g]) => [t - FROM, g]) }));
  const wav = await page.evaluate(spec => AU.renderOffline(spec), { duration: TO - FROM + 0.5, events, music });
  fs.writeFileSync(path.join(work, 'audio.wav'), Buffer.from(wav, 'base64'));
  await browser.close();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (AUDIO_ONLY) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.resolve(AUDIO_ONLY), '-i', path.join(work, 'audio.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
    console.log('wrote', OUT); return;
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(work, 'f%05d.jpg'), '-i', path.join(work, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('wrote', path.relative(process.cwd(), OUT), `(${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
})();
