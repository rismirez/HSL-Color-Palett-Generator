// Accesibilidad: contraste WCAG 2.x, correcciones que preservan la identidad y simulación de daltonismo.
import { clamp, hexToOklch, hexToRgb, linearToRgb, oklchToHex, rgbToHex, rgbToLinear } from './color.js';

export function relativeLuminance(hex) {
    const [r, g, b] = rgbToLinear(hexToRgb(hex));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
    const la = relativeLuminance(a), lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WCAG = { aaNormal: 4.5, aaLarge: 3, aaaNormal: 7, aaaLarge: 4.5, ui: 3 };

export function evaluateContrast(fg, bg) {
    const ratio = contrastRatio(fg, bg);
    return {
        ratio,
        aaNormal: ratio >= WCAG.aaNormal,
        aaLarge: ratio >= WCAG.aaLarge,
        aaaNormal: ratio >= WCAG.aaaNormal,
        aaaLarge: ratio >= WCAG.aaaLarge,
        ui: ratio >= WCAG.ui
    };
}

// Elige negro o blanco como texto sobre un fondo, el que mayor contraste ofrezca.
export function readableOn(bg) {
    return contrastRatio('#000000', bg) >= contrastRatio('#ffffff', bg) ? '#000000' : '#ffffff';
}

// Mueve la luminosidad OKLCH de `color` hasta alcanzar el contraste, conservando tono y croma.
function adjustLightness(color, other, target) {
    const { l, c, h } = hexToOklch(color);
    const lighterFirst = relativeLuminance(other) < 0.4;
    const tryDirection = dir => {
        for (let i = 0; i <= 200; i++) {
            const nl = l + dir * (i / 200);
            if (nl < 0 || nl > 1) break;
            const hex = oklchToHex(nl, c, h);
            if (contrastRatio(hex, other) >= target) return hex;
        }
        return null;
    };
    return tryDirection(lighterFirst ? 1 : -1) || tryDirection(lighterFirst ? -1 : 1);
}

/**
 * Propone alternativas que cumplen `target` manteniendo tono y croma:
 * ajustar el texto, ajustar el fondo, o repartir el cambio entre ambos.
 */
export function suggestFixes(fg, bg, target = WCAG.aaNormal) {
    if (contrastRatio(fg, bg) >= target) return [];
    const out = [];
    const newFg = adjustLightness(fg, bg, target);
    if (newFg) out.push({ kind: 'text', fg: newFg, bg });
    const newBg = adjustLightness(bg, fg, target);
    if (newBg) out.push({ kind: 'background', fg, bg: newBg });
    // Ajuste repartido: cada color recorre la mitad del camino necesario
    const halfTarget = Math.sqrt(target);
    const halfFg = adjustLightness(fg, bg, halfTarget);
    if (halfFg) {
        const halfBg = adjustLightness(bg, halfFg, target);
        if (halfBg) out.push({ kind: 'both', fg: halfFg, bg: halfBg });
    }
    return out
        .map(s => ({ ...s, ratio: contrastRatio(s.fg, s.bg) }))
        .filter(s => s.ratio >= target);
}

/** Analiza todas las parejas de una paleta y clasifica el uso recomendado de cada color. */
export function analyzePalette(palette) {
    const pairs = [];
    for (let i = 0; i < palette.length; i++) {
        for (let j = 0; j < palette.length; j++) {
            if (i === j) continue;
            pairs.push({ i, j, fg: palette[i], bg: palette[j], ...evaluateContrast(palette[i], palette[j]) });
        }
    }
    const roles = palette.map((hex, idx) => {
        const asText = pairs.filter(p => p.i === idx && p.aaNormal).length;
        const asBg = pairs.filter(p => p.j === idx && p.aaNormal).length;
        const { c } = hexToOklch(hex);
        const uiAgainst = pairs.filter(p => p.i === idx && p.ui).length;
        return {
            index: idx,
            hex,
            text: asText > 0,
            background: asBg >= Math.max(1, Math.floor((palette.length - 1) / 2)),
            interactive: c >= 0.08 && uiAgainst > 0
        };
    });
    // Parejas únicas con contraste insuficiente para texto normal (AA)
    const issues = pairs
        .filter(p => p.i < p.j && !p.aaNormal)
        .sort((a, b) => a.ratio - b.ratio);
    return { pairs, roles, issues };
}

// ---------- Daltonismo (Machado, Oliveira & Fernandes 2009, severidad 1.0) ----------

export const CVD_MATRICES = {
    protanopia: [
        [0.152286, 1.052583, -0.204868],
        [0.114503, 0.786281, 0.099216],
        [-0.003882, -0.048116, 1.051998]
    ],
    deuteranopia: [
        [0.367322, 0.860646, -0.227968],
        [0.280085, 0.672501, 0.047413],
        [-0.01182, 0.04294, 0.968881]
    ],
    tritanopia: [
        [1.255528, -0.076749, -0.178779],
        [-0.078411, 0.930809, 0.147602],
        [0.004733, 0.691367, 0.3039]
    ],
    achromatopsia: [
        [0.2126, 0.7152, 0.0722],
        [0.2126, 0.7152, 0.0722],
        [0.2126, 0.7152, 0.0722]
    ]
};

export const CVD_TYPES = Object.keys(CVD_MATRICES);

export function simulateCvd(hex, type) {
    const m = CVD_MATRICES[type];
    if (!m) return hex;
    const lin = rgbToLinear(hexToRgb(hex));
    const out = m.map(row => clamp(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2], 0, 1));
    return rgbToHex(linearToRgb(out));
}
