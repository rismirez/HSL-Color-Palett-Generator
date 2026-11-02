// Nombres aproximados de color: se busca el más cercano en OKLab dentro de una tabla
// curada; si ninguno está lo bastante cerca, se compone un nombre descriptivo.
import { hexToOklab } from './oklab-cache.js';
import { hexToOklch } from './color.js';

// [hex, inglés, español]
const NAMES = [
    ['#000000', 'Black', 'Negro'], ['#ffffff', 'White', 'Blanco'], ['#808080', 'Gray', 'Gris'],
    ['#c0c0c0', 'Silver', 'Plata'], ['#36454f', 'Charcoal', 'Carbón'], ['#2f4f4f', 'Slate', 'Pizarra'],
    ['#353839', 'Onyx', 'Ónix'], ['#dcdcdc', 'Gainsboro', 'Gris perla'], ['#f5f5f5', 'Smoke White', 'Blanco humo'],
    ['#696969', 'Dim Gray', 'Gris tenue'], ['#fffdd0', 'Cream', 'Crema'], ['#f5f5dc', 'Beige', 'Beige'],
    ['#800020', 'Burgundy', 'Borgoña'], ['#dc143c', 'Crimson', 'Carmesí'], ['#ff0000', 'Red', 'Rojo'],
    ['#8b0000', 'Dark Red', 'Rojo oscuro'], ['#ff6f61', 'Living Coral', 'Coral vivo'], ['#fa8072', 'Salmon', 'Salmón'],
    ['#e34234', 'Vermilion', 'Bermellón'], ['#b7410e', 'Rust', 'Óxido'], ['#ff7e5f', 'Coral Sunset', 'Atardecer coral'],
    ['#e2725b', 'Terracotta', 'Terracota'], ['#ffa500', 'Orange', 'Naranja'], ['#e9692c', 'Tangerine', 'Mandarina'],
    ['#cc5500', 'Burnt Orange', 'Naranja quemado'], ['#ffbf00', 'Amber', 'Ámbar'], ['#ffdb58', 'Mustard', 'Mostaza'],
    ['#ffff00', 'Yellow', 'Amarillo'], ['#fff44f', 'Lemon', 'Limón'], ['#f4c430', 'Saffron', 'Azafrán'],
    ['#f0e68c', 'Khaki', 'Caqui'], ['#daa520', 'Goldenrod', 'Vara de oro'], ['#d4af37', 'Gold', 'Oro'],
    ['#7fff00', 'Chartreuse', 'Chartreuse'], ['#00ff00', 'Lime', 'Lima'], ['#008000', 'Green', 'Verde'],
    ['#228b22', 'Forest Green', 'Verde bosque'], ['#355e3b', 'Hunter Green', 'Verde cazador'],
    ['#50c878', 'Emerald', 'Esmeralda'], ['#98fb98', 'Mint', 'Menta'], ['#9caf88', 'Sage', 'Salvia'],
    ['#808000', 'Olive', 'Oliva'], ['#556b2f', 'Moss', 'Musgo'], ['#2e8b57', 'Sea Green', 'Verde mar'],
    ['#008080', 'Teal', 'Verde azulado'], ['#1b8a8f', 'Ocean Teal', 'Verde océano'], ['#40e0d0', 'Turquoise', 'Turquesa'],
    ['#00ffff', 'Cyan', 'Cian'], ['#7fffd4', 'Aquamarine', 'Aguamarina'], ['#afeeee', 'Pale Aqua', 'Aqua pálido'],
    ['#0e7c7b', 'Deep Teal', 'Verde azulado profundo'], ['#0000ff', 'Blue', 'Azul'], ['#000080', 'Navy', 'Azul marino'],
    ['#191970', 'Midnight Blue', 'Azul medianoche'], ['#4169e1', 'Royal Blue', 'Azul real'],
    ['#1e90ff', 'Dodger Blue', 'Azul eléctrico'], ['#87ceeb', 'Sky Blue', 'Azul cielo'],
    ['#add8e6', 'Light Blue', 'Azul claro'], ['#4682b4', 'Steel Blue', 'Azul acero'], ['#0f52ba', 'Sapphire', 'Zafiro'],
    ['#6495ed', 'Cornflower', 'Aciano'], ['#003153', 'Prussian Blue', 'Azul de Prusia'],
    ['#8f00ff', 'Electric Violet', 'Violeta eléctrico'], ['#8a2be2', 'Blue Violet', 'Violeta azulado'],
    ['#4b0082', 'Indigo', 'Índigo'], ['#800080', 'Purple', 'Púrpura'], ['#9966cc', 'Amethyst', 'Amatista'],
    ['#301934', 'Dark Purple', 'Púrpura oscuro'], ['#e6e6fa', 'Lavender', 'Lavanda'],
    ['#c3b1e1', 'Soft Lavender', 'Lavanda suave'], ['#dda0dd', 'Plum', 'Ciruela'], ['#c8a2c8', 'Lilac', 'Lila'],
    ['#e0b0ff', 'Mauve', 'Malva'], ['#ee82ee', 'Violet', 'Violeta'], ['#ff00ff', 'Magenta', 'Magenta'],
    ['#c71585', 'Raspberry', 'Frambuesa'], ['#ff1493', 'Deep Pink', 'Rosa intenso'], ['#ff69b4', 'Hot Pink', 'Rosa fucsia'],
    ['#ffc0cb', 'Pink', 'Rosa'], ['#f4c2c2', 'Baby Pink', 'Rosa bebé'], ['#8b4513', 'Saddle Brown', 'Marrón cuero'],
    ['#a0522d', 'Sienna', 'Siena'], ['#d2b48c', 'Tan', 'Canela'], ['#deb887', 'Burlywood', 'Madera clara'],
    ['#654321', 'Dark Brown', 'Marrón oscuro'], ['#3e2723', 'Espresso', 'Espresso'], ['#c19a6b', 'Camel', 'Camello'],
    ['#f5deb3', 'Wheat', 'Trigo'], ['#d2691e', 'Chocolate', 'Chocolate'], ['#f4a460', 'Sandy Brown', 'Arena']
].map(([hex, en, es]) => ({ hex, en, es, lab: hexToOklab(hex) }));

const HUES = [
    [29, 'red', 'rojo'], [55, 'orange', 'naranja'], [100, 'yellow', 'amarillo'], [145, 'green', 'verde'],
    [185, 'teal', 'verde azulado'], [205, 'cyan', 'cian'], [260, 'blue', 'azul'], [305, 'purple', 'púrpura'],
    [350, 'pink', 'rosa'], [389, 'red', 'rojo']
];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function descriptiveName(hex, lang) {
    const { l, c, h } = hexToOklch(hex);
    if (c < 0.03) {
        if (l < 0.2) return lang === 'es' ? 'Negro' : 'Black';
        if (l > 0.95) return lang === 'es' ? 'Blanco' : 'White';
        const base = lang === 'es' ? 'Gris' : 'Gray';
        if (l < 0.4) return lang === 'es' ? `${base} oscuro` : `Dark ${base}`;
        if (l > 0.75) return lang === 'es' ? `${base} claro` : `Light ${base}`;
        return base;
    }
    const hue = HUES.reduce((best, cur) => (Math.abs(cur[0] - h) < Math.abs(best[0] - h) ? cur : best));
    const light = l < 0.28 ? ['very dark', 'muy oscuro'] : l < 0.45 ? ['dark', 'oscuro']
        : l > 0.9 ? ['very light', 'muy claro'] : l > 0.75 ? ['light', 'claro'] : null;
    const chroma = c < 0.07 ? ['muted', 'apagado'] : c > 0.2 ? ['vivid', 'intenso'] : null;
    if (lang === 'es') return cap([hue[2], light?.[1], chroma?.[1]].filter(Boolean).join(' '));
    return cap([light?.[0], chroma?.[0], hue[1]].filter(Boolean).join(' '));
}

/** Familia de tono en inglés minúscula ("blue", "red"…) o "gray" si apenas tiene croma. Útil para nombrar tokens. */
export function hueFamily(hex) {
    const { c, h } = hexToOklch(hex);
    if (c < 0.03) return 'gray';
    return HUES.reduce((best, cur) => (Math.abs(cur[0] - h) < Math.abs(best[0] - h) ? cur : best))[1];
}

/** Devuelve el nombre del color en el idioma indicado ('es' | 'en'). */
export function colorName(hex, lang = 'en') {
    const lab = hexToOklab(hex);
    let best = null, bestD = Infinity;
    for (const entry of NAMES) {
        const d = Math.hypot(lab.l - entry.lab.l, lab.a - entry.lab.a, lab.b - entry.lab.b);
        if (d < bestD) {
            bestD = d;
            best = entry;
        }
    }
    // Umbral ΔE(OKLab): por debajo se considera "el mismo color" que el de la tabla
    if (bestD < 0.06) return best[lang === 'es' ? 'es' : 'en'];
    return descriptiveName(hex, lang);
}
