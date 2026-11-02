import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../src/i18n/en.js';
import es from '../src/i18n/es.js';
import { HARMONIES, PRESETS } from '../src/core/harmony.js';
import { CVD_TYPES } from '../src/core/contrast.js';
import { BRAND_ROLES, MODES, NAME_STYLES, NEUTRAL_ROLES, STATES } from '../src/core/system.js';
import { MODULES } from '../src/core/store.js';
import { ROLES, TEMPLATE_IDS } from '../src/ui/templates.js';
import { IMAGE_LAYOUTS } from '../src/core/export.js';

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
    });
}

test('en y es tienen exactamente las mismas claves', () => {
    const a = Object.keys(en).sort(), b = Object.keys(es).sort();
    assert.deepEqual(a.filter(k => !(k in es)), [], 'faltan en español');
    assert.deepEqual(b.filter(k => !(k in en)), [], 'faltan en inglés');
});

test('los textos no mezclan idiomas ni quedan vacíos', () => {
    for (const [k, v] of Object.entries(en)) assert.ok(v.trim(), `en ${k} vacío`);
    for (const [k, v] of Object.entries(es)) assert.ok(v.trim(), `es ${k} vacío`);
    // Los marcadores de variables coinciden en ambos idiomas
    for (const k of Object.keys(en)) {
        const vars = s => (s.match(/\{\w+\}/g) || []).sort().join();
        assert.equal(vars(en[k]), vars(es[k]), `variables de ${k}`);
    }
});

test('toda clave usada en el código existe', () => {
    const used = new Set();
    for (const file of walk('src')) {
        if (file.includes('i18n')) continue;
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1]);
        // Claves guardadas como cadenas para traducir después (p. ej. data-key o tablas de etiquetas)
        for (const m of src.matchAll(/'((?:gen|ext|acc|sys|lab|prev|tpl|cvd|picker|toast|nav|app|header|footer|theme)\.[\w.]+)'/g)) used.add(m[1]);
    }
    const missing = [...used].filter(k => !(k in en));
    assert.deepEqual(missing, []);
});

test('claves dinámicas cubiertas', () => {
    const need = [];
    const add = (prefix, list) => list.forEach(x => need.push(`${prefix}${x}`));
    add('nav.', MODULES);
    add('harmony.', Object.keys(HARMONIES));
    add('temp.', ['any', 'warm', 'neutral', 'cool']);
    add('dist.', ['even', 'random']);
    add('preset.', Object.keys(PRESETS).concat('mono'));
    add('layout.', IMAGE_LAYOUTS);
    add('opt.', ['name', 'hex', 'rgb', 'hsl', 'brand']);
    add('ext.role.', ['dominant', 'secondary', 'accent']);
    add('acc.grade.', ['AAA', 'AA', 'largeOnly', 'fail']);
    add('acc.fix.', ['text', 'background', 'both']);
    add('acc.role.', ['text', 'background', 'interactive']);
    add('cvd.', ['original', ...CVD_TYPES]);
    add('prev.role.', ROLES);
    add('prev.roleHint.', ROLES);
    add('prev.tpl.', TEMPLATE_IDS);
    add('sys.role.', [...BRAND_ROLES, ...NEUTRAL_ROLES]);
    add('sys.state.', [...STATES, 'on']);
    add('sys.mode.', MODES);
    add('sys.style.', NAME_STYLES);
    add('sys.prim.', ['hue', 'role']);
    add('sys.check.', ['text', 'textSecondary', 'textOnSurface', 'onPrimary', 'primaryUi', 'onError', 'errorUi', 'onSuccess']);
    add('lab.tab.', ['mixer', 'gradient', 'comparator', 'blindness']);
    add('lab.grad.', ['linear', 'radial', 'conic']);
    add('lab.shape.', ['circle', 'ellipse']);
    add('theme.', ['auto', 'dark', 'light']);
    add('tpl.', ['feature1', 'feature2', 'feature3']);
    assert.deepEqual(need.filter(k => !(k in en)), []);
});
