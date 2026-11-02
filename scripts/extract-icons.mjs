// Genera src/ui/animated-icons-data.js a partir de @animateicons/react (MIT, https://animateicons.in).
//
// Uso:
//   npm pack @animateicons/react && mkdir pkg && tar -xzf animateicons-react-*.tgz -C pkg
//   node scripts/extract-icons.mjs pkg/package/dist
//
// Cada componente de la librería se ejecuta con simulaciones mínimas de React y de motion dentro de un contexto
// aislado de `vm` (sin acceso al sistema de ficheros, la red ni `require`). De ahí se leen el SVG y las variantes
// de movimiento, que se guardan como datos para animarlos con la Web Animations API, sin React ni motion.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DIST = path.resolve(process.argv[2] || 'pkg/package/dist');
const OUT = path.resolve('src/ui/animated-icons-data.js');

// Nombre usado en la app -> icono de Lucide en AnimateIcons
const WANT = {
    lock: 'lock', unlock: 'lock-open', copy: 'copy', edit: 'pencil', trash: 'trash-2', plus: 'plus', minus: 'minus',
    left: 'chevron-left', right: 'chevron-right', refresh: 'refresh-cw', dice: 'dice-5', download: 'download', upload: 'upload',
    share: 'share', check: 'check', chevron: 'chevron-down', image: 'image', eye: 'eye', close: 'x', dropper: 'pipette',
    layers: 'layers', access: 'accessibility', grid: 'layout-grid', flask: 'flask-conical', palette: 'palette', sparkle: 'sparkles',
    sliders: 'sliders-horizontal', monitor: 'monitor', swap: 'arrow-left-right', info: 'info', warn: 'triangle-alert',
    x: 'circle-x', ok: 'circle-check', globe: 'globe', contrast: 'contrast', code: 'code', help: 'circle-question-mark', heart: 'heart'
};
const SHARED_EXPORTS = { a: 'cn', b: 'LazyMotion', c: 'features', d: 'useReducedMotion', e: 'useAnimation', f: 'motion' };

const shims = {
    forwardRef: fn => fn, useCallback: fn => fn, useRef: v => ({ current: v }), useImperativeHandle() {}, useState: v => [v, () => {}],
    useEffect() {}, useMemo: fn => fn(), useId: () => 'id',
    cn: (...a) => a.filter(Boolean).join(' '), LazyMotion: 'LazyMotion', features: {}, useReducedMotion: () => false,
    useAnimation: () => ({ start() {}, stop() {}, __controls: true }),
    motion: new Proxy({}, { get: (_, tag) => `m:${String(tag)}` }),
    jsx: (type, props) => ({ type, props: props || {} }), jsxs: (type, props) => ({ type, props: props || {} })
};

function moduleSource(file) {
    const entry = fs.readFileSync(path.join(DIST, 'icons/lucide', `${file}-icon.js`), 'utf8');
    const m = entry.match(/import\{a\}from"\.\.\/\.\.\/(chunk-\w+\.js)"/);
    if (!m) throw new Error(`entrada inesperada para ${file}`);
    let code = fs.readFileSync(path.join(DIST, m[1]), 'utf8');
    const prelude = [];
    code = code.replace(/import\{([^}]*)\}from"([^"]+)";?/g, (_, list, mod) => {
        for (const part of list.split(',')) {
            const [orig, alias] = part.split(/\s+as\s+/).map(s => s.trim());
            const role = mod.includes('chunk-') ? SHARED_EXPORTS[orig] : orig;
            if (role) prelude.push(`const ${alias || orig} = __shims.${role};`);
        }
        return '';
    });
    code = code.replace(/export\{(\w+) as a\};?/, '__out = $1;');
    return `${prelude.join('\n')}\nlet __out;\n${code}\n__out;`;
}

const ATTR = {
    strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', fillRule: 'fill-rule',
    clipRule: 'clip-rule', strokeOpacity: 'stroke-opacity', fillOpacity: 'fill-opacity', strokeDasharray: 'stroke-dasharray',
    strokeDashoffset: 'stroke-dashoffset'
};
const SKIP = new Set(['children', 'variants', 'initial', 'animate', 'transition', 'custom', 'className', 'style', 'xmlns',
    'onMouseEnter', 'onMouseLeave', 'features', 'strict']);

// Las variantes pueden ser funciones (animate: i => ({...})); se evalúan con el valor `custom` del elemento.
function resolveVariant(variant, custom) {
    if (typeof variant === 'function') return variant(custom ?? 0);
    return variant;
}

function plan(variants, custom) {
    const animate = resolveVariant(variants?.animate, custom);
    if (!animate) return null;
    const { transition = {}, ...props } = animate;
    return { props, tr: transition };
}

function convert(node) {
    if (node == null || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(convert);
    const { type, props } = node;
    if (type === 'LazyMotion') return convert(props.children);
    const tag = String(type).replace(/^m:/, '');
    const attrs = {};
    for (const [k, v] of Object.entries(props)) {
        if (SKIP.has(k) || typeof v === 'function' || (v && typeof v === 'object')) continue;
        attrs[ATTR[k] || k] = v;
    }
    const out = { t: tag, a: attrs };
    const p = plan(props.variants, props.custom);
    if (p) out.p = p;
    const style = props.style;
    if (style && style.originX) out.o = [parseFloat(style.originX), parseFloat(style.originY)];
    const kids = convert(props.children);
    if (kids.length) out.k = kids;
    return [out];
}

const data = {};
const failed = [];
for (const [key, file] of Object.entries(WANT)) {
    try {
        const Comp = vm.runInContext(moduleSource(file), vm.createContext({ __shims: shims }), { timeout: 2000 });
        const [wrapper] = convert(Comp({}, { current: null }));
        const svg = wrapper.k.find(n => n.t === 'svg');
        data[key] = { r: svg.p || null, k: svg.k };
    } catch (e) {
        failed.push(`${key} (${file}): ${e.message}`);
    }
}
if (failed.length) {
    console.error('Fallaron:', failed);
    process.exit(1);
}

const header = `// Generado por scripts/extract-icons.mjs a partir de @animateicons/react (MIT, © Avijit Dey, https://animateicons.in).
// No editar a mano. t: etiqueta SVG, a: atributos, p: animación (props + transición), o: origen de transformación, k: hijos.
`;
fs.writeFileSync(OUT, `${header}export default ${JSON.stringify(data)};\n`);
console.log(`OK: ${Object.keys(data).length} iconos -> ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
