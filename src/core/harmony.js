// Armonías cromáticas y generación de paletas (geometría de tono sobre la rueda HSL).
import { clamp, hexToHsl, hexToOklch, hslToHex, mod360, oklchToHex } from './color.js';

export const HARMONIES = {
    analogous: [-30, 0, 30],
    complementary: [0, 180],
    triadic: [0, 120, 240],
    tetradic: [0, 60, 180, 240],
    monochromatic: [0],
    split: [0, 150, 210],
    square: [0, 90, 180, 270],
    custom: null
};

export const PRESETS = {
    none: null,
    pastel: { sMin: 35, sMax: 70, lMin: 75, lMax: 90 },
    vibrant: { sMin: 75, sMax: 100, lMin: 42, lMax: 62 },
    muted: { sMin: 12, sMax: 40, lMin: 35, lMax: 68 },
    dark: { sMin: 20, sMax: 70, lMin: 8, lMax: 32 },
    light: { sMin: 20, sMax: 70, lMin: 80, lMax: 95 }
};

export const DEFAULT_PARAMS = {
    harmony: 'analogous',
    temperature: 'any', // any | warm | neutral | cool
    sMin: 40, sMax: 90,
    lMin: 25, lMax: 85,
    hueSpread: 100, // % del desplazamiento de tono teórico
    contrast: 70, // 0-100: apertura del rango de luminosidad usado
    distribution: 'even' // even | random
};

const TEMPERATURE_HUES = {
    warm: [[0, 70], [320, 360]],
    cool: [[170, 270]]
};

function pickHue(rand, temperature) {
    const ranges = TEMPERATURE_HUES[temperature];
    if (!ranges) return rand() * 360;
    const [a, b] = ranges[Math.floor(rand() * ranges.length)];
    return a + rand() * (b - a);
}

// Desplazamientos de tono para n colores según la armonía.
export function hueOffsets(harmony, n, spread = 100, rand = Math.random) {
    const factor = spread / 100;
    const base = HARMONIES[harmony];
    const out = [];
    for (let i = 0; i < n; i++) {
        if (!base) {
            out.push((rand() * 2 - 1) * 180 * factor); // custom: tonos libres
        } else if (harmony === 'monochromatic') {
            out.push(0);
        } else if (harmony === 'analogous' && n > 3) {
            // Reparte los n colores a lo largo de un arco de 60° (escalado por la dispersión)
            out.push(((i / (n - 1)) - 0.5) * 60 * factor * 2);
        } else {
            const step = base[i % base.length];
            // Al repetir ciclos se desplaza ligeramente para no duplicar tonos exactos
            const lap = Math.floor(i / base.length);
            out.push(step * factor + lap * 12);
        }
    }
    return out;
}

/**
 * Genera una paleta de `count` colores.
 * @param {object} o
 * @param {number} o.count
 * @param {Array<string|null>} [o.locked] colores fijados por posición (null = libre)
 * @param {string} [o.base] color principal; fija la posición 0 y ancla el tono
 * @param {object} [o.params]
 */
export function generatePalette({ count, locked = [], base = null, params = {}, rand = Math.random }) {
    const p = { ...DEFAULT_PARAMS, ...params };
    const lockedColors = Array.from({ length: count }, (_, i) => locked[i] || null);
    if (base) lockedColors[0] = base;

    const anchor = lockedColors.find(Boolean);
    const anchorHsl = anchor ? hexToHsl(anchor) : null;
    const baseHue = anchorHsl && anchorHsl.s > 6 ? anchorHsl.h : pickHue(rand, p.temperature);
    const offsets = hueOffsets(p.harmony, count, p.hueSpread, rand);

    let sMin = p.sMin, sMax = p.sMax;
    if (p.temperature === 'neutral') {
        sMin = Math.min(sMin, 6);
        sMax = Math.min(sMax, 28);
    }

    // Luminosidad: se reparte en un rango centrado cuya amplitud depende del contraste
    const mid = (p.lMin + p.lMax) / 2;
    const half = ((p.lMax - p.lMin) / 2) * (0.25 + 0.75 * (p.contrast / 100));
    const lights = Array.from({ length: count }, (_, i) =>
        count === 1 ? mid : mid - half + (2 * half * i) / (count - 1));
    if (p.distribution === 'random') {
        for (let i = lights.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [lights[i], lights[j]] = [lights[j], lights[i]];
        }
    }

    return lockedColors.map((fixed, i) => {
        if (fixed) return fixed;
        // En armonías no monocromáticas, las luminosidades se alternan para mantener ritmo
        const s = sMin + rand() * (sMax - sMin);
        const l = clamp(lights[i] + (rand() - 0.5) * 6, 3, 97);
        return hslToHex(baseHue + offsets[i], s, l);
    });
}

// Regenera un único color respetando la armonía respecto al resto.
export function regenerateOne(palette, index, params = {}, rand = Math.random) {
    const locked = palette.map((c, i) => (i === index ? null : c));
    const full = generatePalette({ count: palette.length, locked, params, rand });
    return full[index];
}

// ---------- Variaciones de un color ----------

export function shade(hex, delta) {
    const { l, c, h } = hexToOklch(hex);
    return oklchToHex(clamp(l + delta, 0.02, 0.99), c, h);
}

export const lighter = (hex, step = 0.08) => shade(hex, step);
export const darker = (hex, step = 0.08) => shade(hex, -step);

export function complementary(hex) {
    const { h, s, l } = hexToHsl(hex);
    return hslToHex(h + 180, s, l);
}

export function variations(hex, n = 5) {
    const { h, s, l } = hexToHsl(hex);
    return Array.from({ length: n }, (_, i) => {
        const k = i - (n - 1) / 2;
        return hslToHex(h + k * 8, clamp(s - Math.abs(k) * 4, 0, 100), clamp(l + k * 5, 4, 96));
    });
}

// ---------- Análisis ----------

// Temperatura percibida: -1 (fría) a +1 (cálida), ponderada por el croma.
export function temperatureOf(hex) {
    const { c, h } = hexToOklch(hex);
    const warmth = Math.cos(((h - 50) * Math.PI) / 180);
    return warmth * clamp(c / 0.15, 0, 1);
}

const circDist = (a, b) => {
    const d = Math.abs(mod360(a) - mod360(b));
    return Math.min(d, 360 - d);
};

// Clasifica la armonía que más se aproxima a los tonos de la paleta.
export function detectHarmony(palette) {
    const hues = palette.map(hexToHsl).filter(c => c.s > 10 && c.l > 5 && c.l < 95).map(c => c.h);
    if (hues.length < 2) return { name: 'monochromatic', error: 0 };
    let best = { name: 'custom', error: Infinity };
    for (const [name, offsets] of Object.entries(HARMONIES)) {
        if (!offsets) continue;
        for (const anchor of hues) {
            const targets = offsets.map(o => anchor + o);
            const error = hues.reduce((sum, h) => sum + Math.min(...targets.map(t => circDist(h, t))), 0) / hues.length;
            if (error < best.error) best = { name, error };
        }
    }
    return best.error <= 22 ? best : { name: 'custom', error: best.error };
}
