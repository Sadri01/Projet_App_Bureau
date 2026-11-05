// Génère les icônes de l'application (src/assets/) sans dépendance :
// icon.png (PC), icon-192.png et icon-512.png (téléphone), icon-maskable-512.png (icône adaptative Android).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Dessin prévu sur une grille de 256 px, puis mis à l'échelle
const DESIGN = 256;
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
function insideRounded(x, y, scale) {
  const cx = Math.min(Math.max(x, RADIUS), DESIGN - RADIUS);
  const cy = Math.min(Math.max(y, RADIUS), DESIGN - RADIUS);
  return Math.max(0, Math.min(1, (RADIUS - Math.hypot(x - cx, y - cy)) * scale + 0.5));
}

// maskable : fond plein bord à bord et coche réduite, car Android découpe l'icône en cercle
function render(size, maskable) {
  const scale = size / DESIGN;
  const shrink = maskable ? 0.72 : 1;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / scale;
      const py = (y + 0.5) / scale;
      const t = (px + py) / (2 * DESIGN);
      let rgb = FROM.map((c, i) => c + (TO[i] - c) * t);
      const qx = (px - DESIGN / 2) / shrink + DESIGN / 2;
      const qy = (py - DESIGN / 2) / shrink + DESIGN / 2;
      const d = Math.min(...CHECK.map((s) => distToSegment(qx, qy, s)));
      const white = Math.max(0, Math.min(1, (STROKE - d) * scale * shrink + 0.5));
      rgb = rgb.map((c) => c + (255 - c) * white);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(rgb[0]);
      raw[o + 1] = Math.round(rgb[1]);
      raw[o + 2] = Math.round(rgb[2]);
      raw[o + 3] = maskable ? 255 : Math.round(255 * insideRounded(px, py, scale));
    }
  }
  return png(size, raw);
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

function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..', 'src', 'assets');
for (const [name, size, maskable] of [
  ['icon.png', 256, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  fs.writeFileSync(path.join(dir, name), render(size, maskable));
  console.log(`Icône écrite : ${name}`);
}
