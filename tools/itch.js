// Packages the built game for itch.io.
//   itch-build/html5/index.html         the folder butler pushes (see .github/workflows/deploy.yml)
//   itch-build/beamwright-html5.zip     the same thing as a zip, for uploading by hand
// The game is one self-contained file, so the zip holds just index.html. Run `npm run build` first
// (`npm run itch` does both).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const src = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(src)) { console.error('dist/index.html is missing: run npm run build first'); process.exit(1); }
const outDir = path.join(root, 'itch-build'), html5 = path.join(outDir, 'html5');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(html5, { recursive: true });
fs.copyFileSync(src, path.join(html5, 'index.html'));

// a minimal zip writer (deflate, one level of files), so packaging needs no dependencies
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function zip(files) {
  const parts = [], central = []; let offset = 0;
  const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, nameBuf, comp); central.push(cen, nameBuf); offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
const out = path.join(outDir, 'beamwright-html5.zip');
fs.writeFileSync(out, zip([['index.html', fs.readFileSync(src)]]));
console.log(`wrote ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(1)} KB) and itch-build/html5/`);
