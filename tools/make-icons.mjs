/* Generates the app icons. Run with `node tools/make-icons.mjs` after changing
   the mark or the theme colour; the PNGs it writes are committed.

   PNGs are encoded here rather than pulled from an image library: the app has no
   build step and no runtime dependencies, and three flat-colour icons do not
   justify adding one. */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG_TOP = [0x1a, 0x20, 0x26];
const BG_BOT = [0x0d, 0x10, 0x13];
const FG = [0x42, 0xab, 0x7f];
const FG_HI = [0x68, 0xc9, 0x9f];
const BAR = [0xd8, 0xe2, 0xeb];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // no per-scanline filter
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[offset] = r; raw[offset + 1] = g; raw[offset + 2] = b; raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function sdRoundBox(px, py, hw, hh, r) {
  const qx = Math.abs(px) - hw + r;
  const qy = Math.abs(py) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

/* Anti-aliased rounded barbell over a dark radial-glow surface.
   `inset` leaves the safe-area margin a maskable icon needs. */
function barbell(inset) {
  return (x, y, size) => {
    const u = size / 100;
    const cx = size / 2;
    const cy = size / 2;
    const scale = 1 - inset * 2;
    const px = (x + 0.5 - cx) / scale;
    const py = (y + 0.5 - cy) / scale;
    const ax = Math.abs(px);

    const vGrad = y / Math.max(1, size - 1);
    const rad = Math.hypot(x - cx, y - cy) / (size * 0.65);
    const glow = Math.max(0, 1 - rad);
    const bgBase = mix(BG_TOP, BG_BOT, vGrad);
    const bg = mix(bgBase, FG, glow * glow * 0.14);

    // Center bar + end caps
    const dBar = sdRoundBox(px, py, 39 * u, 3.2 * u, 1.6 * u);
    // Inner large plates
    const dInner = sdRoundBox(ax - 23.5 * u, py, 4.6 * u, 21 * u, 2.4 * u);
    // Outer medium plates
    const dOuter = sdRoundBox(ax - 32.2 * u, py, 4.0 * u, 14.5 * u, 2.1 * u);
    // Inner collar stop
    const dCollar = sdRoundBox(ax - 16.8 * u, py, 1.5 * u, 6.2 * u, 1.0 * u);

    const dPlates = Math.min(dInner, dOuter);
    const dMetal = Math.min(dBar, dCollar);

    const aa = 0.85 / scale;
    const metalAlpha = 1 - Math.max(0, Math.min(1, (dMetal + aa * 0.5) / aa));
    const plateAlpha = 1 - Math.max(0, Math.min(1, (dPlates + aa * 0.5) / aa));

    const shine = Math.max(0, Math.min(1, 0.5 - py / (42 * u)));
    const metalCol = mix([0x98, 0xa4, 0xb0], BAR, shine);
    const plateCol = mix(FG, FG_HI, shine * 0.65);

    let out = bg;
    if (metalAlpha > 0) out = mix(out, metalCol, metalAlpha);
    if (plateAlpha > 0) out = mix(out, plateCol, plateAlpha);

    return [out[0], out[1], out[2], 255];
  };
}

mkdirSync('app/icons', { recursive: true });

const files = [
  ['app/icons/icon-192.png', 192, 0.06],
  ['app/icons/icon-512.png', 512, 0.06],
  ['app/icons/icon-maskable-512.png', 512, 0.16],
  ['app/icons/apple-touch-icon.png', 180, 0.06],
];

for (const [path, size, inset] of files) {
  writeFileSync(path, png(size, barbell(inset)));
  console.log(`wrote ${path} (${size}px)`);
}
