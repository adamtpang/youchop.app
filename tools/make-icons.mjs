#!/usr/bin/env node
/* make-icons.mjs - generates the YouChop icon PNGs with no dependencies.
 * The mark is the wordmark's blade: a tilted red bar cutting a dark tile,
 * which stays legible down to 16px where a literal "chop" glyph would not.
 *   node tools/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "extension", "icons");
mkdirSync(OUT, { recursive: true });

const BG = [22, 22, 28];       // #16161c  panel dark
const RED = [255, 73, 48];     // #ff4930  chop red
const INK = [242, 239, 233];   // #f2efe9  warm white

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// distance from point to a segment, for drawing rounded bars
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function render(S) {
  const img = Buffer.alloc(S * S * 4);
  const r = S * 0.22;                    // corner radius of the tile
  const SS = 3;                          // supersampling for smooth edges
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let bg = 0, blade = 0, n = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
          n++;
          // rounded square coverage
          const qx = Math.max(r - px, px - (S - r), 0);
          const qy = Math.max(r - py, py - (S - r), 0);
          if (Math.hypot(qx, qy) <= r) bg++;
          // the blade: tilted bar, bottom-left to top-right
          const d = segDist(px, py, S * 0.34, S * 0.78, S * 0.66, S * 0.22);
          if (d <= S * 0.105) blade++;
        }
      }
      const i = (y * S + x) * 4;
      const bgA = bg / n, bladeA = blade / n;
      if (bgA <= 0) { img[i + 3] = 0; continue; }
      // composite blade over tile
      const mix = (c1, c2, a) => Math.round(c1 * (1 - a) + c2 * a);
      img[i] = mix(BG[0], RED[0], bladeA);
      img[i + 1] = mix(BG[1], RED[1], bladeA);
      img[i + 2] = mix(BG[2], RED[2], bladeA);
      img[i + 3] = Math.round(255 * bgA);
    }
  }
  return img;
}

const made = {};
for (const size of [16, 32, 48, 128]) {
  const buf = png(size, size, render(size));
  made[size] = buf;
  writeFileSync(join(OUT, `icon${size}.png`), buf);
  console.log(`  icon${size}.png  ${buf.length} bytes`);
}
console.log(`icons written to ${OUT}`);

/* favicon.ico for the site. Browsers and crawlers still request /favicon.ico by
   name even when an SVG is declared, so serve a real one rather than a 404.
   ICO is a container: a 6-byte header, one 16-byte directory entry per image,
   then the payloads. PNG payloads are valid in ICO and keep the file small. */
function ico(pngs) {
  const sizes = Object.keys(pngs).map(Number).sort((a, b) => a - b);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // 1 = icon
  header.writeUInt16LE(sizes.length, 4);
  const dir = Buffer.alloc(16 * sizes.length);
  let offset = 6 + dir.length;
  sizes.forEach((s, i) => {
    const b = i * 16;
    dir[b] = s >= 256 ? 0 : s;           // width  (0 means 256)
    dir[b + 1] = s >= 256 ? 0 : s;       // height
    dir[b + 2] = 0;                      // palette size
    dir[b + 3] = 0;                      // reserved
    dir.writeUInt16LE(1, b + 4);         // colour planes
    dir.writeUInt16LE(32, b + 6);        // bits per pixel
    dir.writeUInt32LE(pngs[s].length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += pngs[s].length;
  });
  return Buffer.concat([header, dir, ...sizes.map((s) => pngs[s])]);
}

const SITE = join(dirname(fileURLToPath(import.meta.url)), "..");
const icoBuf = ico({ 16: made[16], 32: made[32], 48: made[48] });
writeFileSync(join(SITE, "favicon.ico"), icoBuf);
console.log(`  favicon.ico    ${icoBuf.length} bytes (16+32+48)`);
