// Round 3: the white ledger book (round 2, #3) on different backgrounds.
// Usage: node make3.cjs <path-to-web-project> <out-dir>
const path = require('node:path');
const fs = require('node:fs');
const sharp = require(path.join(process.argv[2], 'node_modules', 'sharp'));
const out = process.argv[3];

// name → [top-left, middle, bottom-right, shadow colour, page-edge colour, ribbon]
const grounds = {
  A: ['#3A4658', '#1C2430', '#0B0F16', '#000000', '#C9D6CF', '#FFC83D'], // ink
  B: ['#5B9BFF', '#2F6FEB', '#1B4FC4', '#0B2A6B', '#CFDDF3', '#FFC83D'], // blue
  C: ['#FFFDF8', '#F4EEDF', '#E4DAC2', '#6B5A2A', '#D9E4DC', '#FF6B5B'], // cream
  D: ['#FFE27A', '#FFC93C', '#F5A300', '#7A4A00', '#F1E7C6', '#FF5A4D'], // yellow
  E: ['#B9A4FF', '#7C5CF0', '#5636C9', '#24136B', '#DAD3F3', '#FFC83D'], // violet
  F: ['#FFB199', '#FF7A59', '#E8502F', '#7A1F0A', '#F3D9D0', '#FFE27A'], // coral
};

const defs = (g, id) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${g[0]}"/>
      <stop offset="0.55" stop-color="${g[1]}"/>
      <stop offset="1" stop-color="${g[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.2" r="0.75">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="${id === 'C' ? 0 : 0.26}"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#EAF4EE"/>
    </linearGradient>
    <linearGradient id="seal" x1="0" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#2FE088"/>
      <stop offset="1" stop-color="#00A04C"/>
    </linearGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="28" stdDeviation="32" flood-color="${g[3]}" flood-opacity="${id === 'A' ? 0.6 : 0.36}"/>
    </filter>
  </defs>`;

const won = (color, w) => `
  <g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M286 344 L404 700 L512 420 L620 700 L738 344" stroke-width="${w}"/>
    <path d="M236 492 H788" stroke-width="${Math.round(w * 0.62)}"/>
  </g>`;

const book = (g) => `
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  <g filter="url(#sh)" transform="rotate(-7 512 520)">
    <path d="M430 800 v118 l44 -40 l44 40 v-118 Z" fill="${g[5]}"/>
    <rect x="282" y="222" width="500" height="612" rx="58" fill="${g[4]}"/>
    <rect x="262" y="198" width="500" height="612" rx="58" fill="url(#paper)"/>
    <path d="M320 198 h44 v612 h-44 a58 58 0 0 1 -58 -58 V256 a58 58 0 0 1 58 -58 Z" fill="url(#seal)"/>
    <rect x="660" y="198" width="34" height="612" fill="#0FBF63" opacity="0.9"/>
    <circle cx="512" cy="452" r="118" fill="url(#seal)"/>
    <g transform="translate(512 452) scale(0.2) translate(-512 -522)">${won('#FFFFFF', 108)}</g>
    <rect x="430" y="640" width="164" height="30" rx="15" fill="#C3D0C8"/>
    <rect x="458" y="690" width="108" height="26" rx="13" fill="#D7E0DA"/>
  </g>`;

const svg = (id) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs(grounds[id], id)}${book(grounds[id])}</svg>`;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const names = Object.keys(grounds);
  for (const n of names) {
    await sharp(Buffer.from(svg(n))).png().toFile(path.join(out, `icon-${n}.png`));
    fs.writeFileSync(path.join(out, `icon-${n}.svg`), svg(n));
  }
  const cell = 360;
  const pad = 56;
  const cols = 3;
  const rowsN = Math.ceil(names.length / cols);
  const W = pad + cols * (cell + pad);
  const H = pad + rowsN * (cell + 150 + pad);
  const mask = (size) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.2237}" fill="#fff"/></svg>`,
    );
  const layers = [];
  for (let i = 0; i < names.length; i++) {
    const x = pad + (i % cols) * (cell + pad);
    const y = pad + Math.floor(i / cols) * (cell + 150 + pad);
    const render = (size) =>
      sharp(Buffer.from(svg(names[i])))
        .resize(size, size)
        .composite([{ input: mask(size), blend: 'dest-in' }])
        .png()
        .toBuffer();
    layers.push({ input: await render(cell), left: x, top: y });
    layers.push({ input: await render(120), left: x + cell - 120, top: y + cell + 22 });
    layers.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><text x="0" y="86" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="700" fill="#191F28">${names[i]}</text></svg>`,
      ),
      left: x,
      top: y + cell + 22,
    });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: '#DDE1E6' } })
    .composite(layers)
    .png()
    .toFile(path.join(out, 'sheet3.png'));
  console.log('done', names.join(' '));
})();
