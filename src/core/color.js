// Motor cromático: conversiones entre espacios, gamut mapping, interpolación y formato.
// Un color se representa siempre como cadena HEX "#rrggbb" fuera de este módulo.

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const round = (v, d = 0) => {
    const f = 10 ** d;
    return Math.round(v * f) / f;
};
export const mod360 = h => ((h % 360) + 360) % 360;

// ---------- Parseo y HEX ----------

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value) {
    return typeof value === 'string' && HEX_RE.test(value.trim());
}

export function normalizeHex(value) {
    if (!isHex(value)) return null;
    let h = value.trim().replace('#', '').toLowerCase();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return '#' + h;
}

export function hexToRgb(hex) {
    const n = normalizeHex(hex);
    if (!n) return null;
    return { r: parseInt(n.slice(1, 3), 16), g: parseInt(n.slice(3, 5), 16), b: parseInt(n.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }) {
    const to = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
}

// ---------- sRGB <-> lineal ----------

const toLinear = c => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055);

export const rgbToLinear = ({ r, g, b }) => [toLinear(r), toLinear(g), toLinear(b)];
export const linearToRgb = ([r, g, b]) => ({ r: fromLinear(r), g: fromLinear(g), b: fromLinear(b) });

// ---------- HSL / HSV / CMYK ----------

export function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return { h: mod360(h), s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }) {
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + mod360(h) / 30) % 12;
        return 255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1));
    };
    return { r: f(0), g: f(8), b: f(4) };
}

export function rgbToHsv({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return { h: mod360(h), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

export function hsvToRgb({ h, s, v }) {
    s = clamp(s, 0, 100) / 100;
    v = clamp(v, 0, 100) / 100;
    const f = n => {
        const k = (n + mod360(h) / 60) % 6;
        return 255 * (v - v * s * Math.max(Math.min(k, 4 - k, 1), 0));
    };
    return { r: f(5), g: f(3), b: f(1) };
}

export function rgbToCmyk({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
        c: ((1 - r - k) / (1 - k)) * 100,
        m: ((1 - g - k) / (1 - k)) * 100,
        y: ((1 - b - k) / (1 - k)) * 100,
        k: k * 100
    };
}

export function cmykToRgb({ c, m, y, k }) {
    const f = v => clamp(v, 0, 100) / 100;
    const kk = 1 - f(k);
    return { r: 255 * (1 - f(c)) * kk, g: 255 * (1 - f(m)) * kk, b: 255 * (1 - f(y)) * kk };
}

// ---------- XYZ / LAB / LCH (D65) ----------

const WHITE = [0.95047, 1, 1.08883];

export function rgbToXyz(rgb) {
    const [r, g, b] = rgbToLinear(rgb);
    return [
        0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
        0.2126729 * r + 0.7151522 * g + 0.072175 * b,
        0.0193339 * r + 0.119192 * g + 0.9503041 * b
    ];
}

export function xyzToRgbLinear([x, y, z]) {
    return [
        3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
        -0.969266 * x + 1.8760108 * y + 0.041556 * z,
        0.0556434 * x - 0.2040259 * y + 1.0572252 * z
    ];
}

const EPS = 216 / 24389;
const KAPPA = 24389 / 27;
const labF = t => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const labFInv = t => (t ** 3 > EPS ? t ** 3 : (116 * t - 16) / KAPPA);

export function rgbToLab(rgb) {
    const [x, y, z] = rgbToXyz(rgb).map((v, i) => v / WHITE[i]);
    const fx = labF(x), fy = labF(y), fz = labF(z);
    return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToLinear({ l, a, b }) {
    const fy = (l + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const xyz = [labFInv(fx) * WHITE[0], (l > KAPPA * EPS ? fy ** 3 : l / KAPPA) * WHITE[1], labFInv(fz) * WHITE[2]];
    return xyzToRgbLinear(xyz);
}

export const labToLch = ({ l, a, b }) => ({ l, c: Math.hypot(a, b), h: mod360((Math.atan2(b, a) * 180) / Math.PI) });
export const lchToLab = ({ l, c, h }) => ({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180)
});

// ---------- OKLab / OKLCH ----------

export function rgbToOklab(rgb) {
    const [r, g, b] = rgbToLinear(rgb);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
}

export function oklabToLinear({ l: L, a, b }) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
}

export const oklabToOklch = ({ l, a, b }) => {
    const c = Math.hypot(a, b);
    return { l, c, h: c < 1e-4 ? 0 : mod360((Math.atan2(b, a) * 180) / Math.PI) };
};
export const oklchToOklab = ({ l, c, h }) => ({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180)
});

// ---------- Gamut mapping ----------

const inGamut = lin => lin.every(v => v >= -0.0005 && v <= 1.0005);

// Reduce el croma manteniendo luminosidad y tono hasta entrar en sRGB.
export function oklchToRgbInGamut({ l, c, h }) {
    l = clamp(l, 0, 1);
    c = Math.max(0, c);
    let lin = oklabToLinear(oklchToOklab({ l, c, h }));
    if (!inGamut(lin)) {
        let lo = 0, hi = c;
        for (let i = 0; i < 24; i++) {
            const mid = (lo + hi) / 2;
            if (inGamut(oklabToLinear(oklchToOklab({ l, c: mid, h })))) lo = mid;
            else hi = mid;
        }
        lin = oklabToLinear(oklchToOklab({ l, c: lo, h }));
    }
    return linearToRgb(lin.map(v => clamp(v, 0, 1)));
}

export function labToRgbInGamut(lab) {
    const lin = labToLinear(lab);
    if (inGamut(lin)) return linearToRgb(lin.map(v => clamp(v, 0, 1)));
    const lch = labToLch(lab);
    let lo = 0, hi = lch.c;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(labToLinear(lchToLab({ ...lch, c: mid })))) lo = mid;
        else hi = mid;
    }
    return linearToRgb(labToLinear(lchToLab({ ...lch, c: lo })).map(v => clamp(v, 0, 1)));
}

// ---------- API sobre HEX ----------

export const hexToHsl = hex => rgbToHsl(hexToRgb(hex));
export const hslToHex = (h, s, l) => rgbToHex(hslToRgb({ h, s, l }));
export const hexToHsv = hex => rgbToHsv(hexToRgb(hex));
export const hexToOklch = hex => oklabToOklch(rgbToOklab(hexToRgb(hex)));
export const oklchToHex = (l, c, h) => rgbToHex(oklchToRgbInGamut({ l, c, h }));
export const hexToLab = hex => rgbToLab(hexToRgb(hex));
export const hexToLch = hex => labToLch(hexToLab(hex));
export const hexToCmyk = hex => rgbToCmyk(hexToRgb(hex));

export function isOutOfGamut(l, c, h) {
    return !inGamut(oklabToLinear(oklchToOklab({ l, c, h })));
}

// ---------- Interpolación ----------

export const SPACES = ['rgb', 'hsl', 'lab', 'oklch'];

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpHue(a, b, t) {
    const d = ((b - a + 540) % 360) - 180;
    return mod360(a + d * t);
}

export function mixColors(hexA, hexB, t, space = 'oklch') {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    switch (space) {
        case 'rgb':
            return rgbToHex({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });
        case 'hsl': {
            const ha = rgbToHsl(a), hb = rgbToHsl(b);
            // Un gris no tiene tono propio: toma el del otro extremo
            const hueA = ha.s < 1 ? hb.h : ha.h, hueB = hb.s < 1 ? ha.h : hb.h;
            return hslToHex(lerpHue(hueA, hueB, t), lerp(ha.s, hb.s, t), lerp(ha.l, hb.l, t));
        }
        case 'lab': {
            const la = rgbToLab(a), lb = rgbToLab(b);
            return rgbToHex(labToRgbInGamut({ l: lerp(la.l, lb.l, t), a: lerp(la.a, lb.a, t), b: lerp(la.b, lb.b, t) }));
        }
        default: {
            const oa = oklabToOklch(rgbToOklab(a)), ob = oklabToOklch(rgbToOklab(b));
            const hueA = oa.c < 0.02 ? ob.h : oa.h, hueB = ob.c < 0.02 ? oa.h : ob.h;
            return oklchToHex(lerp(oa.l, ob.l, t), lerp(oa.c, ob.c, t), lerpHue(hueA, hueB, t));
        }
    }
}

// ---------- Formato y parseo de texto ----------

export const FORMATS = ['hex', 'rgb', 'hsl', 'hsv', 'oklch', 'cmyk', 'lab', 'lch'];

export function formatColor(hex, format = 'hex') {
    const rgb = hexToRgb(hex);
    switch (format) {
        case 'rgb':
            return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
        case 'hsl': {
            const { h, s, l } = rgbToHsl(rgb);
            return `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`;
        }
        case 'hsv': {
            const { h, s, v } = rgbToHsv(rgb);
            return `hsv(${round(h)}, ${round(s)}%, ${round(v)}%)`;
        }
        case 'oklch': {
            const { l, c, h } = hexToOklch(hex);
            return `oklch(${round(l * 100, 1)}% ${round(c, 3)} ${round(h, 1)})`;
        }
        case 'cmyk': {
            const { c, m, y, k } = rgbToCmyk(rgb);
            return `cmyk(${round(c)}%, ${round(m)}%, ${round(y)}%, ${round(k)}%)`;
        }
        case 'lab': {
            const { l, a, b } = rgbToLab(rgb);
            return `lab(${round(l, 1)} ${round(a, 1)} ${round(b, 1)})`;
        }
        case 'lch': {
            const { l, c, h } = hexToLch(hex);
            return `lch(${round(l, 1)} ${round(c, 1)} ${round(h, 1)})`;
        }
        default:
            return normalizeHex(hex);
    }
}

const nums = (str, n) => {
    const m = str.match(new RegExp('-?\\d*\\.?\\d+', 'g'));
    return m && m.length >= n ? m.slice(0, n).map(Number) : null;
};

// Interpreta HEX, rgb(), hsl(), hsv(), oklch(), cmyk(), lab() o lch(). Devuelve HEX o null.
export function parseColor(input) {
    if (typeof input !== 'string') return null;
    const text = input.trim();
    if (!text) return null;
    const hex = normalizeHex(text);
    if (hex) return hex;
    const fn = text.match(/^([a-z]+)\s*\(([^)]*)\)$/i);
    if (!fn) return null;
    const name = fn[1].toLowerCase();
    const v = nums(fn[2], name === 'cmyk' ? 4 : 3);
    if (!v || v.some(Number.isNaN)) return null;
    switch (name) {
        case 'rgb':
            return rgbToHex({ r: v[0], g: v[1], b: v[2] });
        case 'hsl':
            return rgbToHex(hslToRgb({ h: v[0], s: v[1], l: v[2] }));
        case 'hsv':
            return rgbToHex(hsvToRgb({ h: v[0], s: v[1], v: v[2] }));
        case 'cmyk':
            return rgbToHex(cmykToRgb({ c: v[0], m: v[1], y: v[2], k: v[3] }));
        case 'oklch': {
            const l = /%/.test(fn[2].split(/\s+/)[0]) || v[0] > 1 ? v[0] / 100 : v[0];
            return rgbToHex(oklchToRgbInGamut({ l, c: v[1], h: v[2] }));
        }
        case 'lab':
            return rgbToHex(labToRgbInGamut({ l: v[0], a: v[1], b: v[2] }));
        case 'lch':
            return rgbToHex(labToRgbInGamut(lchToLab({ l: v[0], c: v[1], h: v[2] })));
        default:
            return null;
    }
}

export function randomHex(rand = Math.random) {
    return oklchToHex(0.35 + rand() * 0.5, 0.05 + rand() * 0.17, rand() * 360);
}
