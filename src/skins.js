// Appearance affects presentation only; optical beam colours always stay unchanged.
const SKIN = (() => {
  const palettes = {
    steel: { name: 'Brushed Steel', note: 'Brighter metal, clear white labels', bg: '#27313e', board: '#4d5d70', key: '#3a4a5e', panel: '#293747', pocket: '#1b2634', accent: '#ffd28a', lift: 0.035, grain: 0.005 },
    amber: { name: 'Amber Lab', note: 'Warm graphite and amber instruments', bg: '#282725', board: '#48453f', key: '#464139', panel: '#302e29', pocket: '#201e1a', accent: '#ffd28a', lift: 0.025, grain: 0.007 },
    ocean: { name: 'Ocean', note: 'Blue anodized metal, ice-blue controls', bg: '#152d3e', board: '#2f5267', key: '#294c63', panel: '#1c3548', pocket: '#102839', accent: '#a9eaff', lift: 0.035, grain: 0.005 },
    contrast: { name: 'High Contrast', note: 'White markings, crisp edges, no grain', bg: '#090d14', board: '#28384a', key: '#26394f', panel: '#152236', pocket: '#080e17', accent: '#ffe48f', lift: 0.055, grain: 0 }
  };
  let id = 'steel', glow = 0.32, previousFocus = null;
  try { const saved = JSON.parse(localStorage.getItem('beamwright.appearance')); if (saved && palettes[saved.skin]) id = saved.skin; if (saved && Number.isFinite(saved.glow)) glow = Math.max(0, Math.min(1, saved.glow)); } catch (_) {}
  const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v, 16) / 255);
  function apply(save = true) {
    const p = palettes[id], root = document.documentElement;
    root.dataset.skin = id;
    for (const k of ['bg', 'board', 'key', 'panel', 'pocket', 'accent']) root.style.setProperty('--skin-' + k, p[k]);
    root.style.setProperty('--void', p.bg); root.style.setProperty('--vfd', p.accent);
    root.style.setProperty('--vfd-glow', 'transparent');
    document.querySelectorAll('[data-skin-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.skinChoice === id)));
    const value = document.getElementById('glowValue'); if (value) value.textContent = Math.round(glow * 100) + '%';
    if (save) { try { localStorage.setItem('beamwright.appearance', JSON.stringify({ skin: id, glow })); } catch (_) {} }
    window.dispatchEvent(new Event('beamwright-appearance'));
  }
  function close() { document.getElementById('skinov').hidden = true; if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true }); }
  function open() {
    previousFocus = document.activeElement;
    document.querySelectorAll('.ov.modal').forEach(el => { el.hidden = true; });
    document.getElementById('skinov').hidden = false;
    document.querySelector('[data-skin-choice="' + id + '"]').focus({ preventScroll: true });
  }
  const grid = document.getElementById('skinGrid');
  for (const [key, p] of Object.entries(palettes)) {
    const b = document.createElement('button'); b.className = 'skin-choice'; b.dataset.skinChoice = key;
    b.style.setProperty('--swatch', p.board); b.style.setProperty('--swatch-accent', p.accent);
    const swatch = document.createElement('span'); swatch.className = 'skin-swatch'; swatch.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); const title = document.createElement('strong'); title.textContent = p.name;
    const note = document.createElement('small'); note.textContent = p.note; text.append(title, note); b.append(swatch, text);
    b.onclick = () => { id = key; apply(); }; grid.append(b);
  }
  const slider = document.getElementById('glowRange'); slider.value = Math.round(glow * 100);
  slider.oninput = () => { glow = Number(slider.value) / 100; apply(); };
  document.getElementById('skinClose').onclick = close;
  document.getElementById('titleSkins').onclick = open;
  window.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !document.getElementById('skinov').hidden) {
      const controls = [...document.getElementById('skinov').querySelectorAll('button, input')];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
    if (e.key === 'Escape' && !document.getElementById('skinov').hidden) { close(); e.stopImmediatePropagation(); e.preventDefault(); } });
  apply(false);
  return { open, get id() { return id; }, get glow() { return glow; }, get palette() { const p = palettes[id]; return { ...p, bg: rgb(p.bg), board: rgb(p.board), key: rgb(p.key), panel: rgb(p.panel), pocket: rgb(p.pocket), accent: rgb(p.accent) }; } };
})();
