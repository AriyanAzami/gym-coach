/* Generates the app icons. Run with `node tools/make-icons.mjs` after changing
   the mark or the theme colour; the PNGs it writes are committed.

   PNGs are encoded here rather than pulled from an image library: the app has no
   build step and no runtime dependencies, and three flat-colour icons do not
   justify adding one. */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x10, 0x12, 0x14];
const FG = [0x42, 0xab, 0x7f];

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

/* A barbell: a bar across the middle with a sleeve and a plate at each end.
   `inset` leaves the safe-area margin a maskable icon needs. */
function barbell(inset) {
  return (x, y, size) => {
    const u = size / 100;
    const cx = size / 2;
    const cy = size / 2;
    const scale = 1 - inset * 2;
    const px = (x - cx) / scale + cx;
    const py = (y - cy) / scale + cy;

    const onBar = Math.abs(py - cy) <= 4 * u && Math.abs(px - cx) <= 34 * u;
    const sleeve = Math.abs(py - cy) <= 9 * u
      && Math.abs(Math.abs(px - cx) - 27 * u) <= 4 * u;
    const plate = Math.abs(py - cy) <= 22 * u
      && Math.abs(Math.abs(px - cx) - 36 * u) <= 6 * u;

    return onBar || sleeve || plate ? [...FG, 255] : [...BG, 255];
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
