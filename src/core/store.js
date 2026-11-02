// Estado global de la aplicación, persistencia local y enlaces compartibles.
import { clamp, normalizeHex } from './color.js';
import { DEFAULT_PARAMS, HARMONIES, generatePalette } from './harmony.js';

const STATE_KEY = 'hslcs.state.v2';
export const MODULES = ['generator', 'extractor', 'accessibility', 'preview', 'systems', 'lab'];

export const DEFAULT_COLOR = '#8a42fb';

export function defaultState() {
    return {
        module: 'generator',
        palette: ['#8a42fb', '#6a8ffb', '#42d0fb', '#42fba0', '#d0fb42'],
        locked: [false, false, false, false, false],
        mainColor: DEFAULT_COLOR,
        useMain: false,
        params: { ...DEFAULT_PARAMS },
        preset: 'none',
        scale: { index: 0, space: 'oklch' },
        shades: { base: DEFAULT_COLOR, tones: 5, step: 5 }
    };
}

// ---------- Validación (el estado procede de localStorage o de una URL: nunca se confía) ----------

const num = (v, min, max, fallback) => (Number.isFinite(+v) ? clamp(+v, min, max) : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

export function sanitizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const palette = Array.isArray(raw.palette)
        ? raw.palette.map(normalizeHex).filter(Boolean).slice(0, 16)
        : [];
    if (palette.length >= 1) {
        base.palette = palette;
        base.locked = palette.map((_, i) => Boolean(raw.locked?.[i]));
    }
    base.module = oneOf(raw.module, MODULES, 'generator');
    base.mainColor = normalizeHex(raw.mainColor) || base.mainColor;
    base.useMain = Boolean(raw.useMain);
    const p = raw.params || {};
    base.params = {
        harmony: oneOf(p.harmony, Object.keys(HARMONIES), DEFAULT_PARAMS.harmony),
        temperature: oneOf(p.temperature, ['any', 'warm', 'neutral', 'cool'], 'any'),
        sMin: num(p.sMin, 0, 100, DEFAULT_PARAMS.sMin),
        sMax: num(p.sMax, 0, 100, DEFAULT_PARAMS.sMax),
        lMin: num(p.lMin, 0, 100, DEFAULT_PARAMS.lMin),
        lMax: num(p.lMax, 0, 100, DEFAULT_PARAMS.lMax),
        hueSpread: num(p.hueSpread, 0, 200, DEFAULT_PARAMS.hueSpread),
        contrast: num(p.contrast, 0, 100, DEFAULT_PARAMS.contrast),
        distribution: oneOf(p.distribution, ['even', 'random'], 'even')
    };
    base.preset = oneOf(raw.preset, ['none', 'pastel', 'vibrant', 'muted', 'dark', 'light', 'mono'], 'none');
    base.scale = {
        index: clamp(Math.round(num(raw.scale?.index, 0, 15, 0)), 0, base.palette.length - 1),
        space: oneOf(raw.scale?.space, ['hsl', 'lab', 'oklch'], 'oklch')
    };
    base.shades = {
        base: normalizeHex(raw.shades?.base) || base.shades.base,
        tones: Math.round(num(raw.shades?.tones, 1, 10, 5)),
        step: Math.round(num(raw.shades?.step, 1, 20, 5))
    };
    return base;
}

// ---------- Store ----------

let state = defaultState();
const listeners = new Set();
let saveTimer = null;

export function loadState() {
    try {
        state = sanitizeState(JSON.parse(localStorage.getItem(STATE_KEY)));
    } catch {
        state = defaultState();
    }
    return state;
}

function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch { /* almacenamiento no disponible */ }
    }, 200);
}

export const getState = () => state;

/** Aplica un parche superficial y notifica. `topic` indica qué cambió (para evitar renders innecesarios). */
export function setState(patch, topic = 'state') {
    state = { ...state, ...patch };
    persist();
    listeners.forEach(fn => fn(state, topic));
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Actualiza la paleta manteniendo coherentes locked y el índice de escala.
export function setPalette(palette, locked = state.locked) {
    const fixed = palette.slice(0, 16);
    const lockedFixed = fixed.map((_, i) => Boolean(locked[i]));
    setState({
        palette: fixed,
        locked: lockedFixed,
        scale: { ...state.scale, index: clamp(state.scale.index, 0, fixed.length - 1) }
    }, 'palette');
}

export function regenerate({ ignoreLocks = false, rand = Math.random } = {}) {
    const { palette, locked, params, mainColor, useMain } = state;
    const lockedColors = palette.map((c, i) => (!ignoreLocks && locked[i] ? c : null));
    const next = generatePalette({
        count: palette.length,
        locked: lockedColors,
        base: useMain ? mainColor : null,
        params,
        rand
    });
    setPalette(next, ignoreLocks ? palette.map(() => false) : locked);
}

// ---------- Compartir por URL ----------

export function buildShareUrl(s = state, extra = {}) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    const q = url.searchParams;
    q.set('p', s.palette.map(c => c.slice(1)).join('-'));
    const lockedIdx = s.locked.map((l, i) => (l ? i : -1)).filter(i => i >= 0);
    if (lockedIdx.length) q.set('k', lockedIdx.join('.'));
    q.set('h', s.params.harmony);
    q.set('m', s.module);
    q.set('sc', `${s.scale.index}.${s.scale.space}`);
    // Parámetros del generador original, para que los enlaces antiguos y nuevos convivan
    q.set('color', s.shades.base.slice(1));
    q.set('tones', String(s.shades.tones));
    q.set('step', String(s.shades.step));
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    return url.toString();
}

/** Lee la URL y devuelve un parche de estado (o null si no hay parámetros reconocibles). */
export function readShareUrl(search = window.location.search) {
    const q = new URLSearchParams(search);
    const patch = {};
    const colors = (q.get('p') || '').split('-').map(c => normalizeHex('#' + c)).filter(Boolean);
    if (colors.length) {
        patch.palette = colors.slice(0, 16);
        patch.locked = patch.palette.map((_, i) => (q.get('k') || '').split('.').includes(String(i)));
    }
    const legacyColor = normalizeHex(q.get('color'));
    if (legacyColor) {
        patch.shades = {
            base: legacyColor,
            tones: Math.round(num(q.get('tones'), 1, 10, 5)),
            step: Math.round(num(q.get('step'), 1, 20, 5))
        };
        patch.mainColor = legacyColor;
        patch.module = 'generator'; // los enlaces del generador original siempre abren el Generator
        if (!colors.length) {
            // Enlace antiguo: sólo había un color base; se construye una paleta armónica a su alrededor
            patch.palette = generatePalette({ count: 5, base: legacyColor, params: { harmony: 'analogous' } });
            patch.locked = [true, false, false, false, false];
            patch.useMain = true;
        }
    }
    if (q.get('h')) patch.params = { harmony: q.get('h') };
    if (q.get('m')) patch.module = q.get('m');
    if (q.get('sc')) {
        const [index, space] = q.get('sc').split('.');
        patch.scale = { index: Number(index), space };
    }
    return Object.keys(patch).length ? patch : null;
}

export function applyShareUrl() {
    const patch = readShareUrl();
    if (!patch) return false;
    const merged = sanitizeState({
        ...state,
        ...patch,
        params: { ...state.params, ...(patch.params || {}) },
        shades: { ...state.shades, ...(patch.shades || {}) },
        scale: { ...state.scale, ...(patch.scale || {}) }
    });
    state = merged;
    persist();
    return true;
}
