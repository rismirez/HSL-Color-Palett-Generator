// Iconos animados de AnimateIcons (https://animateicons.in, MIT) reproducidos con la Web Animations API.
// Los datos se generan con scripts/extract-icons.mjs; aquí sólo se construye el SVG y se anima al pasar el ratón
// o al enfocar con el teclado. Sin React ni librerías de animación.
import DATA from './animated-icons-data.js';

const NS = 'http://www.w3.org/2000/svg';
const EASING = { easeOut: 'ease-out', easeInOut: 'ease-in-out', easeIn: 'ease-in', linear: 'linear' };

// Iconos propios (mismo formato y estilo) para lo que el catálogo no incluye.
const CUSTOM = {
    // Rueda cromática: un anillo con un disco central y cuatro radios que giran un cuarto de vuelta
    wheel: {
        r: null,
        k: [
            { t: 'circle', a: { cx: 12, cy: 12, r: 9 } },
            {
                t: 'g', a: {}, o: [12, 12],
                p: { props: { rotate: [0, 90] }, tr: { duration: 0.7, ease: 'easeInOut' } },
                k: [{ t: 'circle', a: { cx: 12, cy: 12, r: 3 } }, { t: 'path', a: { d: 'M12 3v6M12 15v6M3 12h6M15 12h6' } }]
            }
        ]
    }
};

const plans = new WeakMap(); // svg -> [{ el, p }]

function build(node, out) {
    const el = document.createElementNS(NS, node.t);
    for (const [k, v] of Object.entries(node.a || {})) el.setAttribute(k, v);
    if (node.p) {
        // Origen de la transformación: el indicado por el icono o, por defecto, el centro del propio elemento
        el.style.transformBox = node.o ? 'view-box' : 'fill-box';
        el.style.transformOrigin = node.o ? `${node.o[0]}px ${node.o[1]}px` : 'center';
        out.push({ el, p: node.p });
    }
    for (const child of node.k || []) el.append(build(child, out));
    return el;
}

export function icon(name, size = 18) {
    const def = CUSTOM[name] || DATA[name];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('icon', 'aicon');
    if (!def) return svg;
    const list = [];
    if (def.r) list.push({ el: svg, p: def.r }); // el propio <svg> también puede moverse (p. ej. el candado)
    for (const child of def.k) svg.append(build(child, list));
    if (list.length) plans.set(svg, list);
    return svg;
}

// ---------- Reproducción ----------

const toArray = v => (Array.isArray(v) ? v : [v]);

// Una animación por grupo de propiedades; así cada una puede tener su propia duración, curva y tiempos.
function groupsOf(props) {
    const g = [];
    if ('x' in props || 'y' in props) {
        const xs = toArray(props.x ?? 0), ys = toArray(props.y ?? 0), n = Math.max(xs.length, ys.length);
        const at = (a, i) => a[Math.min(i, a.length - 1)];
        g.push({ key: 'x' in props ? 'x' : 'y', css: 'translate', values: Array.from({ length: n }, (_, i) => `${at(xs, i)}px ${at(ys, i)}px`) });
    }
    if ('rotate' in props) g.push({ key: 'rotate', css: 'rotate', values: toArray(props.rotate).map(v => `${v}deg`) });
    if ('scale' in props) g.push({ key: 'scale', css: 'scale', values: toArray(props.scale).map(String) });
    else if ('scaleX' in props || 'scaleY' in props) {
        const xs = toArray(props.scaleX ?? 1), ys = toArray(props.scaleY ?? 1), n = Math.max(xs.length, ys.length);
        const at = (a, i) => a[Math.min(i, a.length - 1)];
        g.push({ key: 'scaleX' in props ? 'scaleX' : 'scaleY', css: 'scale', values: Array.from({ length: n }, (_, i) => `${at(xs, i)} ${at(ys, i)}`) });
    }
    if ('opacity' in props) g.push({ key: 'opacity', css: 'opacity', values: toArray(props.opacity).map(String) });
    if ('strokeDashoffset' in props) g.push({ key: 'strokeDashoffset', css: 'strokeDashoffset', values: toArray(props.strokeDashoffset).map(String) });
    return g;
}

function animateElement(el, { props, tr }) {
    return groupsOf(props).map(({ key, css, values }) => {
        // Una transición puede declararse en general o por propiedad ({ opacity: { duration, ease } })
        const t = typeof tr[key] === 'object' ? tr[key] : tr;
        const times = t.times || tr.times;
        const frames = values.map((value, i) => {
            const frame = { [css]: value };
            if (times && times.length === values.length) frame.offset = times[i];
            return frame;
        });
        return el.animate(frames, {
            duration: (t.duration ?? tr.duration ?? 0.3) * 1000,
            delay: (t.delay ?? tr.delay ?? 0) * 1000,
            easing: EASING[t.ease ?? tr.ease] || 'ease-in-out'
        });
    });
}

export function playIcon(svg) {
    const list = plans.get(svg);
    if (!list || svg.__playing) return; // no se reinicia una animación en curso
    svg.__playing = true;
    const animations = list.flatMap(({ el, p }) => animateElement(el, p));
    Promise.allSettled(animations.map(a => a.finished)).then(() => { svg.__playing = false; });
}

const HOST = 'button, a, summary, label, [role="option"], [role="radio"]';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const playWithin = host => {
    if (host.matches?.('svg.aicon')) playIcon(host);
    else host.querySelectorAll('svg.aicon').forEach(playIcon);
};

/** Activa la animación de los iconos al pasar el ratón (o enfocar con teclado) sobre ellos o su botón. */
export function initIconAnimations() {
    let last = null;
    document.addEventListener('pointerover', e => {
        if (reducedMotion() || e.pointerType === 'touch') return;
        const host = e.target.closest?.(HOST) || e.target.closest?.('svg.aicon');
        if (!host || host === last) return;
        last = host;
        playWithin(host);
    }, { passive: true });
    document.addEventListener('pointerout', e => {
        if (last && !(e.relatedTarget && last.contains(e.relatedTarget))) last = null;
    }, { passive: true });
    document.addEventListener('focusin', e => {
        if (!reducedMotion() && e.target.matches?.(':focus-visible')) playWithin(e.target);
    });
}
