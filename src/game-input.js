// ===== Game input: selection, pointer, drag, place/rotate/return, retrace, win =====
// (same IIFE scope as game.js; see tools/build.js for order)
function selPiece() { return S.placed.find(p => p.uid === S.sel); }
function updateStatus() {
  const el = $('#status'); const p = selPiece();
  if (p) {
    const d = PIECES[p.type];
    el.innerHTML = `<span class="vfd" data-plate="window"><span>${d.name}</span><em>${String(p.a).padStart(3, '0')}°</em><span class="sub">${d.spec}</span></span>
      <button class="key" data-plate="key" data-r="-15" aria-label="Rotate left">⟲ 15°</button><button class="key" data-plate="key" data-r="15" aria-label="Rotate right">⟳ 15°</button><button class="key" data-plate="key" data-ret="1">return</button>`;
  } else if (S.armed) {
    el.innerHTML = `<span class="etch">Tap an empty hole to mount the <b>${PIECES[S.armed].name}</b>.</span>`;
  } else el.innerHTML = `<span class="etch"></span>`, el.firstChild.textContent = S.level.tip || '';
}
$('#status').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const p = selPiece(); if (!p) return;
  if (b.dataset.r) rotatePiece(p, +b.dataset.r);
  if (b.dataset.ret) returnPiece(p);
});
function rotatePiece(p, d) { p.a = ((p.a + d) % 360 + 360) % 360; S.dirty = true; AU.ratchet(panOf(p.x + 0.5, p.y + 0.5)); updateStatus(); }
function returnPiece(p) {
  S.placed = S.placed.filter(q => q !== p); if (S.inv[p.type] !== Infinity) S.inv[p.type]++;
  S.sel = null; S.dirty = true; AU.stow(panOf(p.x + 0.5, p.y + 0.5)); buildParts(); updateStatus(); updateHeader();
}
function placePiece(type, x, y, a, uid) {
  const p = { type, x, y, a, uid: uid || S.uid++ }; S.placed.push(p); S.sel = p.uid; S.dirty = true;
  AU.place(NOTE[type]);
  buildParts(); updateStatus(); updateHeader(); return p;
}

// ---------- parts rack ----------
function buildParts() {
  const box = $('#parts'); box.innerHTML = '';
  for (const t of PIECE_ORDER) {
    if (!(t in S.inv)) continue;
    const n = S.inv[t];
    const b = document.createElement('button');
    b.className = 'pocket' + (n === 0 ? ' empty' : '') + (S.armed === t ? ' on' : '');
    b.dataset.plate = 'pocket'; b.dataset.type = t;
    b.setAttribute('aria-label', `${PIECES[t].name}, ${n === Infinity ? 'unlimited' : n} left`);
    b.innerHTML = `<canvas width="128" height="80"></canvas><span class="nm">${PIECES[t].name}</span><span class="ct">${n === Infinity ? '∞' : '×' + n}</span>`;
    box.appendChild(b);
    const g = b.querySelector('canvas').getContext('2d');
    g.setTransform(70, 0, 0, 70, 64, 40);
    drawPiece(g, { type: t, a: 0 }, { icon: true });
  }
}

// ---------- input ----------
function localPt(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
// Capture on the stable stage/rack, never on a pocket that buildParts replaces mid-drag.
const benchPointer = { id: null, owner: null };
function claimBenchPointer(e, owner) {
  if ((e.button != null && e.button !== 0) || (benchPointer.id != null && benchPointer.id !== e.pointerId)) return false;
  if (e.cancelable) e.preventDefault();
  benchPointer.id = e.pointerId; benchPointer.owner = owner;
  try { owner.setPointerCapture(e.pointerId); } catch (_) {}
  return true;
}
function releaseBenchPointer() {
  const { id, owner } = benchPointer;
  benchPointer.id = null; benchPointer.owner = null;
  try { if (owner && owner.hasPointerCapture(id)) owner.releasePointerCapture(id); } catch (_) {}
}
// iOS embedded browser sheets can steal a pan unless the touch itself is consumed.
// Keep modal scrolling, appearance sliders, and horizontal rack scrolling available.
function preventBenchPan(e) {
  if (modalOpen() || (S.screen !== 'play' && S.screen !== 'maker')) return;
  const onStage = e.target.closest && e.target.closest('#stage');
  const onPart = S.screen === 'play' && e.target.closest && e.target.closest('#parts .pocket');
  if ((benchPointer.id != null || onStage || onPart) && e.cancelable) e.preventDefault();
}
document.addEventListener('touchstart', preventBenchPan, { passive: false, capture: true });
document.addEventListener('touchmove', preventBenchPan, { passive: false, capture: true });

stage.addEventListener('pointerdown', e => {
  if (S.screen !== 'play' || modalOpen() || !claimBenchPointer(e, stage)) return;
  AU.init();
  const [sx, sy] = localPt(e), [wx, wy] = s2w(sx, sy);
  const sp = selPiece();
  if (sp) {
    const kx = sp.x + 0.5 + Math.cos(sp.a * RAD) * 0.62, ky = sp.y + 0.5 + Math.sin(sp.a * RAD) * 0.62;
    if (Math.hypot(wx - kx, wy - ky) < 0.2) { S.rot = { uid: sp.uid }; return; }
  }
  const cx = Math.floor(wx), cy = Math.floor(wy);
  const p = S.placed.find(q => q.x === cx && q.y === cy);
  if (p) { S.press = { uid: p.uid, sx: e.clientX, sy: e.clientY }; return; }
  if (S.armed && !occupiedBy(cx, cy)) {
    const t = S.armed; if (S.inv[t] !== Infinity) S.inv[t]--;
    placePiece(t, cx, cy, DEFAULT_A[t]); if (!S.inv[t]) S.armed = null; buildParts(); updateStatus(); return;
  }
  S.sel = null; S.armed = null; buildParts(); updateStatus();
});
$('#parts').addEventListener('pointerdown', e => {
  if (S.screen !== 'play' || modalOpen()) return;
  const b = e.target.closest('.pocket'); if (!b) return;
  const t = b.dataset.type; if (!S.inv[t] || !claimBenchPointer(e, e.currentTarget)) return;
  AU.init();
  S.press = { tray: t, sx: e.clientX, sy: e.clientY };
});
window.addEventListener('pointermove', e => {
  if (benchPointer.id != null && e.pointerId !== benchPointer.id) return;
  if (benchPointer.id != null && e.cancelable) e.preventDefault();
  S.pointer = localPt(e);
  if (S.press && Math.hypot(e.clientX - S.press.sx, e.clientY - S.press.sy) > 7) {
    if (S.press.tray) {
      const t = S.press.tray; if (S.inv[t] !== Infinity) S.inv[t]--;
      S.drag = { type: t, a: DEFAULT_A[t], uid: S.uid++, from: 'tray' }; buildParts();
      AU.release((e.clientX / innerWidth) * 1.6 - 0.8);
    } else {
      const p = S.placed.find(q => q.uid === S.press.uid);
      S.placed = S.placed.filter(q => q !== p);
      S.drag = { type: p.type, a: p.a, uid: p.uid, from: 'board', ox: p.x, oy: p.y };
      AU.release(panOf(p.x + 0.5, p.y + 0.5));
    }
    S.press = null; S.sel = null; S.armed = null; updateStatus();
  }
  if (S.drag) { updateDragCell(); S.dirty = true; }
  if (S.rot) {
    const p = S.placed.find(q => q.uid === S.rot.uid); if (!p) return;
    const [wx, wy] = s2w(...S.pointer);
    let a = Math.atan2(wy - p.y - 0.5, wx - p.x - 0.5) / RAD; a = ((Math.round(a / 15) * 15) % 360 + 360) % 360;
    if (a !== p.a) { p.a = a; S.dirty = true; AU.ratchet(panOf(p.x + 0.5, p.y + 0.5)); updateStatus(); }
  }
});
function updateDragCell() {
  const [wx, wy] = s2w(...S.pointer); const cx = Math.floor(wx), cy = Math.floor(wy);
  const inside = cx >= 0 && cy >= 0 && cx < S.level.w && cy < S.level.h;
  S.drag.wx = wx; S.drag.wy = wy; S.drag.inside = inside;
  S.drag.cell = inside && !occupiedBy(cx, cy) ? [cx, cy] : null;
}
function endPointer(e, cancel) {
  if (benchPointer.id == null || e.pointerId !== benchPointer.id) return;
  if (e.cancelable) e.preventDefault();
  if (S.drag && !cancel) { S.pointer = localPt(e); updateDragCell(); }
  if (S.drag) {
    const d = S.drag; S.drag = null;
    if (cancel && d.from === 'board') placePiece(d.type, d.ox, d.oy, d.a, d.uid);
    else if (d.cell && !cancel) placePiece(d.type, d.cell[0], d.cell[1], d.a, d.uid);
    else { if (S.inv[d.type] !== Infinity) S.inv[d.type]++; AU.stow((e.clientX / innerWidth) * 1.6 - 0.8); buildParts(); updateHeader(); }
    S.dirty = true;
  } else if (S.press && !cancel) {
    if (S.press.tray) { S.armed = S.armed === S.press.tray ? null : S.press.tray; S.sel = null; AU.key(); buildParts(); updateStatus(); }
    else { const p = S.placed.find(q => q.uid === S.press.uid); if (p) { if (S.sel === p.uid) rotatePiece(p, 15); else { S.sel = p.uid; AU.select(); updateStatus(); } } }
  }
  S.press = null; S.rot = null;
  releaseBenchPointer();
}
for (const owner of [stage, $('#parts')]) owner.addEventListener('lostpointercapture', e => endPointer(e, true));
window.addEventListener('blur', () => { if (benchPointer.id != null) endPointer({ pointerId: benchPointer.id, clientX: innerWidth / 2, clientY: innerHeight / 2 }, true); });
window.addEventListener('pointerup', e => endPointer(e, false));
window.addEventListener('pointercancel', e => endPointer(e, true));
stage.addEventListener('wheel', e => { const p = selPiece(); if (!p || S.screen !== 'play') return; e.preventDefault(); rotatePiece(p, e.deltaY > 0 ? 15 : -15); }, { passive: false });
window.addEventListener('keydown', e => {
  if (S.screen !== 'play') return; const p = selPiece();
  if (p && (e.key === 'e' || e.key === 'ArrowRight')) { rotatePiece(p, 15); e.preventDefault(); }
  if (p && (e.key === 'q' || e.key === 'ArrowLeft')) { rotatePiece(p, -15); e.preventDefault(); }
  if (p && (e.key === 'Delete' || e.key === 'Backspace')) returnPiece(p);
  if (e.key === 'Escape' && !modalOpen()) {
    if (S.sel || S.armed) { S.sel = null; S.armed = null; buildParts(); updateStatus(); }
    else openPause();
  }
});
// pressed / hovered state for the shader-drawn plates
let downEl = null;
// the rack scrolls sideways under a plain mouse wheel when it is wider than the screen
$('#parts').addEventListener('wheel', e => { const r = e.currentTarget; if (r.scrollWidth <= r.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); r.scrollLeft += e.deltaY; }, { passive: false });
['pointerdown', 'keydown', 'wheel'].forEach(ev => window.addEventListener(ev, () => { S.lastAct = performance.now(); }, true));
document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-plate]'); if (el) el.classList.add('is-hover'); });
document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('[data-plate]'); if (el && !el.contains(e.relatedTarget)) el.classList.remove('is-hover'); });
document.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('button[data-plate]'); if (el && !el.disabled) { el.classList.add('is-down'); downEl = el; } }, true);
window.addEventListener('pointerup', () => { if (downEl) downEl.classList.remove('is-down'); downEl = null; }, true);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.key')) AU.key(); }, true);

// ---------- trace + sound events ----------
let sparkCum = [], sparkTotal = 0;
function retrace() {
  S.dirty = false;
  const list = S.placed.slice();
  if (S.drag && S.drag.cell) list.push({ type: S.drag.type, x: S.drag.cell[0], y: S.drag.cell[1], a: S.drag.a, uid: S.drag.uid });
  if (S.screen === 'title') S.level.fixed[1].a = S.demoT;
  const res = S.res = trace(S.level, list);
  sparkCum = []; sparkTotal = 0;
  for (const s of res.segs) { sparkTotal += Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * Math.sqrt(s.I); sparkCum.push(sparkTotal); }
  if (S.screen === 'title') AU.setLight(0.3, 0.6, true);
  const L0 = S.level;
  if (S.screen !== 'play') return;
  const now = performance.now();
  // the beat: rebuild the light pattern; when the path really changed (and nothing is being dragged), fire a fresh pulse
  if (!S.drag && !S.rot) {
    const pat = buildPattern(res);
    if (pat.sig !== SEQ.sig) { Object.assign(SEQ, pat); restartLoop(); }
  }
  // when each pulse lands in each cell (in sequencer steps), so the cell can flash on the beat
  S.arrive = L0.targets.map(() => []);
  for (const sg of res.segs) if (sg.ti !== undefined && sg.I > 0.01 && S.arrive[sg.ti].every(a => Math.abs(a - sg.d1) > 0.3)) S.arrive[sg.ti].push(sg.d1);
  const lit = {};
  for (const p of list) if ((res.hits[p.uid] || 0) > 0.02) lit[p.uid] = 1;
  S.litP = lit;
  const L = S.level;
  res.lit.forEach((on, i) => {
    const tg = L.targets[i], pan = panOf(tg.x + 0.5, tg.y + 0.5);
    if (on && !S.litT[i]) { AU.charge('t' + i, TNOTE[i % 4], pan); (S.litAt = S.litAt || [])[i] = now; }
    if (!on && S.litT[i]) AU.discharge('t' + i);
  });
  S.litT = res.lit.slice();
  const share = L.targets.length ? L.targets.reduce((a, t, i) => a + Math.min(1, res.lm[i] / t.need), 0) / L.targets.length : 0;
  AU.setLight(share, Math.min(1, res.segs.length / 25), false);
  updateHeader();
}
function checkWin(now) {
  if (S.screen !== 'play' || S.li === -1) return;
  const ok = S.res && S.res.win && !S.drag && !S.rot && !S.press;
  if (!ok) { S.winAt = 0; if (!(S.res && S.res.win)) S.winShown = false; return; }
  if (!S.winAt) S.winAt = now;
  if (!S.winShown && now - S.winAt > 650) { S.winShown = true; showWin(); }
}
function starsFor(n, par) { return n <= par ? 3 : n <= par + 1 ? 2 : 1; }
function showWin() {
  const L = S.level, n = S.placed.length;
  if (S.li === -2) {
    $('#winEyebrow').textContent = `${L.name} · all cells lit`;
    $('#winTitle').textContent = 'Your bench works';
    $('#winStars').innerHTML = '';
    $('#wPieces').textContent = n; $('#wPar').textContent = L.par || '–';
    $('#wLm').textContent = Math.round(S.res.lm.reduce((a, b) => a + b, 0)) + ' lm';
    $('#winNext').textContent = 'back to the maker →';
    $('#win').hidden = false; focusFirst('#win'); AU.win(); return;
  }
  if (S.li === -4) { communityWin(n); return; }
  const st = starsFor(n, L.par);
  const prev = progress[S.li] || 0; if (st > prev) { progress[S.li] = st; store.set('progress', progress); }
  const last = S.li === LEVELS.length - 1, chapEnd = S.li === CH2 - 1;
  $('#winEyebrow').textContent = `bench ${String(S.li + 1).padStart(2, '0')} · all cells lit`;
  $('#winTitle').textContent = last ? 'Every bench is lit' : chapEnd ? 'Chapter I complete' : ['Circuit complete', 'Light delivered', 'Photocells humming', 'Clean optics'][S.li % 4];
  $('#winStars').innerHTML = [0, 1, 2].map(i => `<i data-plate="led"${i < st ? ' class="on"' : ''}></i>`).join('');
  $('#winStars').setAttribute('aria-label', `${st} of 3`);
  $('#wPieces').textContent = n; $('#wPar').textContent = L.par;
  $('#wLm').textContent = Math.round(S.res.lm.reduce((a, b) => a + b, 0)) + ' lm';
  $('#winNext').textContent = last ? 'free bench →' : chapEnd ? 'start chapter II →' : 'next bench →';
  $('#win').hidden = false; focusFirst('#win');
  AU.win();
}
$('#winStay').onclick = () => { $('#win').hidden = true; };
$('#winNext').onclick = () => { $('#win').hidden = true; if (S.li === -2) backToMaker(); else if (S.li === -4) { if (S.ci + 1 < COMMUNITY.length) playCommunity(S.ci + 1); else showLevels(); } else if (S.li === LEVELS.length - 1) loadLevel(-1); else loadLevel(S.li + 1); };

