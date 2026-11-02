// Genera la imagen social (og-image.jpg) y los iconos PWA a partir de public/img/icon-512.png.
// Requiere sharp, que no es dependencia del proyecto:  npm i --no-save sharp && node scripts/make-social-images.mjs
import sharp from 'sharp';

const OUT = 'public/img';
const SRC = `${OUT}/icon-512.png`;

const PNG = { palette: true, quality: 92, compressionLevel: 9 };
await sharp(SRC).resize(192, 192).png(PNG).toFile(`${OUT}/icon-192.png`);

// Icono "maskable": el dibujo ocupa ~72 % y se asienta sobre el morado del fondo para que ninguna máscara lo recorte
const art = await sharp(SRC).resize(368, 368).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2a1470' } })
    .composite([{ input: art, gravity: 'center' }]).png(PNG).toFile(`${OUT}/icon-maskable-512.png`);

// Imagen para redes (Open Graph / Twitter): 1200 × 630
const W = 1200, H = 630;
const swatches = ['#8a42fb', '#6a8ffb', '#42d0fb', '#42fba0', '#d0fb42', '#ffb142'];
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1115"/><stop offset="1" stop-color="#241250"/></linearGradient>
    <radialGradient id="glow" cx="0.2" cy="0.15" r="0.7"><stop offset="0" stop-color="#8a42fc" stop-opacity="0.55"/><stop offset="1" stop-color="#8a42fc" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow2" cx="0.95" cy="0.95" r="0.6"><stop offset="0" stop-color="#48d597" stop-opacity="0.28"/><stop offset="1" stop-color="#48d597" stop-opacity="0"/></radialGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b57bff"/><stop offset="1" stop-color="#48d597"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#glow)"/><rect width="${W}" height="${H}" fill="url(#glow2)"/>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif">
    <text x="470" y="262" font-size="86" font-weight="700" fill="#ffffff">Magic Color</text>
    <text x="470" y="352" font-size="86" font-weight="700" fill="url(#brand)">Tools</text>
    <text x="472" y="410" font-size="31" fill="#c9cdd6">Palettes · OKLCH scales · WCAG contrast</text>
    <text x="472" y="452" font-size="31" fill="#c9cdd6">Design tokens · Color blindness simulator</text>
    ${swatches.map((c, i) => `<rect x="${472 + i * 78}" y="486" width="66" height="66" rx="14" fill="${c}"/>`).join('')}
    <text x="472" y="596" font-size="24" fill="#98a1b0">Free · Private · Runs entirely in your browser</text>
  </g>
</svg>`;
const icon = await sharp(SRC).resize(330, 330).toBuffer();
await sharp(Buffer.from(svg)).composite([{ input: icon, left: 88, top: 150 }]).flatten({ background: '#0f1115' }).jpeg({ quality: 88, mozjpeg: true }).toFile(`${OUT}/og-image.jpg`);
console.log('imágenes generadas');
