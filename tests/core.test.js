import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatColor, hexToHsl, hexToHsv, hexToOklch, hexToRgb, hslToHex, isOutOfGamut, mixColors, normalizeHex,
    oklchToHex, parseColor, rgbToCmyk, cmykToRgb, rgbToHex, hexToLab
} from '../src/core/color.js';
import { analyzePalette, contrastRatio, relativeLuminance, simulateCvd, suggestFixes, evaluateContrast } from '../src/core/contrast.js';
import { HARMONIES, detectHarmony, generatePalette, hueOffsets } from '../src/core/harmony.js';
import { SCALE_STEPS, generateScale } from '../src/core/scale.js';
import { colorName } from '../src/core/names.js';
import { buildShades } from '../src/core/shades.js';
import { paletteToAse, paletteToGpl, paletteToSvg, paletteToJson, paletteToCss, shadesToCss } from '../src/core/export.js';
import { sanitizeState } from '../src/core/store.js';

const seeded = seed => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};
const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test('hex y rgb', () => {
    assert.equal(normalizeHex('#ABC'), '#aabbcc');
    assert.equal(normalizeHex('xyz'), null);
    assert.deepEqual(hexToRgb('#8a42fb'), { r: 138, g: 66, b: 251 });
    assert.equal(rgbToHex({ r: 300, g: -4, b: 12.4 }), '#ff000c');
});

test('HSL, HSV y CMYK son reversibles', () => {
    const rand = seeded(7);
    for (let i = 0; i < 300; i++) {
        const hex = rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
        const { h, s, l } = hexToHsl(hex);
        assert.equal(hslToHex(h, s, l), hex);
        assert.equal(parseColor(formatColor(hex, 'hsv')) !== null, true);
        const cm = rgbToCmyk(hexToRgb(hex));
        assert.equal(rgbToHex(cmykToRgb(cm)), hex);
    }
    assert.deepEqual(hexToHsl('#ff0000'), { h: 0, s: 100, l: 50 });
    close(hexToHsv('#00ff00').v, 100);
});

test('OKLCH: valores de referencia y viaje de ida y vuelta', () => {
    const red = hexToOklch('#ff0000');
    close(red.l, 0.628, 0.002);
    close(red.c, 0.2577, 0.002);
    close(red.h, 29.23, 0.1);
    close(hexToOklch('#ffffff').l, 1, 1e-3);
    const rand = seeded(11);
    for (let i = 0; i < 300; i++) {
        const hex = rgbToHex({ r: rand() * 255, g: rand() * 255, b: rand() * 255 });
        const { l, c, h } = hexToOklch(hex);
        assert.equal(oklchToHex(l, c, h), hex);
    }
});

test('LAB: valores de referencia (D65)', () => {
    const lab = hexToLab('#ffffff');
    close(lab.l, 100, 0.05);
    close(lab.a, 0, 0.05);
    const red = hexToLab('#ff0000');
    close(red.l, 53.24, 0.1);
});

test('colores fuera de gamut se mapean a HEX válido', () => {
    assert.ok(isOutOfGamut(0.7, 0.4, 150));
    assert.match(oklchToHex(0.7, 0.4, 150), /^#[0-9a-f]{6}$/);
    assert.match(oklchToHex(1.2, 0.3, 10), /^#[0-9a-f]{6}$/);
});

test('parseColor acepta varios formatos', () => {
    assert.equal(parseColor('#8a42fb'), '#8a42fb');
    assert.equal(parseColor('rgb(138, 66, 251)'), '#8a42fb');
    assert.equal(parseColor('hsl(0, 100%, 50%)'), '#ff0000');
    assert.equal(parseColor('oklch(62.8% 0.2577 29.23)'), '#ff0000');
    assert.equal(parseColor('cmyk(0%, 100%, 100%, 0%)'), '#ff0000');
    assert.equal(parseColor('nope'), null);
    assert.equal(parseColor('rgb(1, 2)'), null);
});

test('mezcla en cada espacio respeta extremos y punto medio', () => {
    for (const space of ['rgb', 'hsl', 'lab', 'oklch']) {
        assert.equal(mixColors('#ff0000', '#0000ff', 0, space), '#ff0000');
        assert.equal(mixColors('#ff0000', '#0000ff', 1, space), '#0000ff');
    }
    assert.equal(mixColors('#000000', '#ffffff', 0.5, 'rgb'), '#808080');
});

test('contraste WCAG', () => {
    close(relativeLuminance('#ffffff'), 1);
    close(contrastRatio('#000000', '#ffffff'), 21, 1e-6);
    close(contrastRatio('#767676', '#ffffff'), 4.54, 0.01);
    const e = evaluateContrast('#777777', '#ffffff');
    assert.equal(e.aaNormal, false);
    assert.equal(e.aaLarge, true);
});

test('sugerencias de corrección cumplen el objetivo y conservan el tono', () => {
    const fixes = suggestFixes('#9aa4ff', '#ffffff', 4.5);
    assert.ok(fixes.length >= 1);
    for (const f of fixes) assert.ok(f.ratio >= 4.5);
    const text = fixes.find(f => f.kind === 'text');
    const hueBefore = hexToOklch('#9aa4ff').h;
    close(hexToOklch(text.fg).h, hueBefore, 6);
    assert.deepEqual(suggestFixes('#000000', '#ffffff'), []);
});

test('análisis de paleta', () => {
    const a = analyzePalette(['#ffffff', '#000000', '#7a7a7a']);
    assert.ok(a.issues.length >= 1);
    assert.equal(a.roles[0].background, true);
});

test('daltonismo: los grises no cambian y el rojo sí', () => {
    for (const type of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) {
        const g = hexToRgb(simulateCvd('#808080', type));
        assert.ok(Math.abs(g.r - g.g) <= 2 && Math.abs(g.g - g.b) <= 3, type);
    }
    assert.notEqual(simulateCvd('#ff0000', 'protanopia'), '#ff0000');
    const gray = hexToRgb(simulateCvd('#ff0000', 'achromatopsia'));
    assert.equal(gray.r, gray.g);
});

test('armonías: desplazamientos y detección', () => {
    assert.deepEqual(hueOffsets('complementary', 2), [0, 180]);
    assert.deepEqual(hueOffsets('triadic', 3), [0, 120, 240]);
    assert.equal(hueOffsets('analogous', 8).length, 8);
    const pal = generatePalette({ count: 3, base: '#ff0000', params: { harmony: 'triadic', sMin: 100, sMax: 100, lMin: 50, lMax: 50 }, rand: seeded(3) });
    assert.equal(detectHarmony(pal).name, 'triadic');
});

test('generación: tamaño, bloqueo y validez', () => {
    for (const harmony of Object.keys(HARMONIES)) {
        for (const count of [1, 2, 3, 5, 8, 10]) {
            const pal = generatePalette({ count, params: { harmony }, rand: seeded(count + 5) });
            assert.equal(pal.length, count);
            pal.forEach(c => assert.match(c, /^#[0-9a-f]{6}$/));
        }
    }
    const locked = ['#112233', null, '#aabbcc', null];
    const pal = generatePalette({ count: 4, locked, rand: seeded(9) });
    assert.equal(pal[0], '#112233');
    assert.equal(pal[2], '#aabbcc');
    const withBase = generatePalette({ count: 4, base: '#ff8800', rand: seeded(2) });
    assert.equal(withBase[0], '#ff8800');
});

test('generación: respeta rangos de saturación y luminosidad', () => {
    const pal = generatePalette({
        count: 8, params: { sMin: 50, sMax: 60, lMin: 40, lMax: 60, contrast: 100 }, rand: seeded(21)
    });
    for (const c of pal) {
        const { s, l } = hexToHsl(c);
        assert.ok(s >= 45 && s <= 65, `s=${s}`);
        assert.ok(l >= 34 && l <= 66, `l=${l}`);
    }
});

test('escalas 50–950', () => {
    for (const space of ['hsl', 'lab', 'oklch']) {
        const scale = generateScale('#8a42fb', space);
        assert.equal(scale.length, SCALE_STEPS.length);
        assert.ok(scale.some(s => s.base && s.hex === '#8a42fb'));
        const lights = scale.map(s => hexToOklch(s.hex).l);
        for (let i = 1; i < lights.length; i++) assert.ok(lights[i] <= lights[i - 1] + 0.01, `${space} paso ${i}`);
    }
});

test('nombres de color en ambos idiomas', () => {
    assert.equal(colorName('#ff0000', 'en'), 'Red');
    assert.equal(colorName('#ff0000', 'es'), 'Rojo');
    assert.equal(colorName('#191970', 'en'), 'Midnight Blue');
    assert.ok(colorName('#123456', 'es').length > 2);
});

test('tonos clásicos (generador original)', () => {
    const s = buildShades('#8a42fb', 5, 5);
    assert.equal(s.lighter.length, 5);
    assert.equal(s.darker.length, 5);
    assert.equal(s.lighter[0].hex, '#995bfc');
    assert.equal(s.selected.hsl, 'hsl(263, 95.9%, 62.2%)');
    assert.match(shadesToCss(s), /--selected-color-hex: #8a42fb;/);
});

test('exportaciones', async () => {
    const pal = ['#ff0000', '#00ff00', '#0000ff'];
    const ase = paletteToAse(pal);
    const bytes = new Uint8Array(await ase.arrayBuffer());
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'ASEF');
    assert.equal(new DataView(bytes.buffer).getUint32(8), 3);
    const gpl = paletteToGpl(pal, 'Test <x>');
    assert.match(gpl, /^GIMP Palette\nName: Test x\n/);
    assert.match(gpl, /255\s+0\s+0/);
    assert.match(paletteToSvg(pal, { layout: 'grid' }), /^<svg /);
    assert.equal(JSON.parse(paletteToJson(pal)).colors.length, 3);
    assert.match(paletteToCss(pal), /--color-1: #ff0000;/);
});

test('estado: sanea datos no fiables', () => {
    const s = sanitizeState({
        palette: ['#ff0000', 'javascript:alert(1)', '#00f'],
        params: { harmony: 'evil', sMin: 9999 },
        module: '__proto__',
        scale: { index: 99, space: 'x' }
    });
    assert.deepEqual(s.palette, ['#ff0000', '#0000ff']);
    assert.equal(s.params.harmony, 'analogous');
    assert.equal(s.params.sMin, 100);
    assert.equal(s.module, 'generator');
    assert.equal(s.scale.index, 1);
    assert.equal(s.scale.space, 'oklch');
});
