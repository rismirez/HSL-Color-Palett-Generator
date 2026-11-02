// Caché de conversiones HEX → OKLab (se usa en búsquedas de color más cercano).
import { hexToRgb, rgbToOklab } from './color.js';

const cache = new Map();

export function hexToOklab(hex) {
    let lab = cache.get(hex);
    if (!lab) {
        lab = rgbToOklab(hexToRgb(hex));
        if (cache.size > 2000) cache.clear();
        cache.set(hex, lab);
    }
    return lab;
}

export const oklabDistance = (a, b) => Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
