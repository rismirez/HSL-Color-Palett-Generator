// Asignación automática de roles de interfaz (primary, background, text…) a partir de una paleta.
import { hexToOklch, mixColors, oklchToHex } from './color.js';
import { contrastRatio } from './contrast.js';

const hueDistance = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
};

/**
 * @param {string[]} palette
 * @param {'light'|'dark'} mode
 * @returns {{primary,secondary,accent,background,surface,text,border:string}}
 */
export function autoRoles(palette, mode = 'light') {
    const info = palette.map(hex => ({ hex, ...hexToOklch(hex) }));
    const byLight = info.slice().sort((a, b) => b.l - a.l);
    const lightest = byLight[0], darkest = byLight[byLight.length - 1];

    // Fondo: la propia paleta si es lo bastante clara/oscura; si no, una versión teñida del color extremo
    let background;
    if (mode === 'light') {
        background = lightest.l >= 0.9 ? lightest.hex : oklchToHex(0.975, Math.min(lightest.c, 0.02), lightest.h);
    } else {
        background = darkest.l <= 0.25 ? darkest.hex : oklchToHex(0.18, Math.min(darkest.c, 0.03), darkest.h);
    }

    // Texto: el color de la paleta con más contraste si cumple AAA; si no, casi negro/blanco con el tono del fondo
    const bgInfo = hexToOklch(background);
    const bestText = palette.slice().sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0];
    const text = contrastRatio(bestText, background) >= 7
        ? bestText
        : oklchToHex(mode === 'light' ? 0.2 : 0.95, Math.min(bgInfo.c, 0.02), bgInfo.h);

    const surface = mode === 'light' ? mixColors(background, '#ffffff', 0.7) : mixColors(background, '#ffffff', 0.07);
    const border = mixColors(background, text, 0.16);

    // Colores de marca: los más cromáticos, priorizando los que contrastan con el fondo
    const chromatic = info.filter(c => c.hex !== background && c.hex !== text).sort((a, b) => b.c - a.c);
    const usable = chromatic.filter(c => contrastRatio(c.hex, background) >= 3);
    const pool = usable.length ? usable : chromatic;
    const primary = (pool[0] || lightest).hex;
    const primaryHue = hexToOklch(primary).h;
    const rest = chromatic.filter(c => c.hex !== primary);
    const secondary = (rest.find(c => hueDistance(c.h, primaryHue) >= 25) || rest[0])?.hex
        || mixColors(primary, text, 0.35);
    const accent = rest.filter(c => c.hex !== secondary).sort((a, b) => hueDistance(b.h, primaryHue) - hueDistance(a.h, primaryHue))[0]?.hex
        || oklchToHex(hexToOklch(primary).l, hexToOklch(primary).c, primaryHue + 150);

    return { primary, secondary, accent, background, surface, text, border };
}
