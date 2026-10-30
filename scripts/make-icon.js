// Génère l'icône de l'application (src/assets/icon.png, 256x256) sans dépendance.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const RADIUS = 56;
const FROM = [108, 79, 246];
const TO = [255, 92, 138];
// Coche blanche : deux segments
const CHECK = [
  [72, 132, 112, 172],
  [112, 172, 188, 88],
];
const STROKE = 15;

function distToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Couverture du carré arrondi (anticrénelage simple sur 1 px)
function insideRounded(x, y) {
  const cx = Math.min(Math.max(x, RADIUS), SIZE - RADIUS);
  const cy = Math.min(Math.max(y, RADIUS), SIZE - RADIUS);
  return Math.max(0, Math.min(1, RADIUS - Math.hypot(x - cx, y - cy) + 0.5));
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5;
    const py = y + 0.5;
    const t = (px + py) / (2 * SIZE);
    let rgb = FROM.map((c, i) => c + (TO[i] - c) * t);
    const d = Math.min(...CHECK.map((s) => distToSegment(px, py, s)));
    const white = Math.max(0, Math.min(1, STROKE - d + 0.5));
    rgb = rgb.map((c) => c + (255 - c) * white);
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    raw[o] = Math.round(rgb[0]);
    raw[o + 1] = Math.round(rgb[1]);
    raw[o + 2] = Math.round(rgb[2]);
    raw[o + 3] = Math.round(255 * insideRounded(px, py));
  }
}

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '..', 'src', 'assets', 'icon.png');
fs.writeFileSync(out, png);
console.log(`Icône écrite : ${out}`);
