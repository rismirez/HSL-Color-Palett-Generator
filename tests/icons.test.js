import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import DATA from '../src/ui/animated-icons-data.js';

const CUSTOM = ['wheel']; // iconos propios definidos en src/ui/icons.js

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && !p.endsWith('animated-icons-data.js') ? [p] : [];
    });
}

test('todo icono usado en la interfaz existe', () => {
    const used = new Set();
    for (const file of walk('src')) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\bicon\(\s*'([a-z]+)'/g)) used.add(m[1]);
        for (const m of src.matchAll(/iconName:\s*'([a-z]+)'/g)) used.add(m[1]);
        for (const m of src.matchAll(/\bmk\(\s*'([a-z]+)'/g)) used.add(m[1]);
        for (const m of src.matchAll(/\bicon\([^)]*\?\s*'([a-z]+)'\s*:\s*'([a-z]+)'/g)) { used.add(m[1]); used.add(m[2]); }
        for (const m of src.matchAll(/MODULE_ICONS\s*=\s*\{([^}]*)\}/g)) for (const n of m[1].matchAll(/:\s*'([a-z]+)'/g)) used.add(n[1]);
    }
    const missing = [...used].filter(n => !(n in DATA) && !CUSTOM.includes(n));
    assert.deepEqual(missing, []);
    assert.ok(used.size > 20);
});

test('los datos de iconos están bien formados', () => {
    const SVG_TAGS = new Set(['path', 'rect', 'circle', 'line', 'g', 'ellipse', 'polyline', 'polygon']);
    const check = (node, where) => {
        assert.ok(SVG_TAGS.has(node.t), `${where}: etiqueta ${node.t}`);
        if (node.p) {
            assert.ok(node.p.props && Object.keys(node.p.props).length, `${where}: animación vacía`);
            for (const [k, v] of Object.entries(node.p.props)) {
                assert.ok(['x', 'y', 'rotate', 'scale', 'scaleX', 'scaleY', 'opacity', 'strokeDashoffset'].includes(k), `${where}: propiedad ${k}`);
                for (const n of [].concat(v)) assert.ok(Number.isFinite(+n), `${where}: valor ${n}`);
            }
            const { times } = node.p.tr || {};
            if (times) assert.ok(times.every((t, i) => i === 0 || t >= times[i - 1]), `${where}: tiempos no crecientes`);
        }
        (node.k || []).forEach(c => check(c, where));
    };
    for (const [name, def] of Object.entries(DATA)) {
        assert.ok(def.k.length, name);
        def.k.forEach(n => check(n, name));
    }
    assert.ok(Object.keys(DATA).length >= 38);
});
