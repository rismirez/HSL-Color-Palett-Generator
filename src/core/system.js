// Sistemas de color: tokens primitivos y semánticos, modos claro/oscuro, estados interactivos y exportación.
import { clamp, hexToOklch, mixColors, oklchToHex } from './color.js';
import { contrastRatio, readableOn, suggestFixes } from './contrast.js';
import { hueFamily } from './names.js';
import { shade } from './harmony.js';
import { generateScale } from './scale.js';
import { slug } from './export.js';

export const BRAND_ROLES = ['primary', 'secondary', 'tertiary', 'accent', 'success', 'warning', 'error', 'info'];
export const NEUTRAL_ROLES = ['background', 'surface', 'surfaceVariant', 'border', 'text', 'textSecondary', 'disabled'];
export const STATES = ['default', 'hover', 'active', 'focus', 'disabled', 'selected'];
export const MODES = ['light', 'dark'];

const STATUS_HUES = { success: 150, warning: 80, error: 27, info: 250 };

/** Semillas de cada rol de marca a partir de la paleta actual. Los estados se derivan de tonos fijos. */
export function defaultSeeds(palette) {
    const base = palette[0];
    const { l, c, h } = hexToOklch(base);
    const pick = (i, offset) => palette[i] || oklchToHex(l, c, h + offset);
    const status = {};
    const chroma = clamp(c, 0.12, 0.2);
    for (const [role, hue] of Object.entries(STATUS_HUES)) status[role] = oklchToHex(clamp(l, 0.55, 0.68), chroma, hue);
    return {
        primary: base, secondary: pick(1, 40), tertiary: pick(2, 120), accent: pick(3, 200), ...status
    };
}

function ensureContrast(color, bg, target) {
    if (contrastRatio(color, bg) >= target) return color;
    const fix = suggestFixes(color, bg, target).find(f => f.kind === 'text');
    return fix ? fix.fg : color;
}

/** Colores de un rol de marca en un modo: base, estados y color de texto encima. */
function brandVariants(seed, mode, surface) {
    const { l, c, h } = hexToOklch(seed);
    const scale = generateScale(seed, 'oklch');
    const dir = mode === 'light' ? -1 : 1;
    let base;
    if (mode === 'light') base = ensureContrast(seed, surface, 3);
    else base = ensureContrast(oklchToHex(Math.max(l, 0.72), c * 0.9, h), surface, 4.5);
    const step = (idx) => scale[idx].hex;
    return {
        default: base,
        hover: shade(base, dir * 0.05),
        active: shade(base, dir * 0.09),
        focus: mode === 'light' ? step(4) : step(6),
        disabled: mixColors(base, surface, 0.62, 'oklch'),
        selected: mixColors(base, surface, 0.86, 'oklch'),
        on: readableOn(base)
    };
}

function neutralTokens(neutral, mode) {
    const s = Object.fromEntries(neutral.map(x => [x.step, x.hex]));
    if (mode === 'light') {
        return { background: s[50], surface: mixColors(s[50], '#ffffff', 0.75), surfaceVariant: s[100], border: s[200], text: s[900], textSecondary: s[600], disabled: s[400] };
    }
    return { background: s[950], surface: s[900], surfaceVariant: s[800], border: s[700], text: s[50], textSecondary: s[300], disabled: s[600] };
}

/**
 * Construye el sistema completo.
 * @param {Record<string,string>} seeds colores semilla de BRAND_ROLES
 * @param {object} overrides { light: { primary: { hover: '#…' }, background: '#…' }, dark: {…} }
 */
export function buildSystem(seeds, overrides = {}) {
    const { c, h } = hexToOklch(seeds.primary);
    const neutral = generateScale(oklchToHex(0.6, Math.min(c * 0.15, 0.025), h), 'oklch', { anchor: 500 });
    const primitives = { neutral, ...Object.fromEntries(BRAND_ROLES.map(r => [r, generateScale(seeds[r], 'oklch')])) };

    const tokens = {};
    for (const mode of MODES) {
        const neutrals = neutralTokens(neutral, mode);
        // textSecondary debe ser legible sobre el fondo en ambos modos
        neutrals.textSecondary = ensureContrast(neutrals.textSecondary, neutrals.background, 4.5);
        const brand = Object.fromEntries(BRAND_ROLES.map(r => [r, brandVariants(seeds[r], mode, neutrals.surface)]));
        const ov = overrides[mode] || {};
        for (const key of NEUTRAL_ROLES) if (ov[key]) neutrals[key] = ov[key];
        for (const r of BRAND_ROLES) for (const k of [...STATES, 'on']) if (ov[r]?.[k]) brand[r][k] = ov[r][k];
        tokens[mode] = { brand, neutral: neutrals };
    }
    return { seeds, primitives, tokens };
}

/** Comprobaciones de contraste de un modo del sistema. */
export function checkSystem(sys, mode) {
    const { brand, neutral } = sys.tokens[mode];
    const row = (id, fg, bg, min) => ({ id, fg, bg, min, ratio: contrastRatio(fg, bg), pass: contrastRatio(fg, bg) >= min });
    return [
        row('text', neutral.text, neutral.background, 4.5),
        row('textSecondary', neutral.textSecondary, neutral.background, 4.5),
        row('textOnSurface', neutral.text, neutral.surface, 4.5),
        row('onPrimary', brand.primary.on, brand.primary.default, 4.5),
        row('primaryUi', brand.primary.default, neutral.surface, 3),
        row('onError', brand.error.on, brand.error.default, 4.5),
        row('errorUi', brand.error.default, neutral.surface, 3),
        row('onSuccess', brand.success.on, brand.success.default, 4.5)
    ];
}

// ---------- Nombres ----------

export const DEFAULT_NAMING = { prefix: 'color', style: 'kebab', primitives: 'hue', aliases: {} };
export const NAME_STYLES = ['kebab', 'snake', 'camel', 'dot'];

const SEPARATORS = { kebab: '-', snake: '_', dot: '.' };
const words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w.toLowerCase());

export function joinName(parts, style = 'kebab') {
    const all = parts.flatMap(p => words(String(p)));
    if (style === 'camel') return all.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
    return all.join(SEPARATORS[style] || '-');
}

export function semanticName(role, state, naming) {
    const alias = naming.aliases?.[role] || role;
    const parts = [naming.prefix, alias];
    if (state && state !== 'default') parts.push(state);
    return joinName(parts.filter(Boolean), naming.style);
}

// Nombre de cada escala primitiva: por familia de tono ("blue") o por rol ("primary"); sin duplicados.
export function primitiveBases(sys, naming) {
    const used = new Map();
    const out = {};
    for (const key of Object.keys(sys.primitives)) {
        let base = key === 'neutral' ? 'neutral' : naming.primitives === 'role' ? (naming.aliases?.[key] || key) : hueFamily(sys.seeds[key]);
        // Si dos roles comparten familia de tono ("yellow"), el segundo se distingue con su rol ("yellow-warning")
        if (used.has(base)) base = `${base} ${naming.aliases?.[key] || key}`;
        used.set(base, true);
        out[key] = slug(base);
    }
    return out;
}

export const primitiveName = (base, step, naming) => joinName([base, step], naming.style);

// Si un valor coincide con un paso primitivo se referencia por nombre en lugar de repetir el HEX.
function referenceTable(sys, naming) {
    const bases = primitiveBases(sys, naming);
    const map = new Map();
    for (const [key, scale] of Object.entries(sys.primitives)) {
        for (const { step, hex } of scale) if (!map.has(hex)) map.set(hex, { base: bases[key], step });
    }
    return { bases, find: hex => map.get(hex) };
}

// Aplana los tokens semánticos de un modo a [{ name, role, state, value }].
function flattenSemantic(sys, mode, naming) {
    const { brand, neutral } = sys.tokens[mode];
    const rows = [];
    for (const r of BRAND_ROLES) {
        for (const state of [...STATES, 'on']) {
            rows.push({ name: semanticName(r, state === 'on' ? 'on' : state, naming), role: r, state, value: brand[r][state] });
        }
    }
    for (const k of NEUTRAL_ROLES) rows.push({ name: semanticName(k, null, naming), role: k, state: 'default', value: neutral[k] });
    return rows;
}

// ---------- Exportaciones ----------

export function systemToCss(sys, naming = DEFAULT_NAMING) {
    const { bases, find } = referenceTable(sys, naming);
    const prim = Object.entries(sys.primitives).flatMap(([key, scale]) =>
        scale.map(s => `  --${primitiveName(bases[key], s.step, naming)}: ${s.hex};`));
    const sem = mode => flattenSemantic(sys, mode, naming).map(r => {
        const ref = find(r.value);
        return `  --${r.name}: ${ref ? `var(--${primitiveName(ref.base, ref.step, naming)})` : r.value};`;
    });
    return `:root {\n  /* Primitive tokens */\n${prim.join('\n')}\n\n  /* Semantic tokens (light) */\n${sem('light').join('\n')}\n}\n\n[data-theme="dark"] {\n  /* Semantic tokens (dark) */\n${sem('dark').join('\n')}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${sem('dark').map(l => `  ${l}`).join('\n')}\n  }\n}\n`;
}

export function systemToScss(sys, naming = DEFAULT_NAMING) {
    const { bases, find } = referenceTable(sys, naming);
    const prim = Object.entries(sys.primitives).flatMap(([key, scale]) =>
        scale.map(s => `$${primitiveName(bases[key], s.step, naming)}: ${s.hex};`));
    const sem = mode => flattenSemantic(sys, mode, naming).map(r => {
        const ref = find(r.value);
        return `$${r.name}-${mode}: ${ref ? `$${primitiveName(ref.base, ref.step, naming)}` : r.value};`;
    });
    return `// Primitive tokens\n${prim.join('\n')}\n\n// Semantic tokens (light)\n${sem('light').join('\n')}\n\n// Semantic tokens (dark)\n${sem('dark').join('\n')}\n`;
}

export function systemToJson(sys, naming = DEFAULT_NAMING) {
    const { bases } = referenceTable(sys, naming);
    const primitives = {};
    for (const [key, scale] of Object.entries(sys.primitives)) {
        primitives[bases[key]] = Object.fromEntries(scale.map(s => [s.step, s.hex]));
    }
    const semantic = {};
    for (const mode of MODES) {
        semantic[mode] = Object.fromEntries(flattenSemantic(sys, mode, naming).map(r => [r.name, r.value]));
    }
    return JSON.stringify({ primitives, semantic }, null, 2);
}

export function systemToTailwind(sys, naming = DEFAULT_NAMING) {
    const { bases } = referenceTable(sys, naming);
    const scales = Object.entries(sys.primitives).map(([key, scale]) =>
        `        '${bases[key]}': {\n${scale.map(s => `          ${s.step}: '${s.hex}',`).join('\n')}\n        },`).join('\n');
    const sem = flattenSemantic(sys, 'light', naming).map(r => `        '${r.name}': 'var(--${r.name})',`).join('\n');
    return `// tailwind.config.js — define the semantic CSS variables from the CSS export\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${scales}\n${sem}\n      }\n    }\n  }\n};\n`;
}

// Formato de Design Tokens (W3C Community Group): $type/$value con referencias {grupo.token}.
export function systemToTokens(sys, naming = DEFAULT_NAMING) {
    const { bases, find } = referenceTable(sys, naming);
    const primitive = {};
    for (const [key, scale] of Object.entries(sys.primitives)) {
        primitive[bases[key]] = Object.fromEntries(scale.map(s => [s.step, { $type: 'color', $value: s.hex }]));
    }
    const semantic = {};
    for (const mode of MODES) {
        semantic[mode] = Object.fromEntries(flattenSemantic(sys, mode, naming).map(r => {
            const ref = find(r.value);
            return [r.name, { $type: 'color', $value: ref ? `{color.primitive.${ref.base}.${ref.step}}` : r.value }];
        }));
    }
    return JSON.stringify({ color: { primitive, semantic } }, null, 2);
}

export const SYSTEM_EXPORTS = {
    css: { fn: systemToCss, ext: 'css', mime: 'text/css', label: 'CSS Variables' },
    scss: { fn: systemToScss, ext: 'scss', mime: 'text/plain', label: 'SCSS Variables' },
    json: { fn: systemToJson, ext: 'json', mime: 'application/json', label: 'JSON' },
    tailwind: { fn: systemToTailwind, ext: 'js', mime: 'text/javascript', label: 'Tailwind CSS' },
    tokens: { fn: systemToTokens, ext: 'tokens.json', mime: 'application/json', label: 'Design Tokens' }
};

