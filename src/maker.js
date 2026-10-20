// ===== Bench maker =====
// Build your own bench: light sources, photocells, walls and fixed parts on a board you size yourself,
// plus the parts the player gets. Test-play it, let the solver check it (in a worker), keep it under
// "My benches", and share it as a code.
const MK = { level: null, idx: null, tool: 'wall', sel: null, paint: null, lastCell: '', checking: null, delArmed: false };
const SRC_COLORS = BENCH.SRC_COLORS, CELL_COLORS = BENCH.CELL_COLORS;
const CELL_SIZES = [[0.3, 'photocell'], [0.1, 'pinhole'], [0.42, 'wide']];
const TOOL_HELP = {
  source: 'Tap a hole to place a light source. Tap it again to turn it.',
  cell: 'Tap a hole to place a photocell. Select it to set its colour, size and the lumens it needs.',
  wall: 'Drag across the bench to lay walls. Drag over walls to clear them.',
  erase: 'Drag across anything to remove it.',
};
const colorName = c => c === 'any' ? 'any light' : c === 'W' ? 'white' : `${SPEC[c].label.toLowerCase()} ${SPEC[c].nm} nm`;

function customs() { return store.get('custom', []); }
function saveCustoms(list) { store.set('custom', list); }
function saveBench() { if (MK.idx == null) return; const list = customs(); list[MK.idx] = MK.level; saveCustoms(list); }
function newBench() {
  const n = customs().length + 1;
  return { name: `My bench ${n}`, w: 9, h: 7, tip: '', custom: true, sources: [{ x: 0, y: 3, a: 0 }], targets: [{ x: 8, y: 3, need: 40 }], walls: [], fixed: [], mirage: [], inv: { mirror: 2 }, sol: [], par: 0 };
}
// geometry changed: old solutions and par no longer apply
function changed(walls) { const L = MK.level; L.sol = []; L.par = 0; S.dirty = true; if (walls) statics = null; saveBench(); makerHeader(); }

// ---------- entering and leaving ----------
function openMaker(idx) {
  const list = customs();
  if (idx == null || !list[idx]) { list.push(newBench()); saveCustoms(list); idx = list.length - 1; }
  MK.idx = idx; MK.level = customs()[idx]; MK.sel = null; MK.check = null;
  closeModals(); AU.allOff();
  $('#title').hidden = true; $('#gate').hidden = true; $('#ident').hidden = true;
  document.body.classList.remove('on-title'); document.body.classList.add('in-maker');
  S.screen = 'maker'; S.li = -3; S.level = MK.level; S.placed = []; S.sel = null; S.armed = null; S.drag = null; S.hint = 0; S.dirty = true;
  statics = null; layout(); buildMakerRack(); makerHeader(); makerStatus();
  AU.music('menu');
}
function backToMaker() { openMaker(MK.idx); }
function testBench() {
  const L = MK.level;
  if (!L.sources.length || !L.targets.length) { makerStatus('Add at least one light source and one photocell before testing.'); return; }
  const copy = JSON.parse(JSON.stringify(L)); copy.inv = { ...L.inv };
  startPlay(-2, null, copy);
}
function makerHeader() {
  const L = MK.level; if (!L) return;
  $('#lvlNum').textContent = 'MAKER'; $('#lvlName').textContent = L.name;
  $('#lvlPar').textContent = `${L.w}×${L.h}${L.par ? ' · par ' + L.par : ''}`;
  $('#soundBtn').setAttribute('aria-pressed', AU.on ? 'true' : 'false');
}

// ---------- tools rack ----------
function drawToolIcon(g, tool) {
  g.save();
  if (tool === 'source') {
    g.scale(0.85, 0.85); emitterBody(g, null, 0.02);
    g.fillStyle = 'rgba(255,224,160,0.95)'; g.fillRect(0.305, -0.12, 0.028, 0.24);
    g.strokeStyle = 'rgba(255,210,122,0.8)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(0.36, 0); g.lineTo(0.62, 0); g.stroke();
  } else if (tool === 'cell') {
    g.scale(0.85, 0.85); cellBody(g, 0, 0, { need: 40 }, 0.02);
    const s = cellGeom({}); g.strokeStyle = '#ffc366'; g.lineWidth = 0.034;
    for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(0, 0, s.ring, -Math.PI / 2 + (k + 0.18) / CELL_SEGS * Math.PI * 2, -Math.PI / 2 + (k + 0.82) / CELL_SEGS * Math.PI * 2); g.stroke(); }
  } else if (tool === 'wall') {
    const wg = g.createLinearGradient(-0.35, -0.35, 0.35, 0.35); wg.addColorStop(0, '#3a3e45'); wg.addColorStop(1, '#16181b');
    g.fillStyle = wg; rr(g, -0.34, -0.34, 0.68, 0.68, 0.05); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 0.02; g.stroke();
  } else if (tool === 'erase') {
    g.strokeStyle = '#d6dbe1'; g.lineWidth = 0.06; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-0.22, -0.22); g.lineTo(0.22, 0.22); g.moveTo(0.22, -0.22); g.lineTo(-0.22, 0.22); g.stroke();
  } else drawPiece(g, { type: tool, a: 0 }, { icon: true });
  g.restore();
}
function buildMakerRack() {
  const box = $('#parts'); box.innerHTML = '';
  const tools = [['source', 'Light source'], ['cell', 'Photocell'], ['wall', 'Wall'], ['erase', 'Eraser'], ...PIECE_ORDER.map(t => [t, PIECES[t].name])];
  tools.forEach(([t, name], i) => {
    const b = document.createElement('button');
    b.className = 'pocket tool' + (MK.tool === t ? ' on' : ''); b.dataset.plate = 'pocket'; b.dataset.tool = t;
    b.setAttribute('aria-label', `${name} tool`); b.setAttribute('aria-pressed', MK.tool === t ? 'true' : 'false');
    b.innerHTML = `<canvas width="128" height="80"></canvas><span class="nm">${name}</span>${i >= 4 ? '<span class="ct">fixed</span>' : ''}`;
    box.appendChild(b);
    const g = b.querySelector('canvas').getContext('2d'); g.setTransform(70, 0, 0, 70, 64, 40); drawToolIcon(g, t);
  });
}
$('#parts').addEventListener('click', e => {
  if (S.screen !== 'maker') return;
  const b = e.target.closest('[data-tool]'); if (!b) return;
  MK.tool = b.dataset.tool; MK.sel = null; buildMakerRack(); makerStatus();
});

// ---------- the board ----------
function itemAt(x, y) {
  const L = MK.level;
  let i = L.sources.findIndex(s => s.x === x && s.y === y); if (i >= 0) return { kind: 'source', i };
  i = L.targets.findIndex(t => t.x === x && t.y === y); if (i >= 0) return { kind: 'target', i };
  i = L.fixed.findIndex(p => p.x === x && p.y === y); if (i >= 0) return { kind: 'fixed', i };
  i = L.walls.findIndex(([a, b]) => a === x && b === y); if (i >= 0) return { kind: 'wall', i };
  return null;
}
function removeItem(hit) {
  const L = MK.level, list = { source: L.sources, target: L.targets, fixed: L.fixed, wall: L.walls }[hit.kind];
  list.splice(hit.i, 1); if (MK.sel && MK.sel.kind === hit.kind) MK.sel = null; changed(hit.kind === 'wall');
}
function cellAtEvent(e) { const [wx, wy] = s2w(...localPt(e)); return [Math.floor(wx), Math.floor(wy)]; }
function inBench(x, y) { return x >= 0 && y >= 0 && x < MK.level.w && y < MK.level.h; }
function paintAt(x, y) {
  if (!inBench(x, y) || MK.lastCell === x + ',' + y) return; MK.lastCell = x + ',' + y;
  const hit = itemAt(x, y);
  if (MK.paint === 'erase') { if (hit) { removeItem(hit); AU.tick(); } }
  else if (MK.paint === 'add') { if (!hit) { MK.level.walls.push([x, y]); changed(true); AU.tick(); } }
  else if (MK.paint === 'remove') { if (hit && hit.kind === 'wall') { removeItem(hit); AU.tick(); } }
}
stage.addEventListener('pointerdown', e => {
  if (S.screen !== 'maker' || modalOpen()) return;
  AU.init(); MK.delArmed = false;
  const [x, y] = cellAtEvent(e), L = MK.level;
  if (!inBench(x, y)) { MK.sel = null; makerStatus(); return; }
  const hit = itemAt(x, y), t = MK.tool;
  MK.lastCell = '';
  if (t === 'erase') { MK.paint = 'erase'; stage.setPointerCapture(e.pointerId); paintAt(x, y); return; }
  if (t === 'wall' && (!hit || hit.kind === 'wall')) { MK.paint = hit ? 'remove' : 'add'; stage.setPointerCapture(e.pointerId); paintAt(x, y); return; }
  if (hit) {
    const same = MK.sel && MK.sel.kind === hit.kind && MK.sel.i === hit.i;
    if (same && hit.kind === 'source') { L.sources[hit.i].a = (L.sources[hit.i].a + 90) % 360; changed(); AU.ratchet(); }
    else if (same && hit.kind === 'fixed') { const p = L.fixed[hit.i]; p.a = (p.a + 15) % 360; changed(); AU.ratchet(); }
    else { MK.sel = hit; AU.select(); }
    makerStatus(); return;
  }
  if (t === 'source') { L.sources.push({ x, y, a: 0 }); MK.sel = { kind: 'source', i: L.sources.length - 1 }; }
  else if (t === 'cell') { L.targets.push({ x, y, need: 40 }); MK.sel = { kind: 'target', i: L.targets.length - 1 }; }
  else if (PIECES[t]) { L.fixed.push({ type: t, x, y, a: DEFAULT_A[t] }); MK.sel = { kind: 'fixed', i: L.fixed.length - 1 }; }
  changed(); AU.place(880); makerStatus();
});
window.addEventListener('pointermove', e => { if (S.screen === 'maker' && MK.paint) paintAt(...cellAtEvent(e)); });
window.addEventListener('pointerup', () => { if (MK.paint) { MK.paint = null; makerStatus(); } });
window.addEventListener('keydown', e => {
  if (S.screen !== 'maker' || modalOpen() || e.target.closest('input')) return;
  if (e.key === 'Escape') { if (MK.sel) { MK.sel = null; makerStatus(); } else openPause(); }
  if (MK.sel && (e.key === 'Delete' || e.key === 'Backspace')) { removeItem(MK.sel); makerStatus(); }
  if (MK.sel && (e.key === 'e' || e.key === 'q')) inspect(MK.sel.kind === 'source' ? (e.key === 'e' ? 'rot+90' : 'rot-90') : (e.key === 'e' ? 'rot+15' : 'rot-15'));
});
// selection marker, drawn by game.js draw()
function drawMakerMarks(t) {
  if (!MK.sel) return; const L = MK.level;
  const it = MK.sel.kind === 'source' ? L.sources[MK.sel.i] : MK.sel.kind === 'target' ? L.targets[MK.sel.i] : MK.sel.kind === 'fixed' ? L.fixed[MK.sel.i] : null;
  if (!it) return;
  setWorld(ctx); ctx.save(); ctx.setLineDash([0.07, 0.05]); ctx.lineDashOffset = reduceMotion ? 0 : -t * 0.0004;
  ctx.strokeStyle = 'rgba(255,195,102,0.85)'; ctx.lineWidth = 1.6 / V.cell; rr(ctx, it.x + 0.04, it.y + 0.04, 0.92, 0.92, 0.1); ctx.stroke(); ctx.restore();
}

// ---------- the inspector, in the status line ----------
function makerStatus(msg) {
  const el = $('#status'), L = MK.level, sel = MK.sel;
  const k = (label, act, aria) => `<button class="key" data-plate="key" data-mk="${act}"${aria ? ` aria-label="${aria}"` : ''}>${label}</button>`;
  if (msg) { el.innerHTML = `<span class="etch">${msg}</span>`; return; }
  if (sel && sel.kind === 'source') {
    const s = L.sources[sel.i];
    el.innerHTML = `<span class="vfd" data-plate="window"><span>Light source</span><em>${String(s.a).padStart(3, '0')}°</em><span class="sub">${colorName(s.color || 'W')}</span></span>${k('⟲', 'rot-90', 'Turn left')}${k('⟳', 'rot+90', 'Turn right')}${k('colour', 'color')}${k('remove', 'remove')}`;
  } else if (sel && sel.kind === 'target') {
    const t = L.targets[sel.i], size = (CELL_SIZES.find(z => z[0] === (t.r || 0.3)) || CELL_SIZES[0])[1];
    el.innerHTML = `<span class="vfd" data-plate="window"><span>Photocell</span><em>${t.need} lm</em><span class="sub">${colorName(t.color || 'any')} · ${size}</span></span>${k('−', 'need-', 'Needs less light')}${k('+', 'need+', 'Needs more light')}${k('colour', 'color')}${k('size', 'size')}${k('remove', 'remove')}`;
  } else if (sel && sel.kind === 'fixed') {
    const p = L.fixed[sel.i];
    el.innerHTML = `<span class="vfd" data-plate="window"><span>${PIECES[p.type].name} · fixed</span><em>${String(p.a).padStart(3, '0')}°</em></span>${k('⟲ 15°', 'rot-15')}${k('⟳ 15°', 'rot+15')}${k('remove', 'remove')}`;
  } else {
    const help = TOOL_HELP[MK.tool] || `Tap a hole to fix a ${PIECES[MK.tool].name} in place. The player can't move it. Tap it again to turn it.`;
    el.innerHTML = `<span class="etch">${help}</span>`;
  }
}
function inspect(act) {
  const L = MK.level, sel = MK.sel; if (!sel) return;
  if (act === 'remove') { removeItem(sel); AU.stow(); makerStatus(); return; }
  if (sel.kind === 'source') {
    const s = L.sources[sel.i];
    if (act === 'rot+90' || act === 'rot-90') { s.a = (s.a + (act === 'rot+90' ? 90 : 270)) % 360; AU.ratchet(); }
    if (act === 'color') { const c = SRC_COLORS[(SRC_COLORS.indexOf(s.color || 'W') + 1) % SRC_COLORS.length]; if (c === 'W') delete s.color; else s.color = c; AU.tick(); }
  } else if (sel.kind === 'target') {
    const t = L.targets[sel.i];
    if (act === 'need+' || act === 'need-') { const up = act === 'need+', step = t.need > 10 || (up && t.need >= 10) ? 5 : 0.5; t.need = Math.round(Math.min(100, Math.max(0.5, t.need + (up ? step : -step))) * 2) / 2; AU.tick(); }
    if (act === 'color') { const c = CELL_COLORS[(CELL_COLORS.indexOf(t.color || 'any') + 1) % CELL_COLORS.length]; if (c === 'any') delete t.color; else { t.color = c; if (t.need > 10) t.need = 3; } AU.tick(); }
    if (act === 'size') { const i = CELL_SIZES.findIndex(z => z[0] === (t.r || 0.3)); t.r = CELL_SIZES[(i + 1) % CELL_SIZES.length][0]; if (t.r === 0.3) delete t.r; AU.tick(); }
  } else if (sel.kind === 'fixed') {
    const p = L.fixed[sel.i];
    if (act === 'rot+15' || act === 'rot-15') { p.a = (p.a + (act === 'rot+15' ? 15 : 345)) % 360; AU.ratchet(); }
  }
  changed(); makerStatus();
}
$('#status').addEventListener('click', e => { if (S.screen !== 'maker') return; const b = e.target.closest('[data-mk]'); if (b) inspect(b.dataset.mk); });

// ---------- check: run the solver in a worker ----------
let worker = null;
function checkBench() {
  const L = MK.level;
  if (!L.sources.length || !L.targets.length) { makerStatus('Add at least one light source and one photocell, then check.'); return; }
  const parts = Object.values(L.inv).reduce((a, b) => a + b, 0);
  const depth = Math.min(3, parts), lv = JSON.parse(JSON.stringify(L)), stamp = Date.now();
  MK.check = stamp;
  makerStatus(`Checking every placement of up to ${depth} part${depth === 1 ? '' : 's'}…`);
  const done = r => {
    if (MK.check !== stamp) return; MK.check = null;
    if (r.par === 0) { L.par = 0; L.sol = []; makerStatus('Every cell is already lit with no parts. Give the player something to do: move a cell or add a wall.'); }
    else if (r.par) { L.par = r.par; L.sol = r.sols[0]; saveBench(); makerHeader(); makerStatus(`Solvable with ${r.par} part${r.par === 1 ? '' : 's'}. Par is set to ${r.par}, and the hint button will show this solution.`); AU.hint(); }
    else if (r.timedOut) makerStatus(`No solution found in 20 seconds (searched every layout of up to ${r.depth || 1} part${r.depth === 1 ? '' : 's'}). It may still work; test it yourself.`);
    else makerStatus(depth < parts ? `No solution with up to ${depth} parts. Benches that need more parts are too big to check, so test it yourself.` : 'No solution with the parts the player gets. Add parts, or move the photocells.');
  };
  try {
    if (worker) worker.terminate();
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    worker.onmessage = e => done(e.data);
    worker.onerror = () => { worker = null; done(SOLVER.solveID(lv, Math.min(2, depth), 3, 4000)); };
    worker.postMessage({ level: lv, depth, budget: 20000 });
  } catch (err) { done(SOLVER.solveID(lv, Math.min(2, depth), 3, 4000)); }
}
$('#mkCheck').onclick = checkBench;
$('#mkTest').onclick = testBench;
$('#mkBench').onclick = () => openMakerPanel();

// ---------- bench settings panel ----------
function openMakerPanel() {
  const L = MK.level; closeModals();
  $('#mkName').value = L.name; $('#mkTip').value = L.tip || '';
  $('#mkW').textContent = `${L.w} wide`; $('#mkH').textContent = `${L.h} tall`;
  $('#mkAuthor').value = author(); $('#mkSubmitMsg').textContent = L.par ? `Checked: par ${L.par}. Send it in and it could ship in the game for everyone.` : 'Run check first, then send it in to be added to the game for everyone.';
  $('#mkSubmitRow').hidden = !REPO;
  $('#mkCode').value = encodeBench(L);
  $('#mkDelete').textContent = 'delete bench'; MK.delArmed = false;
  const g = $('#mkInv'); g.innerHTML = '';
  for (const t of PIECE_ORDER) {
    const n = L.inv[t] || 0, row = document.createElement('div'); row.className = 'inv';
    row.innerHTML = `<span>${PIECES[t].name}</span><button class="key" data-plate="key" data-inv="${t}" data-d="-1" aria-label="Fewer ${PIECES[t].name}">−</button><span class="n">${n}</span><button class="key" data-plate="key" data-inv="${t}" data-d="1" aria-label="More ${PIECES[t].name}">+</button>`;
    g.appendChild(row);
  }
  $('#makerov').hidden = false; focusFirst('#makerov');
}
function closeMakerPanel() {
  const L = MK.level; L.name = $('#mkName').value.trim() || L.name; L.tip = $('#mkTip').value.trim();
  $('#makerov').hidden = true; saveBench(); makerHeader(); S.dirty = true;
}
$('#mkDone').onclick = closeMakerPanel;
$('#mkInv').addEventListener('click', e => {
  const b = e.target.closest('[data-inv]'); if (!b) return; const L = MK.level, t = b.dataset.inv;
  L.inv[t] = Math.max(0, Math.min(9, (L.inv[t] || 0) + +b.dataset.d)); if (!L.inv[t]) delete L.inv[t];
  b.parentElement.querySelector('.n').textContent = L.inv[t] || 0; changed(); $('#mkCode').value = encodeBench(L);
});
$('#makerov').addEventListener('click', e => {
  const b = e.target.closest('[data-sz]'); if (!b) return; const L = MK.level, d = b.dataset.sz;
  if (d === 'w-') L.w = Math.max(5, L.w - 1); if (d === 'w+') L.w = Math.min(11, L.w + 1);
  if (d === 'h-') L.h = Math.max(4, L.h - 1); if (d === 'h+') L.h = Math.min(8, L.h + 1);
  const inside = o => o.x < L.w && o.y < L.h;
  L.sources = L.sources.filter(inside); L.targets = L.targets.filter(inside); L.fixed = L.fixed.filter(inside); L.walls = L.walls.filter(([x, y]) => x < L.w && y < L.h);
  MK.sel = null; $('#mkW').textContent = `${L.w} wide`; $('#mkH').textContent = `${L.h} tall`;
  changed(true); layout(); $('#mkCode').value = encodeBench(L);
});
['mkName', 'mkTip'].forEach(id => $('#' + id).addEventListener('input', () => { const L = MK.level; if (id === 'mkName') L.name = $('#mkName').value || L.name; else L.tip = $('#mkTip').value; $('#mkCode').value = encodeBench(L); saveBench(); makerHeader(); }));
// itch.io and other hosts run the game in an iframe where the Clipboard API is often blocked, so fall back
// to selecting the text and copying it the old way
function copyText(inp, done) {
  const legacy = () => { inp.focus(); inp.select(); try { if (document.execCommand('copy')) done(); } catch (e) {} };
  const allowed = !document.featurePolicy || document.featurePolicy.allowsFeature('clipboard-write');
  if (navigator.clipboard && allowed) navigator.clipboard.writeText(inp.value).then(done, legacy); else legacy();
}
$('#mkCopy').onclick = () => copyText($('#mkCode'), () => { $('#mkCopy').textContent = 'copied'; setTimeout(() => { $('#mkCopy').textContent = 'copy'; }, 1500); });
$('#mkDelete').onclick = () => {
  if (!MK.delArmed) { MK.delArmed = true; $('#mkDelete').textContent = 'tap again to delete'; return; }
  const list = customs(); list.splice(MK.idx, 1); saveCustoms(list); MK.idx = null; MK.level = null;
  $('#makerov').hidden = true; document.body.classList.remove('in-maker'); S.screen = 'play'; toTitle(); showLevels();
};
$('#mkNewFrom').onclick = () => { closeMakerPanel(); openMaker(null); };

// ---------- share codes (src/codes.js) and community submissions ----------
function author() { return store.get('author', ''); }
function encodeBench(L) { return BENCH.encode(L, author()); }
function decodeBench(code) { return BENCH.decode(code); }
$('#mkAuthor').addEventListener('input', () => { store.set('author', $('#mkAuthor').value.trim().slice(0, 32)); $('#mkCode').value = encodeBench(MK.level); });
// Submitting opens a GitHub issue form with the code filled in. A workflow checks it with the solver and
// replies; a maintainer adds the "accepted" label and it ships in the next build (see community/README.md).
$('#mkSubmit').onclick = () => {
  const L = MK.level, msg = $('#mkSubmitMsg');
  if (!L.par || !L.sol.length) { msg.textContent = 'Run check first, so everyone knows it can be solved. Then submit.'; return; }
  const code = encodeBench(L);
  const url = `https://github.com/${REPO}/issues/new?template=bench.yml&title=${encodeURIComponent('Bench: ' + L.name)}&code=${encodeURIComponent(code)}&credit=${encodeURIComponent(author())}`;
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  msg.textContent = 'A GitHub form should have opened in a new tab with your code filled in. No GitHub account? Copy the share code and post it in the comments on the game page. ';
  const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Open the form'; msg.appendChild(link);
};
function openCode() { closeModals(); $('#codeIn').value = ''; $('#codeMsg').textContent = 'Paste a code someone shared with you.'; $('#codeov').hidden = false; focusFirst('#codeov'); }
$('#codeCancel').onclick = () => { $('#codeov').hidden = true; showLevels(); };
$('#codeLoad').onclick = () => {
  const L = decodeBench($('#codeIn').value);
  if (!L) { $('#codeMsg').textContent = "That code didn't open. Check it was copied in full, starting with BW1-."; return; }
  const list = customs(); list.push(L); saveCustoms(list); openMaker(list.length - 1);
};
$('#codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#codeLoad').click(); });

// ---------- "My benches" in the bench picker ----------
function makerSlots(g) {
  const hd = document.createElement('div'); hd.className = 'chap etch'; hd.innerHTML = '<span>my benches</span>Made in the bench maker'; g.appendChild(hd);
  customs().forEach((L, i) => {
    const b = document.createElement('button'); b.className = 'slot'; b.dataset.plate = 'pocket';
    b.innerHTML = `<span class="n">MY · ${L.w}×${L.h}</span><span class="t"></span><span class="s" style="font-size:11px;color:var(--ink-dim);height:auto">${L.par ? 'par ' + L.par + ' · checked' : 'not checked yet'}</span>`;
    b.querySelector('.t').textContent = L.name; b.setAttribute('aria-label', `Edit ${L.name}`);
    b.onclick = () => openMaker(i); g.appendChild(b);
  });
  const nb = document.createElement('button'); nb.className = 'slot'; nb.dataset.plate = 'pocket';
  nb.innerHTML = '<span class="n">NEW</span><span class="t">New bench</span><span class="s" style="font-size:11px;color:var(--ink-dim);height:auto">open the bench maker</span>';
  nb.onclick = () => openMaker(null); g.appendChild(nb);
  const cb = document.createElement('button'); cb.className = 'slot'; cb.dataset.plate = 'pocket';
  cb.innerHTML = '<span class="n">CODE</span><span class="t">Open a code</span><span class="s" style="font-size:11px;color:var(--ink-dim);height:auto">a bench someone shared</span>';
  cb.onclick = openCode; g.appendChild(cb);
}
Object.assign(window.__bw, { MK, openMaker, checkBench, testBench, encodeBench, decodeBench, openPause });
