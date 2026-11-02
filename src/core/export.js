// Exportación: texto, código, imágenes (SVG/PNG), ASE y GPL. Todo se genera en el cliente.
import { formatColor, hexToHsl, hexToRgb, round } from './color.js';
import { colorName } from './names.js';
import { readableOn } from './contrast.js';

export const slug = s =>
    String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'color';

// Elimina caracteres de control y de marcado de textos que acaban en ficheros exportados
const clean = s => String(s).replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 80);
const escXml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

export const TEXT_FORMATS = ['hex', 'rgb', 'hsl', 'hsv', 'oklch', 'cmyk'];

export function formatPaletteText(palette, format = 'hex') {
    return palette.map(c => formatColor(c, format)).join('\n');
}

// ---------- Descarga y portapapeles ----------

export function downloadFile(filename, content, mime = 'text/plain') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

// ---------- Formatos de código para una paleta ----------

const varName = (i, names) => (names?.[i] ? slug(names[i]) : `color-${i + 1}`);

export function paletteToCss(palette, names) {
    const lines = palette.map((c, i) => `  --${varName(i, names)}: ${c};`);
    const hsl = palette.map((c, i) => `  --${varName(i, names)}-hsl: ${formatColor(c, 'hsl')};`);
    return `:root {\n${lines.join('\n')}\n\n${hsl.join('\n')}\n}\n`;
}

export function paletteToScss(palette, names) {
    return palette.map((c, i) => `$${varName(i, names)}: ${c};`).join('\n') + '\n';
}

export function paletteToJson(palette, names, lang = 'en') {
    return JSON.stringify({
        colors: palette.map((hex, i) => ({
            name: names?.[i] || colorName(hex, lang),
            hex,
            rgb: formatColor(hex, 'rgb'),
            hsl: formatColor(hex, 'hsl'),
            hsv: formatColor(hex, 'hsv'),
            oklch: formatColor(hex, 'oklch'),
            cmyk: formatColor(hex, 'cmyk')
        }))
    }, null, 2);
}

export function paletteToTxt(palette, lang = 'en') {
    return palette.map((hex, i) =>
        `${i + 1}. ${colorName(hex, lang)}\n   HEX:   ${hex}\n   RGB:   ${formatColor(hex, 'rgb')}\n   HSL:   ${formatColor(hex, 'hsl')}\n   OKLCH: ${formatColor(hex, 'oklch')}`
    ).join('\n\n') + '\n';
}

export function paletteToGpl(palette, name = 'Palette', lang = 'en') {
    const rows = palette.map(hex => {
        const { r, g, b } = hexToRgb(hex);
        return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${colorName(hex, lang)} ${hex}`;
    });
    return `GIMP Palette\nName: ${clean(name)}\nColumns: ${Math.min(palette.length, 8)}\n#\n${rows.join('\n')}\n`;
}

// Adobe Swatch Exchange (binario, big-endian). Cada color RGB se guarda como flotantes 0–1.
export function paletteToAse(palette, lang = 'en') {
    const encodeName = name => {
        const chars = Array.from(clean(name) + '\0');
        const buf = new Uint8Array(chars.length * 2);
        chars.forEach((ch, i) => {
            const code = ch.charCodeAt(0);
            buf[i * 2] = code >> 8;
            buf[i * 2 + 1] = code & 0xff;
        });
        return { bytes: buf, length: chars.length };
    };
    const blocks = palette.map(hex => {
        const { bytes, length } = encodeName(`${colorName(hex, lang)} ${hex}`);
        const body = 2 + bytes.length + 4 + 12 + 2;
        const buf = new ArrayBuffer(6 + body);
        const v = new DataView(buf);
        let o = 0;
        v.setUint16(o, 0x0001); o += 2; // bloque de color
        v.setUint32(o, body); o += 4;
        v.setUint16(o, length); o += 2;
        new Uint8Array(buf, o, bytes.length).set(bytes); o += bytes.length;
        'RGB '.split('').forEach(ch => { v.setUint8(o++, ch.charCodeAt(0)); });
        const { r, g, b } = hexToRgb(hex);
        [r, g, b].forEach(ch => { v.setFloat32(o, ch / 255); o += 4; });
        v.setUint16(o, 2); // tipo: normal
        return new Uint8Array(buf);
    });
    const header = new ArrayBuffer(12);
    const hv = new DataView(header);
    'ASEF'.split('').forEach((ch, i) => hv.setUint8(i, ch.charCodeAt(0)));
    hv.setUint16(4, 1);
    hv.setUint16(6, 0);
    hv.setUint32(8, blocks.length);
    return new Blob([header, ...blocks], { type: 'application/octet-stream' });
}

// ---------- Imágenes: SVG y PNG ----------

export const IMAGE_LAYOUTS = ['grid', 'rows', 'columns', 'cards'];

function layoutRects(n, layout, w, h) {
    const rects = [];
    if (layout === 'rows') {
        for (let i = 0; i < n; i++) rects.push({ x: 0, y: (h / n) * i, w, h: h / n });
    } else if (layout === 'columns') {
        for (let i = 0; i < n; i++) rects.push({ x: (w / n) * i, y: 0, w: w / n, h });
    } else if (layout === 'cards') {
        const gap = Math.round(Math.min(w, h) * 0.03);
        const cw = (w - gap * (n + 1)) / n;
        for (let i = 0; i < n; i++) rects.push({ x: gap + i * (cw + gap), y: gap, w: cw, h: h - gap * 2, card: true });
    } else {
        const cols = Math.ceil(Math.sqrt(n * (w / h)));
        const rows = Math.ceil(n / cols);
        for (let i = 0; i < n; i++) {
            rects.push({ x: (i % cols) * (w / cols), y: Math.floor(i / cols) * (h / rows), w: w / cols, h: h / rows });
        }
    }
    return rects;
}

function labelLines(hex, o, lang) {
    const lines = [];
    if (o.name) lines.push({ text: colorName(hex, lang), bold: true });
    if (o.hex) lines.push({ text: hex.toUpperCase() });
    if (o.rgb) lines.push({ text: formatColor(hex, 'rgb') });
    if (o.hsl) lines.push({ text: formatColor(hex, 'hsl') });
    return lines;
}

export const DEFAULT_IMAGE_OPTIONS = {
    layout: 'columns', width: 1600, height: 900, name: true, hex: true, rgb: false, hsl: false, brand: true
};

function describeImage(palette, opts, lang) {
    const o = { ...DEFAULT_IMAGE_OPTIONS, ...opts };
    const rects = layoutRects(palette.length, o.layout, o.width, o.height);
    const fs = Math.max(12, Math.round(Math.min(o.width / palette.length, o.height) * 0.09));
    return { o, rects, fs, lang };
}

export function paletteToSvg(palette, opts = {}, lang = 'en') {
    const { o, rects, fs } = describeImage(palette, opts, lang);
    let body = o.layout === 'cards' ? `<rect width="${o.width}" height="${o.height}" fill="#f4f4f6"/>` : '';
    rects.forEach((r, i) => {
        const hex = palette[i];
        const fg = readableOn(hex);
        const rx = r.card ? Math.round(fs * 0.8) : 0;
        body += `<rect x="${round(r.x, 1)}" y="${round(r.y, 1)}" width="${round(r.w, 1)}" height="${round(r.h, 1)}" rx="${rx}" fill="${hex}"/>`;
        const lines = labelLines(hex, o, lang);
        lines.forEach((line, li) => {
            const y = r.y + r.h - fs * 0.6 - (lines.length - 1 - li) * fs * 1.35;
            body += `<text x="${round(r.x + fs, 1)}" y="${round(y, 1)}" fill="${fg}" font-family="system-ui, sans-serif" font-size="${fs}" font-weight="${line.bold ? 700 : 400}">${escXml(line.text)}</text>`;
        });
    });
    if (o.brand) {
        body += `<text x="${o.width - fs}" y="${fs * 1.6}" text-anchor="end" fill="#000" fill-opacity=".45" font-family="system-ui, sans-serif" font-size="${Math.round(fs * 0.8)}">Magic Color Tools</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">${body}</svg>\n`;
}

export function paletteToCanvas(palette, opts = {}, lang = 'en') {
    const { o, rects, fs } = describeImage(palette, opts, lang);
    const canvas = document.createElement('canvas');
    canvas.width = o.width;
    canvas.height = o.height;
    const ctx = canvas.getContext('2d');
    if (o.layout === 'cards') {
        ctx.fillStyle = '#f4f4f6';
        ctx.fillRect(0, 0, o.width, o.height);
    }
    rects.forEach((r, i) => {
        const hex = palette[i];
        ctx.fillStyle = hex;
        const rx = r.card ? Math.round(fs * 0.8) : 0;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, rx);
        ctx.fill();
        ctx.fillStyle = readableOn(hex);
        ctx.textBaseline = 'alphabetic';
        const lines = labelLines(hex, o, lang);
        lines.forEach((line, li) => {
            ctx.font = `${line.bold ? 700 : 400} ${fs}px system-ui, sans-serif`;
            ctx.fillText(line.text, r.x + fs, r.y + r.h - fs * 0.6 - (lines.length - 1 - li) * fs * 1.35, r.w - fs * 1.5);
        });
    });
    if (o.brand) {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.font = `400 ${Math.round(fs * 0.8)}px system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('Magic Color Tools', o.width - fs, fs * 1.6);
        ctx.textAlign = 'left';
    }
    return canvas;
}

export function canvasToBlob(canvas, type = 'image/png') {
    return new Promise(resolve => canvas.toBlob(resolve, type));
}

// ---------- Escalas 50–950 ----------

/** @param {{step:number,hex:string}[]} scale */
export function scaleToCss(name, scale) {
    const n = slug(name);
    return `:root {\n${scale.map(s => `  --${n}-${s.step}: ${s.hex};`).join('\n')}\n}\n`;
}

export function scaleToScss(name, scale) {
    const n = slug(name);
    return scale.map(s => `$${n}-${s.step}: ${s.hex};`).join('\n') + '\n';
}

export function scaleToJson(name, scale) {
    return JSON.stringify({
        [slug(name)]: Object.fromEntries(scale.map(s => [s.step, {
            hex: s.hex, rgb: formatColor(s.hex, 'rgb'), hsl: formatColor(s.hex, 'hsl'), oklch: formatColor(s.hex, 'oklch')
        }]))
    }, null, 2);
}

export function scaleToTailwind(name, scale) {
    const rows = scale.map(s => `          ${s.step}: '${s.hex}',`).join('\n');
    return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        '${slug(name)}': {\n${rows}\n        }\n      }\n    }\n  }\n};\n`;
}

// ---------- Formato clásico del generador de tonos (compatibilidad) ----------

/** @param {{selected:{hex,hsl}, lighter:{hex,hsl}[], darker:{hex,hsl}[]}} s */
export function shadesToText(s) {
    let t = 'Color Palette\n\nSelected Color:\n';
    t += `HEX: ${s.selected.hex}\nHSL: ${s.selected.hsl}\n\nLighter Colors:\n`;
    s.lighter.forEach((c, i) => { t += `Tone ${i + 1}:\nHEX: ${c.hex}\nHSL: ${c.hsl}\n`; });
    t += '\nDarker Colors:\n';
    s.darker.forEach((c, i) => { t += `Tone ${i + 1}:\nHEX: ${c.hex}\nHSL: ${c.hsl}\n`; });
    return t;
}

export const shadesToJson = s => JSON.stringify({
    selectedColor: s.selected, lighterColors: s.lighter, darkerColors: s.darker
}, null, 2);

function shadesVars(s, sassSyntax) {
    const all = [
        ['selected-color', s.selected],
        ...s.lighter.map((c, i) => [`lighter-color-${i + 1}`, c]),
        ...s.darker.map((c, i) => [`darker-color-${i + 1}`, c])
    ];
    const decl = (n, v) => (sassSyntax ? `$${n}: ${v};` : `  --${n}: ${v};`);
    const hexBlock = all.map(([n, c]) => decl(`${n}-hex`, c.hex)).join('\n');
    const hslBlock = all.map(([n, c]) => decl(`${n}-hsl`, c.hsl)).join('\n');
    return { all, hexBlock, hslBlock };
}

export function shadesToCss(s) {
    const { all, hexBlock, hslBlock } = shadesVars(s, false);
    const use = kind => all.map(([n]) => `.bg-${n.replace('-color', '')}-${kind} { background-color: var(--${n}-${kind}); }`).join('\n');
    return `:root {\n  /* hex color */\n${hexBlock}\n\n  /* hsl color */\n${hslBlock}\n}\n\n/* Examples of use */\n${use('hex')}\n${use('hsl')}\n`;
}

export function shadesToScss(s) {
    const { all, hexBlock, hslBlock } = shadesVars(s, true);
    const use = kind => all.map(([n]) => `.bg-${n.replace('-color', '')}-${kind} { background-color: $${n}-${kind}; }`).join('\n');
    return `/* hex color */\n${hexBlock}\n\n/* hsl color */\n${hslBlock}\n\n// Examples of use\n${use('hex')}\n${use('hsl')}\n`;
}

export function shadesToSvg(s) {
    const all = [s.selected, ...s.lighter, ...s.darker];
    const rectH = 100, rectW = 200, off = 20;
    const height = all.length * (rectH + off * 2) + 20;
    let svg = `<svg width="${rectW + 20}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    all.forEach((c, i) => {
        const y = i * (rectH + off * 2) + 10;
        svg += `<rect x="10" y="${y}" width="${rectW}" height="${rectH}" fill="${c.hex}" />`;
        svg += `<text x="10" y="${y + rectH + off}" fill="black" font-family="monospace">HEX: ${c.hex}</text>`;
        svg += `<text x="10" y="${y + rectH + off * 2}" fill="black" font-family="monospace">HSL: ${escXml(c.hsl)}</text>`;
    });
    return svg + '</svg>';
}

export const hslString = hex => {
    const { h, s, l } = hexToHsl(hex);
    return `hsl(${round(h, 0)}, ${round(s, 1)}%, ${round(l, 1)}%)`;
};
