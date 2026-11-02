// Escalas cromáticas 50–950 con interpolación en el espacio elegido.
import { clamp, hexToOklch, mixColors, oklchToHex } from './color.js';

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export const SCALE_SPACES = ['hsl', 'lab', 'oklch'];

// Extremos de la escala (luminosidad OKLCH) en blanco-tintado y casi-negro tintado.
const LIGHT_L = 0.975;
const DARK_L = 0.2;

/**
 * Genera la escala de un color. El color original se coloca en el paso cuya
 * luminosidad se le aproxima más (por defecto 500 si no se fija otro).
 * Los extremos son versiones muy claras/oscuras del mismo tono; los pasos
 * intermedios se interpolan entre ellos y el color base en el espacio elegido.
 */
export function generateScale(base, space = 'oklch', { anchor = null } = {}) {
    const { l, c, h } = hexToOklch(base);
    const lightEnd = oklchToHex(LIGHT_L, c * 0.12, h);
    const darkEnd = oklchToHex(DARK_L, c * 0.55, h);

    // Paso del color base: el más cercano a su luminosidad dentro de una curva de referencia
    const refL = [0.975, 0.94, 0.885, 0.82, 0.74, 0.66, 0.57, 0.48, 0.4, 0.32, 0.24];
    let anchorIndex = anchor != null ? SCALE_STEPS.indexOf(anchor) : -1;
    if (anchorIndex < 0) {
        anchorIndex = refL.reduce((best, v, i) => (Math.abs(v - l) < Math.abs(refL[best] - l) ? i : best), 0);
    }
    anchorIndex = clamp(anchorIndex, 1, refL.length - 2);

    return SCALE_STEPS.map((step, i) => {
        if (i === anchorIndex) return { step, hex: base, base: true };
        const mixSpace = space === 'oklch' ? 'oklch' : space;
        const hex = i < anchorIndex
            // Curva suave hacia el blanco: los pasos 50–200 quedan próximos entre sí, como en las escalas profesionales
            ? mixColors(lightEnd, base, (i / anchorIndex) ** 1.8, mixSpace)
            : mixColors(base, darkEnd, (i - anchorIndex) / (SCALE_STEPS.length - 1 - anchorIndex), mixSpace);
        return { step, hex, base: false };
    });
}
