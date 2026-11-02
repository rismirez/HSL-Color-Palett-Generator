// Métricas de una paleta para compararlas: temperatura, saturación, luminosidad, dispersión de tonos, contraste y armonía.
import { hexToOklch } from './color.js';
import { contrastRatio } from './contrast.js';
import { detectHarmony, temperatureOf } from './harmony.js';

const HUE_BINS = 12;

export function paletteStats(palette) {
    const ok = palette.map(hexToOklch);
    const mean = key => ok.reduce((s, c) => s + c[key], 0) / ok.length;
    const chromatic = ok.filter(c => c.c > 0.03);

    // Dispersión circular de tonos (desviación angular): 0 = un único tono, ~100+ = tonos muy repartidos
    let hueSpread = 0;
    if (chromatic.length > 1) {
        const sx = chromatic.reduce((s, c) => s + Math.cos((c.h * Math.PI) / 180), 0) / chromatic.length;
        const sy = chromatic.reduce((s, c) => s + Math.sin((c.h * Math.PI) / 180), 0) / chromatic.length;
        const r = Math.min(1, Math.hypot(sx, sy));
        hueSpread = r < 1e-6 ? 180 : Math.min(180, (Math.sqrt(-2 * Math.log(r)) * 180) / Math.PI);
    }

    const bins = new Array(HUE_BINS).fill(0);
    chromatic.forEach(c => { bins[Math.floor(c.h / (360 / HUE_BINS)) % HUE_BINS]++; });

    const ratios = [];
    for (let i = 0; i < palette.length; i++) {
        for (let j = i + 1; j < palette.length; j++) ratios.push(contrastRatio(palette[i], palette[j]));
    }

    return {
        count: palette.length,
        temperature: palette.reduce((s, c) => s + temperatureOf(c), 0) / palette.length,
        saturation: (mean('c') / 0.32) * 100, // croma OKLCH medio normalizado a 0–100 (0.32 ≈ máximo en sRGB)
        lightness: mean('l') * 100,
        hueSpread,
        harmony: detectHarmony(palette).name,
        minContrast: ratios.length ? Math.min(...ratios) : 1,
        maxContrast: ratios.length ? Math.max(...ratios) : 1,
        avgContrast: ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 1,
        hueBins: bins
    };
}

/** Interpreta texto con códigos de color separados por espacios, comas o saltos de línea. */
export function parseHexList(text, normalize) {
    return String(text).split(/[\s,;]+/).map(s => normalize(s.startsWith('#') ? s : `#${s}`)).filter(Boolean).slice(0, 16);
}
