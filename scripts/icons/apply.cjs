// Installs one rendered concept as the app's icon set.
// Usage: node apply.cjs <path-to-web-project> <out-dir> <letter> [apple-icon background, e.g. #F4EEDF]
const path = require('node:path');
const fs = require('node:fs');
const web = process.argv[2];
const out = process.argv[3];
const letter = process.argv[4];
// iOS shows the apple icon on an opaque square; match the artwork's own ground.
const ground = process.argv[5] || '#F4EEDF';
const sharp = require(path.join(web, 'node_modules', 'sharp'));

const src = fs.readFileSync(path.join(out, `icon-${letter}.svg`));
const png = (size) => sharp(src, { density: 300 }).resize(size, size).png({ compressionLevel: 9 });

(async () => {
  // Full-bleed squares: iOS and Android apply their own mask.
  await png(512).toFile(path.join(web, 'src/app/icon.png'));
  await png(180).flatten({ background: ground }).toFile(path.join(web, 'src/app/apple-icon.png'));
  await png(192).toFile(path.join(web, 'public/icon-192.png'));
  await png(512).toFile(path.join(web, 'public/icon-512.png'));
  await png(512).toFile(path.join(web, 'public/icon-maskable.png'));

  // favicon.ico: rounded, 48px PNG inside an ICO container.
  const size = 48;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.2237}" fill="#fff"/></svg>`,
  );
  const fav = await png(size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(fav.length, 14);
  header.writeUInt32LE(22, 18); // offset
  fs.writeFileSync(path.join(web, 'src/app/favicon.ico'), Buffer.concat([header, fav]));
  console.log('applied', letter);
})();
