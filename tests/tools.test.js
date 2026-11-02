import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch, normalizeHex } from '../src/core/color.js';
import { contrastRatio } from '../src/core/contrast.js';
import { autoRoles } from '../src/core/roles.js';
import { paletteStats, parseHexList } from '../src/core/stats.js';
import {
    BRAND_ROLES, DEFAULT_NAMING, NEUTRAL_ROLES, STATES, SYSTEM_EXPORTS, buildSystem, checkSystem, defaultSeeds, joinName,
    primitiveBases, semanticName
} from '../src/core/system.js';
import { extractPalette } from '../src/core/extract.js';
import { readShareUrl } from '../src/core/store.js';
import { scaleToCss, scaleToJson, scaleToTailwind } from '../src/core/export.js';
import { generateScale } from '../src/core/scale.js';

const PALETTES = [
    ['#8a42fb', '#42d0fb', '#ffd166', '#ef476f', '#06d6a0'],
    ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
    ['#ffffff', '#000000'],
    ['#ff0000']
];

test('roles automáticos: válidos y legibles', () => {
    for (const palette of PALETTES) {
        for (const mode of ['light', 'dark']) {
            const r = autoRoles(palette, mode);
            for (const hex of Object.values(r)) assert.match(hex, /^#[0-9a-f]{6}$/);
            assert.ok(contrastRatio(r.text, r.background) >= 4.5, `${palette} ${mode}`);
        }
    }
    const light = autoRoles(PALETTES[0], 'light');
    assert.ok(hexToOklch(light.background).l > 0.85);
    assert.ok(hexToOklch(autoRoles(PALETTES[0], 'dark').background).l < 0.3);
});

test('sistema de color: tokens completos y contraste correcto en ambos modos', () => {
    for (const palette of PALETTES) {
        const sys = buildSystem(defaultSeeds(palette));
        for (const mode of ['light', 'dark']) {
            for (const r of BRAND_ROLES) {
                for (const s of [...STATES, 'on']) assert.match(sys.tokens[mode].brand[r][s], /^#[0-9a-f]{6}$/, `${r}.${s}`);
            }
            for (const k of NEUTRAL_ROLES) assert.match(sys.tokens[mode].neutral[k], /^#[0-9a-f]{6}$/);
            for (const check of checkSystem(sys, mode)) assert.ok(check.pass, `${palette} ${mode} ${check.id} ${check.ratio.toFixed(2)}`);
        }
        // El modo oscuro tiene fondo oscuro y texto claro
        assert.ok(hexToOklch(sys.tokens.dark.neutral.background).l < hexToOklch(sys.tokens.dark.neutral.text).l);
    }
});

test('sistema de color: las ediciones se aplican', () => {
    const seeds = defaultSeeds(PALETTES[0]);
    const sys = buildSystem(seeds, { light: { primary: { hover: '#123456' }, background: '#fafafa' } });
    assert.equal(sys.tokens.light.brand.primary.hover, '#123456');
    assert.equal(sys.tokens.light.neutral.background, '#fafafa');
});

test('nomenclatura configurable', () => {
    assert.equal(joinName(['color', 'primary', 'hover'], 'kebab'), 'color-primary-hover');
    assert.equal(joinName(['color', 'primary', 'hover'], 'snake'), 'color_primary_hover');
    assert.equal(joinName(['color', 'primary', 'hover'], 'camel'), 'colorPrimaryHover');
    assert.equal(joinName(['color', 'surfaceVariant'], 'dot'), 'color.surface.variant');
    assert.equal(semanticName('primary', 'hover', DEFAULT_NAMING), 'color-primary-hover');
    assert.equal(semanticName('primary', 'default', { ...DEFAULT_NAMING, aliases: { primary: 'brand' } }), 'color-brand');
    const sys = buildSystem(defaultSeeds(PALETTES[0]));
    const names = Object.values(primitiveBases(sys, DEFAULT_NAMING));
    assert.equal(new Set(names).size, names.length, 'sin nombres duplicados');
    assert.ok(Object.values(primitiveBases(sys, { ...DEFAULT_NAMING, primitives: 'role' })).includes('primary'));
});

test('exportaciones del sistema son válidas', () => {
    const sys = buildSystem(defaultSeeds(PALETTES[1]));
    for (const [key, spec] of Object.entries(SYSTEM_EXPORTS)) {
        const text = spec.fn(sys, DEFAULT_NAMING);
        assert.ok(text.length > 200, key);
        assert.ok(!/undefined|NaN/.test(text), `${key} contiene undefined/NaN`);
        if (spec.mime === 'application/json') JSON.parse(text);
    }
    const css = SYSTEM_EXPORTS.css.fn(sys, DEFAULT_NAMING);
    assert.match(css, /--color-primary: /);
    assert.match(css, /\[data-theme="dark"\]/);
    const tokens = JSON.parse(SYSTEM_EXPORTS.tokens.fn(sys, DEFAULT_NAMING));
    assert.equal(tokens.color.semantic.light['color-background'].$type, 'color');
    const json = JSON.parse(SYSTEM_EXPORTS.json.fn(sys, DEFAULT_NAMING));
    assert.ok(json.semantic.dark['color-text']);
    // Las exportaciones respetan una convención distinta
    const camel = SYSTEM_EXPORTS.css.fn(sys, { ...DEFAULT_NAMING, style: 'camel' });
    assert.match(camel, /--colorPrimaryHover: /);
});

test('exportaciones de escala', () => {
    const scale = generateScale('#8a42fb');
    assert.match(scaleToCss('Violet Blue', scale), /--violet-blue-500: /);
    assert.equal(Object.keys(JSON.parse(scaleToJson('x', scale)).x).length, 11);
    assert.match(scaleToTailwind('x', scale), /950: '#/);
    assert.doesNotThrow(() => new Function(`const module = {}; ${scaleToTailwind('x', scale)}`));
});

test('estadísticas de paletas', () => {
    const mono = paletteStats(['#8a42fb', '#a874fc', '#c7a6fd']);
    const rainbow = paletteStats(PALETTES[0]);
    assert.ok(mono.hueSpread < rainbow.hueSpread);
    assert.equal(mono.count, 3);
    assert.equal(mono.hueBins.reduce((a, b) => a + b, 0), 3);
    assert.ok(paletteStats(['#ff5500', '#ffaa00']).temperature > 0.2);
    assert.ok(paletteStats(['#0055ff', '#00aaff']).temperature < -0.2);
    assert.ok(paletteStats(['#000000', '#ffffff']).maxContrast > 20);
    assert.deepEqual(parseHexList('#fff, 00ff00 nope;#12', normalizeHex), ['#ffffff', '#00ff00']);
});

test('extracción de imágenes sintéticas', () => {
    const w = 40, h = 40;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const left = x < 30; // 75 % rojo, 25 % azul
            data[i] = left ? 220 : 20; data[i + 1] = 20; data[i + 2] = left ? 20 : 220; data[i + 3] = 255;
        }
    }
    const colors = extractPalette({ width: w, height: h, data }, 2);
    assert.equal(colors.length, 2);
    assert.ok(colors[0].weight > 0.7 && colors[0].weight < 0.8, `peso ${colors[0].weight}`);
    assert.ok(hexToOklch(colors[0].hex).h < 60 || hexToOklch(colors[0].hex).h > 340, 'el dominante es rojo');
    assert.equal(colors[0].role, 'dominant');
    // Los píxeles transparentes se ignoran
    const transparent = new Uint8ClampedArray(16);
    assert.deepEqual(extractPalette({ width: 2, height: 2, data: transparent }, 3), []);
    // Es determinista con la misma semilla
    assert.deepEqual(extractPalette({ width: w, height: h, data }, 2, { seed: 3 }), extractPalette({ width: w, height: h, data }, 2, { seed: 3 }));
});

test('enlaces compartidos: nuevos y antiguos', () => {
    const modern = readShareUrl('?p=8a42fb-42d0fb-ffd166&k=0.2&h=triadic&m=accessibility&sc=1.lab&tones=4&step=7&color=8a42fb');
    assert.deepEqual(modern.palette, ['#8a42fb', '#42d0fb', '#ffd166']);
    assert.deepEqual(modern.locked, [true, false, true]);
    assert.equal(modern.params.harmony, 'triadic');
    assert.equal(modern.module, 'accessibility');
    assert.deepEqual(modern.scale, { index: 1, space: 'lab' });
    assert.equal(modern.shades.tones, 4);
    const legacy = readShareUrl('?color=c4d600&tones=3&step=8');
    assert.equal(legacy.palette[0], '#c4d600');
    assert.equal(legacy.shades.step, 8);
    assert.equal(legacy.useMain, true);
    assert.equal(legacy.module, 'generator');
    assert.equal(readShareUrl('?foo=bar'), null);
    // Valores maliciosos se descartan
    const bad = readShareUrl('?p=zzzzzz-<script>&color=javascript');
    assert.equal(bad, null);
});
