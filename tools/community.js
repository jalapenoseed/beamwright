// Community benches: players make benches in the bench maker and send their share code.
// Accepted benches live in community/benches/*.json and are built into the game.
//
//   node tools/community.js check <BW1-code>                 is this code publishable? (prints a report)
//   node tools/community.js add <BW1-code> [--author NAME]   check it, then save it to community/benches/
//   node tools/community.js verify                           re-check every saved community bench
//   node tools/community.js issue [--accept]                 GitHub Actions: read the code from ISSUE_BODY,
//                                                            write a report to community-report.md, and with
//                                                            --accept also save the bench (prints its id)
const fs = require('fs');
const path = require('path');
const { trace } = require('../src/engine.js');
const BENCH = require('../src/codes.js');
const { solveID } = require('../src/solver.js');

const DIR = path.join(__dirname, '..', 'community', 'benches');
const MAX_SEARCH_MS = 90000;

function slug(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'bench'; }
function list() { return fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort() : []; }
function load(f) { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); }
function levelOf(b) { return { name: b.name, w: b.w, h: b.h, tip: b.tip || '', sources: b.sources, targets: b.targets, walls: b.walls || [], fixed: b.fixed || [], mirage: [], inv: b.inv }; }

// Decide whether a code can be published: it must be solvable with the parts given, and not already solved.
// Par is the fewest parts that work (searched for up to MAX_SEARCH_MS).
function assess(code, authorOverride) {
  const L = BENCH.decode(code);
  if (!L) return { ok: false, report: ['That doesn\'t look like a complete bench code. It should start with `BW1-` and be copied in full.'] };
  if (authorOverride) L.author = authorOverride.slice(0, 32);
  const parts = Object.values(L.inv).reduce((a, b) => a + b, 0);
  const lines = [], fail = [];
  let sol = null, par = null, how = '';
  if (trace(L, []).win) fail.push('Every cell is already lit before the player places anything.');
  if (!parts) fail.push('The player gets no parts.');
  if (!fail.length) {
    // the maker's own check usually ships a solution in the code; confirm it, then look for a shorter one
    if (L.sol.length && !BENCH.problems(L, L.sol).length) { sol = L.sol; par = sol.length; how = 'the solution in the code'; }
    const depth = Math.min(parts, sol ? sol.length - 1 : 4);
    if (depth >= 1) {
      const r = solveID(L, depth, 1, MAX_SEARCH_MS);
      if (r.par && r.sols[0]) { sol = r.sols[0]; par = r.par; how = `a full search (${r.nodes.toLocaleString('en-US')} layouts)`; }
      else if (!sol) fail.push(r.timedOut ? `No solution found within ${MAX_SEARCH_MS / 1000} seconds of searching. Run **check** in the bench maker and resubmit the new code.` : `No solution with up to ${depth} parts.`);
    }
  }
  if (sol) { const p = BENCH.problems(L, sol); if (p.length) fail.push(...p.map(s => s[0].toUpperCase() + s.slice(1) + '.')); }
  lines.push(`**${L.name}**${L.author ? ' by ' + L.author : ''} · ${L.w}×${L.h} · ${L.sources.length} source${L.sources.length === 1 ? '' : 's'} · ${L.targets.length} cell${L.targets.length === 1 ? '' : 's'} · ${parts} part${parts === 1 ? '' : 's'} to place`);
  if (fail.length) lines.push('', '❌ Not ready yet:', ...fail.map(f => '- ' + f));
  else lines.push('', `✅ Solvable. Par is **${par}** (confirmed by ${how}).`);
  return { ok: !fail.length, report: lines, bench: fail.length ? null : { ...L, par, sol } };
}

function save(bench) {
  fs.mkdirSync(DIR, { recursive: true });
  const n = list().reduce((m, f) => Math.max(m, parseInt(f, 10) || 0), 0) + 1;
  const id = String(n).padStart(4, '0') + '-' + slug(bench.name);
  const out = {
    id, name: bench.name, author: bench.author || 'anonymous', added: new Date().toISOString().slice(0, 10),
    w: bench.w, h: bench.h, tip: bench.tip || '', sources: bench.sources, targets: bench.targets, walls: bench.walls, fixed: bench.fixed, inv: bench.inv,
    par: bench.par, sol: bench.sol,
  };
  fs.writeFileSync(path.join(DIR, id + '.json'), JSON.stringify(out, null, 2) + '\n');
  return id;
}

function verifyAll() {
  let failed = 0; const files = list();
  for (const f of files) {
    const b = load(f), errs = [];
    if (b.id + '.json' !== f) errs.push('id does not match the file name');
    const L = levelOf(b);
    // run it through the decoder so a hand-edited file can't hold anything a code couldn't
    const again = BENCH.decode(BENCH.encode({ ...L, par: b.par, sol: b.sol }));
    if (!again) errs.push('not a valid bench');
    else {
      errs.push(...BENCH.problems(again, again.sol));
      if (again.sol.length !== b.par) errs.push(`par is ${b.par} but the solution uses ${again.sol.length} parts`);
    }
    console.log(`${errs.length ? 'FAIL' : 'ok  '} ${b.id} ${b.name} by ${b.author}${errs.length ? '  ← ' + errs.join('; ') : ''}`);
    failed += errs.length ? 1 : 0;
  }
  console.log(failed ? `\n${failed} community bench(es) failed` : `\nAll ${files.length} community benches verified.`);
  return !failed;
}

// GitHub issue forms render each field as "### Label" followed by the answer
function issueField(body, label) {
  const m = body.match(new RegExp('###\\s*' + label + '[^\\n]*\\n+([\\s\\S]*?)(?=\\n###|$)', 'i'));
  const v = m ? m[1].trim() : '';
  return v === '_No response_' ? '' : v;
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = name => { const i = rest.indexOf('--' + name); return i >= 0 ? (rest[i + 1] || true) : null; };
  if (cmd === 'verify') process.exit(verifyAll() ? 0 : 1);
  else if (cmd === 'check' || cmd === 'add') {
    const r = assess(rest[0] || '', typeof flag('author') === 'string' ? flag('author') : null);
    console.log(r.report.join('\n'));
    if (cmd === 'add' && r.ok) console.log('\nSaved as community/benches/' + save(r.bench) + '.json. Run npm run build to include it.');
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === 'issue') {
    const body = process.env.ISSUE_BODY || '';
    const code = (body.match(/BW1-[A-Za-z0-9_-]+/) || [''])[0];
    const author = issueField(body, 'Credit').split('\n')[0].slice(0, 32) || null;
    const r = assess(code, author);
    let out = r.report.join('\n');
    if (r.ok && rest.includes('--accept')) {
      const id = save(r.bench);
      out += `\n\n🎉 Accepted as \`${id}\`. It will be in the game's **community benches** after the next deploy.`;
      fs.writeFileSync('community-id.txt', id);
    } else if (r.ok) out += '\n\nA maintainer will play it, and add the `accepted` label to put it in the game.';
    else out += '\n\nEdit this issue with a new code and it will be checked again.';
    fs.writeFileSync('community-report.md', out + '\n');
    console.log(out);
    process.exit(0);
  } else {
    console.log('usage: node tools/community.js check|add <code> [--author NAME] | verify | issue [--accept]');
    process.exit(1);
  }
}
module.exports = { assess, save, verifyAll, list, load };
