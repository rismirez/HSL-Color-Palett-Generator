// Tonos claros/oscuros del generador original (variación de luminosidad HSL).
import { clamp, hexToHsl, hslToHex } from './color.js';
import { hslString } from './export.js';

export function buildShades(hex, amount, step) {
    const { h, s, l } = hexToHsl(hex);
    const make = dir => Array.from({ length: amount }, (_, i) => {
        const hexValue = hslToHex(h, s, clamp(l + dir * (i + 1) * step, 0, 100));
        return { hex: hexValue, hsl: hslString(hexValue) };
    });
    return {
        selected: { hex, hsl: hslString(hex) },
        lighter: make(1),
        darker: make(-1)
    };
}
