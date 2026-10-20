// ===== Community benches =====
// Benches players made in the bench maker and sent in; accepted ones are built into the game as COMMUNITY
// (see tools/community.js). They play like campaign benches, with stars saved under "c:<id>".
function communityLevel(ci) {
  const b = COMMUNITY[ci];
  return { name: b.name, author: b.author, w: b.w, h: b.h, tip: b.tip || '', sources: b.sources, targets: b.targets, walls: b.walls || [], fixed: b.fixed || [], mirage: [], inv: { ...b.inv }, par: b.par, sol: b.sol || [], community: b.id };
}
function playCommunity(ci) { if (!COMMUNITY[ci]) return; S.ci = ci; startPlay(-4, null, communityLevel(ci)); }
function communityWin(n) {
  const L = S.level, st = starsFor(n, L.par), key = 'c:' + L.community;
  if (st > (progress[key] || 0)) { progress[key] = st; store.set('progress', progress); }
  const more = S.ci + 1 < COMMUNITY.length;
  $('#winEyebrow').textContent = `community · by ${L.author} · all cells lit`;
  $('#winTitle').textContent = L.name;
  $('#winStars').innerHTML = [0, 1, 2].map(i => `<i data-plate="led"${i < st ? ' class="on"' : ''}></i>`).join('');
  $('#winStars').setAttribute('aria-label', `${st} of 3`);
  $('#wPieces').textContent = n; $('#wPar').textContent = L.par;
  $('#wLm').textContent = Math.round(S.res.lm.reduce((a, b) => a + b, 0)) + ' lm';
  $('#winNext').textContent = more ? 'next community bench →' : 'choose a bench →';
  $('#win').hidden = false; focusFirst('#win'); AU.win();
}
// copy a community bench into "My benches" to build on it
function remixCommunity() {
  const L = communityLevel(S.ci), list = customs();
  list.push({ name: (L.name + ' remix').slice(0, 28), w: L.w, h: L.h, tip: L.tip, custom: true, sources: L.sources, targets: L.targets, walls: L.walls, fixed: L.fixed, mirage: [], inv: L.inv, sol: [], par: 0 });
  saveCustoms(list); openMaker(list.length - 1);
}
function communitySlots(g) {
  const hd = document.createElement('div'); hd.className = 'chap etch'; hd.innerHTML = '<span>community</span>Benches sent in by players'; g.appendChild(hd);
  COMMUNITY.forEach((b, ci) => {
    const st = progress['c:' + b.id] || 0, el = document.createElement('button'); el.className = 'slot'; el.dataset.plate = 'pocket';
    el.innerHTML = `<span class="n">C${String(ci + 1).padStart(2, '0')}</span><span class="t"></span><span class="s">${[0, 1, 2].map(k => `<i style="border-radius:50%;background:${k < st ? 'var(--vfd);box-shadow:0 0 6px var(--vfd-glow)' : '#2a1d10'}"></i>`).join('')}</span>`;
    el.querySelector('.t').textContent = b.name; el.querySelector('.n').textContent = `C${String(ci + 1).padStart(2, '0')} · by ${b.author}`;
    el.setAttribute('aria-label', `Community bench ${ci + 1}, ${b.name} by ${b.author}${st ? `, ${st} of 3` : ''}`);
    el.onclick = () => { $('#levels').hidden = true; playCommunity(ci); };
    g.appendChild(el);
  });
  if (!COMMUNITY.length || REPO) {
    const el = document.createElement('button'); el.className = 'slot'; el.dataset.plate = 'pocket';
    el.innerHTML = '<span class="n">SEND</span><span class="t">Add yours</span><span class="s" style="font-size:11px;color:var(--ink-dim);height:auto">make a bench, check it, then submit it from bench settings</span>';
    el.onclick = () => openMaker(null); g.appendChild(el);
  }
}
Object.assign(window.__bw, { COMMUNITY, playCommunity });
