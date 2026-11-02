// Filtros SVG de daltonismo (matrices de Machado et al. aplicadas en RGB lineal) reutilizables vía CSS `filter: url(#…)`.
import { CVD_MATRICES, CVD_TYPES } from '../core/contrast.js';

const NS = 'http://www.w3.org/2000/svg';
let ready = false;

export function ensureCvdFilters() {
    if (ready) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    const defs = document.createElementNS(NS, 'defs');
    for (const type of CVD_TYPES) {
        const filter = document.createElementNS(NS, 'filter');
        filter.setAttribute('id', `cvd-${type}`);
        filter.setAttribute('color-interpolation-filters', 'linearRGB');
        const matrix = document.createElementNS(NS, 'feColorMatrix');
        matrix.setAttribute('type', 'matrix');
        const m = CVD_MATRICES[type];
        matrix.setAttribute('values', [...m[0], 0, 0, ...m[1], 0, 0, ...m[2], 0, 0, 0, 0, 0, 1, 0].join(' '));
        filter.append(matrix);
        defs.append(filter);
    }
    svg.append(defs);
    document.body.append(svg);
    ready = true;
}

export const cvdFilter = type => (type && type !== 'none' ? `url(#cvd-${type})` : 'none');
