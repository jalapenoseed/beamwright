// Bundles src/ into one self-contained HTML file.
//   node tools/build.js              -> dist/index.html (full document, for GitHub Pages or opening locally)
//   node tools/build.js --fragment   -> dist/fragment.html (body-only, for hosts that supply the document shell)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fragment = process.argv.includes('--fragment');

function community() {
  const dir = path.join(root, 'community', 'benches');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}
// owner/name of the GitHub repo that takes bench submissions, from package.json "repository"
function repo() {
  const r = JSON.parse(read('package.json')).repository || '';
  return String(typeof r === 'string' ? r : r.url || '').replace(/^github:/, '').replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '');
}

const scripts = [
  read('src/engine.js'),
  read('src/levels.js'),
  'const SOLS = ' + JSON.stringify(JSON.parse(read('data/solutions.json'))) + ';',
  read('src/solver.js'),
  read('src/codes.js'),
  // community benches, accepted through GitHub (see community/README.md), built straight into the game
  'const COMMUNITY = ' + JSON.stringify(community()) + ';',
  'const REPO = ' + JSON.stringify(repo()) + ';',
  // the bench maker's solver runs in a worker built from the engine and solver sources
  'const WORKER_SRC = ' + JSON.stringify(read('src/engine.js') + '\n' + read('src/solver.js') + '\nonmessage = e => postMessage(SOLVER.solveID(e.data.level, e.data.depth, 3, e.data.budget));') + ';',
  read('src/audio.js'),
  read('src/skins.js'),
  read('src/gl.js'),
  "(() => {\n'use strict';",
  read('src/game.js'),
  read('src/maker.js'),
  read('src/community.js'),
  read('src/boot.js'),
  '})();',
].join('\n\n');

let body = read('src/index.html').replace('<!--SCRIPTS-->', () => '<script>\n' + scripts + '\n</script>');

let html = body;
if (!fragment) {
  // lift <title>, <meta>, <link> and <style> into a proper <head>
  const headParts = [];
  html = html.replace(/<(title)>[\s\S]*?<\/title>|<meta[^>]*>|<link[^>]*>|<style>[\s\S]*?<\/style>/g, m => { headParts.push(m); return ''; });
  html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Beamwright: an optics bench puzzle game. Bounce, bend, split and focus light into every photocell.">
${headParts.join('\n')}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>
</head>
<body>
${html.trim()}
</body>
</html>
`;
}
const out = path.join(root, 'dist', fragment ? 'fragment.html' : 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${path.relative(root, out)} (${(html.length / 1024).toFixed(1)} KB)`);
