// ===== Game UI: frame loop, modals, menus, level picker, start =====
// (same IIFE scope as game.js; see tools/build.js for order)
let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (S.screen === 'title') { S.demoT = window.__demoA != null ? window.__demoA + 5 * Math.sin(t * 0.0009) : (t * 0.012) % 120; S.dirty = true; }
  if (S.dirty) retrace();
  stepSparks(dt);
  seqTick(t);
  if (S.screen === 'title') { while (t - SEQ.loopStart > SEQ.steps * STEP_MS) SEQ.loopStart += SEQ.steps * STEP_MS; }
  draw(t);
  if (GLR.ok && !window.__skipGL) {
    const anyOverlay = modalOpen();
    GLR.frame({
      obj: cv, beam: bv, stage: stage.getBoundingClientRect(),
      board: [V.ox, V.oy, V.cell, V.rot ? 1 : 0], wh: [S.level.w, S.level.h], showBoard: S.screen === 'play' || S.screen === 'title' || S.screen === 'maker',
      dim: anyOverlay ? 1 : S.screen === 'title' ? 0.2 : 0, hideBase: anyOverlay, time: t / 1000, motion: reduceMotion ? 0 : 1,
    });
  }
  document.body.classList.toggle('has-ov', modalOpen());
  // idle nudge: after a quiet spell on an unsolved bench, the hint key starts to glow
  const nudge = S.screen === 'play' && S.li >= 0 && S.res && !S.res.win && !S.drag && S.hint < S.level.sol.length && t - S.lastAct > IDLE_MS;
  if (nudge !== S.nudging) { S.nudging = nudge; $('#hintBtn').classList.toggle('attn', nudge); if (nudge) AU.nudge(); }
  checkWin(t);
}

// ---------- menus and navigation ----------
function modalOpen() { return [...document.querySelectorAll('.ov.modal')].some(el => !el.hidden); }
function closeModals() { document.querySelectorAll('.ov.modal').forEach(el => { el.hidden = true; }); }
function focusFirst(sel) { requestAnimationFrame(() => { const el = $(sel).querySelector('button:not(:disabled), input'); if (el) el.focus({ preventScroll: true }); }); }
// the in-game menu: what it offers depends on where you are
function openPause() {
  if (S.screen !== 'play' && S.screen !== 'maker') return;
  const m = $('#pauseMenu'); m.innerHTML = '';
  const key = (label, fn, opts = {}) => { const b = document.createElement('button'); b.className = 'key' + (opts.accent ? ' accent' : ''); b.dataset.plate = opts.accent ? 'accent' : 'key'; b.textContent = label; b.disabled = !!opts.disabled; b.onclick = () => { $('#pause').hidden = true; fn(); }; return b; };
  const L = S.level;
  if (S.screen === 'maker') {
    $('#pauseLegend').textContent = 'bench maker · ' + L.name;
    m.append(key('resume', () => {}, { accent: true }), key('test this bench', () => testBench()), key('bench settings', () => openMakerPanel()), key('choose bench', showLevels), key('main menu', toTitle));
  } else if (S.li === -4) {
    $('#pauseLegend').textContent = `community · ${L.name} by ${L.author}`;
    const pair = document.createElement('div'); pair.className = 'pair';
    pair.append(key('‹ previous', () => playCommunity(S.ci - 1), { disabled: S.ci === 0 }), key('next ›', () => playCommunity(S.ci + 1), { disabled: S.ci >= COMMUNITY.length - 1 }));
    m.append(key('resume', () => {}, { accent: true }), key('restart bench', () => { AU.stow(0); loadLevel(-4); }), pair, key('remix in the maker', remixCommunity), key('choose bench', showLevels), key('main menu', toTitle));
  } else if (S.li === -2) {
    $('#pauseLegend').textContent = 'testing · ' + L.name;
    m.append(key('resume', () => {}, { accent: true }), key('restart bench', () => loadLevel(-2, null, L)), key('back to the maker', backToMaker), key('main menu', toTitle));
  } else {
    $('#pauseLegend').textContent = S.li < 0 ? 'free bench' : `bench ${String(S.li + 1).padStart(2, '0')} · ${L.name}`;
    m.append(key('resume', () => {}, { accent: true }), key('restart bench', () => { AU.stow(0); loadLevel(S.li); }));
    if (S.li >= 0) {
      const pair = document.createElement('div'); pair.className = 'pair';
      pair.append(key('‹ previous', () => loadLevel(S.li - 1), { disabled: S.li === 0 }), key('next ›', () => loadLevel(S.li + 1), { disabled: S.li >= LEVELS.length - 1 || !unlocked(S.li + 1) }));
      m.append(pair);
    }
    m.append(key('choose bench', showLevels), key('bench maker', () => openMaker(null)), key('main menu', toTitle));
  }
  m.append(key('skins & readability', () => SKIN.open()));
  closeModals(); $('#pause').hidden = false; focusFirst('#pauseMenu');
}
// Esc closes whatever menu is open, innermost first
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#codeov').hidden) { $('#codeov').hidden = true; e.stopImmediatePropagation(); return; }
  if (!$('#makerov').hidden) { closeMakerPanel(); e.stopImmediatePropagation(); return; }
  if (!$('#levels').hidden) { closeLevels(); e.stopImmediatePropagation(); return; }
  if (!$('#pause').hidden) { $('#pause').hidden = true; e.stopImmediatePropagation(); return; }
  if (!$('#win').hidden) { $('#win').hidden = true; e.stopImmediatePropagation(); }
}, true);
// arrow keys move between bench slots in the picker
$('#levelGrid').addEventListener('keydown', e => {
  const slots = [...$('#levelGrid').querySelectorAll('.slot:not(:disabled)')], i = slots.indexOf(document.activeElement);
  if (i < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const r0 = slots[i].getBoundingClientRect(); let best = null, bd = Infinity;
  for (const s of slots) {
    if (s === slots[i]) continue; const r = s.getBoundingClientRect(), dx = r.left - r0.left, dy = r.top - r0.top;
    const ok = e.key === 'ArrowLeft' ? dx < -4 && Math.abs(dy) < 8 : e.key === 'ArrowRight' ? dx > 4 && Math.abs(dy) < 8 : e.key === 'ArrowUp' ? dy < -4 : dy > 4;
    if (!ok) continue; const d = Math.abs(dx) + Math.abs(dy) * 2; if (d < bd) { bd = d; best = s; }
  }
  (best || slots[i]).focus();
});

// ---------- screens ----------
function firstOpen() { for (let i = 0; i < LEVELS.length; i++) if (!progress[i]) return i; return LEVELS.length - 1; }
function unlocked(i) { return i === 0 || i === CH2 || progress[i - 1] || progress[i]; }
function showLevels() {
  const g = $('#levelGrid'); g.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    if (i === 0 || i === CH2) {
      const hd = document.createElement('div'); hd.className = 'chap etch';
      hd.innerHTML = i === 0 ? '<span>chapter I</span>The Bench' : '<span>chapter II</span>Exotic Optics';
      g.appendChild(hd);
    }
    const b = document.createElement('button'); b.className = 'slot'; b.dataset.plate = 'pocket'; b.disabled = !unlocked(i);
    const st = progress[i] || 0;
    b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}${b.disabled ? ' · locked' : ''}</span><span class="t">${lv.name}</span><span class="s">${[0, 1, 2].map(k => `<i style="border-radius:50%;background:${k < st ? 'var(--vfd);box-shadow:0 0 6px var(--vfd-glow)' : '#2a1d10'}"></i>`).join('')}</span>`;
    b.setAttribute('aria-label', `Bench ${i + 1}, ${lv.name}${b.disabled ? ', locked' : st ? `, ${st} of 3` : ''}`);
    b.onclick = () => { $('#levels').hidden = true; startPlay(i); };
    g.appendChild(b);
  });
  communitySlots(g);   // community benches (community.js)
  makerSlots(g);   // My benches (maker.js)
  const f = document.createElement('button'); f.className = 'slot'; f.dataset.plate = 'pocket';
  f.innerHTML = `<span class="n">LAB</span><span class="t">Free bench</span><span class="s" style="font-size:11px;color:var(--ink-dim);height:auto">every part, unlimited</span>`;
  f.onclick = () => { $('#levels').hidden = true; startPlay(-1); };
  g.appendChild(f);
  closeModals(); $('#levels').hidden = false; focusFirst('#levelGrid');
  AU.music('menu');
}
function startPlay(i, keep, custom) {
  AU.init(); closeModals(); document.body.classList.remove('in-maker');
  $('#title').hidden = true; $('#gate').hidden = true; $('#ident').hidden = true; S.screen = 'play'; document.body.classList.remove('on-title');
  AU.music(null);
  loadLevel(i, keep, custom);
}
$('#startBtn').onclick = () => startPlay(store.get('last', null) ?? firstOpen());
$('#titleLevels').onclick = () => { AU.init(); showLevels(); };
$('#titleFree').onclick = () => startPlay(-1);
$('#menuBtn').onclick = () => openPause();
$('#titleMaker').onclick = () => { AU.init(); openMaker(null); };
$('#levelsClose').onclick = closeLevels;
function closeLevels() { $('#levels').hidden = true; AU.music(S.screen === 'title' ? 'title' : null); }
$('#resetBtn').onclick = () => { if (S.screen === 'play') { AU.stow(0); loadLevel(S.li); } };
$('#hintBtn').onclick = () => {
  const L = S.level; if (!L.sol.length) return;
  S.hint = Math.min(L.sol.length, S.hint + 1); AU.hint(); updateHeader();
  const hp = L.sol[S.hint - 1];
  $('#status').innerHTML = `<span class="etch">Hint: a <b>${PIECES[hp.type].name}</b> goes on the dashed square, turned to <b>${String(hp.a).padStart(3, '0')}°</b>.</span>`;
};
$('#soundBtn').onclick = () => { AU.init(); AU.setOn(!AU.on); updateHeader(); };
window.addEventListener('resize', () => layout());
if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(stage);

window.claude?.hot?.snapshot?.(() => ({ screen: S.screen, li: S.li, placed: S.placed.map(({ type, x, y, a }) => ({ type, x, y, a })) }));
// gate: browsers need a tap before sound can play, so the bench waits to be switched on
$('#gateBtn').onclick = () => { AU.init(); startIdent(); };
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, e => {
  if (S.screen === 'ident' && performance.now() - S.identT0 > 400) { e.stopPropagation(); toTitle(); }   // skip the ident
}, true));
// hooks for tools/trailer.js, which drives the game frame by frame to film the trailer
window.__bw = { S, LEVELS, SANDBOX, SEQ, startPlay, loadLevel, placePiece, rotatePiece, startIdent, toTitle, showLevels, layout, restartLoop };
function start(data) {
  data = data || window.claude?.hot?.data || {};
  if (!GLR.init($('#gl'))) document.documentElement.classList.add('no-gl');
  document.body.classList.add('on-title');
  S.screen = 'gate'; $('#title').hidden = true; $('#gate').hidden = false;
  layout(); buildParts(); updateHeader();
  if (data.screen === 'play' && data.li != null && (data.li === -1 || LEVELS[data.li])) startPlay(data.li, data.placed);
  else if (data.screen === 'title') toTitle();
  requestAnimationFrame(frame);
}
