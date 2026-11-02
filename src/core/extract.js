// Extracción local de paletas desde imágenes (k-means ponderado en OKLab). Nada sale del navegador.
import { oklabToOklch, oklabToLinear, linearToRgb, rgbToHex, rgbToOklab, clamp } from './color.js';

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 192;

export function validateImageFile(file) {
    if (!file || !ACCEPTED_TYPES.includes(file.type)) return 'type';
    if (file.size > MAX_FILE_BYTES) return 'size';
    return null;
}

/** Decodifica el archivo y lo reduce a un máximo de MAX_SIDE px para analizarlo rápido. */
export async function loadImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const result = { width: w, height: h, data, source: bitmap };
    return result;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function samplePixels(image, bias) {
    const pts = [];
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue; // ignora transparencia
        const lab = rgbToOklab({ r: data[i], g: data[i + 1], b: data[i + 2] });
        const chroma = Math.hypot(lab.a, lab.b);
        pts.push({ l: lab.l, a: lab.a, b: lab.b, w: 1 + bias * 10 * chroma });
    }
    return pts;
}

const dist2 = (p, c) => (p.l - c.l) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;

/**
 * @param {{width:number,height:number,data:Uint8ClampedArray}} image
 * @param {number} k número de colores
 * @param {{seed?:number,bias?:number}} opts bias 0 = por frecuencia, 1 = favorece colores vivos
 */
export function extractPalette(image, k, { seed = 1, bias = 0 } = {}) {
    const pts = samplePixels(image, bias);
    if (!pts.length) return [];
    k = clamp(Math.round(k), 1, 16);
    const rand = mulberry32(seed);

    // k-means++ ponderado
    const centroids = [{ ...pts[Math.floor(rand() * pts.length)] }];
    while (centroids.length < Math.min(k, pts.length)) {
        const d = pts.map(p => Math.min(...centroids.map(c => dist2(p, c))) * p.w);
        const total = d.reduce((s, v) => s + v, 0);
        if (total === 0) break;
        let r = rand() * total, idx = 0;
        while (r > d[idx] && idx < d.length - 1) r -= d[idx++];
        centroids.push({ ...pts[idx] });
    }

    let assign = new Array(pts.length).fill(0);
    for (let iter = 0; iter < 14; iter++) {
        let moved = false;
        for (let i = 0; i < pts.length; i++) {
            let best = 0, bestD = Infinity;
            for (let c = 0; c < centroids.length; c++) {
                const d = dist2(pts[i], centroids[c]);
                if (d < bestD) {
                    bestD = d;
                    best = c;
                }
            }
            if (assign[i] !== best) {
                assign[i] = best;
                moved = true;
            }
        }
        const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, w: 0 }));
        pts.forEach((p, i) => {
            const s = sums[assign[i]];
            s.l += p.l * p.w; s.a += p.a * p.w; s.b += p.b * p.w; s.w += p.w;
        });
        sums.forEach((s, c) => {
            if (s.w > 0) centroids[c] = { l: s.l / s.w, a: s.a / s.w, b: s.b / s.w };
        });
        if (!moved) break;
    }

    const counts = centroids.map(() => 0);
    assign.forEach(c => counts[c]++);
    const colors = centroids
        .map((c, i) => {
            const hex = rgbToHex(linearToRgb(oklabToLinear(c).map(v => clamp(v, 0, 1))));
            return { hex, weight: counts[i] / pts.length, oklch: oklabToOklch(c) };
        })
        .filter(c => c.weight > 0)
        .sort((a, b) => b.weight - a.weight);

    // Elimina casi-duplicados fusionando su peso en el color mayoritario
    const merged = [];
    for (const c of colors) {
        const twin = merged.find(m => Math.hypot(m.oklch.l - c.oklch.l, (m.oklch.c - c.oklch.c)) < 0.015
            && Math.abs(m.oklch.h - c.oklch.h) < 4);
        if (twin) twin.weight += c.weight;
        else merged.push({ ...c });
    }
    return classify(merged);
}

// Dominante: los mayoritarios; acento: poco frecuente pero más vivo que la media; resto secundario.
function classify(colors) {
    if (!colors.length) return colors;
    const meanC = colors.reduce((s, c) => s + c.oklch.c, 0) / colors.length;
    const dominantCount = Math.max(1, Math.ceil(colors.length * 0.3));
    return colors.map((c, i) => {
        let role = 'secondary';
        if (i < dominantCount) role = 'dominant';
        else if (c.weight < 0.12 && c.oklch.c > meanC * 1.15) role = 'accent';
        return { ...c, role };
    });
}

