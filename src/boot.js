// ===== Boot: runs last, after game.js and maker.js have defined everything =====
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { statics = null; if (S.screen === 'maker') buildMakerRack(); else if (S.screen === 'play') buildParts(); });
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
