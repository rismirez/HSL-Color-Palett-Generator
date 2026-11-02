// Utilidades de DOM. Nunca se usa innerHTML con datos del usuario: el texto va siempre por textContent.

export function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value == null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key === 'style' && typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                if (k.startsWith('--')) el.style.setProperty(k, v);
                else el.style[k] = v;
            }
        } else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
        else if (key in el && key !== 'list' && key !== 'type') el[key] = value;
        else el.setAttribute(key, value === true ? '' : value);
    }
    append(el, children);
    return el;
}

export function append(el, children) {
    for (const child of children.flat(Infinity)) {
        if (child == null || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
}

export const clear = el => {
    el.replaceChildren();
    return el;
};

// Los iconos animados viven en icons.js; se reexportan aquí para no cambiar las importaciones existentes.
export { icon } from './icons.js';

let toastTimer = null;

export function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hide');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('hide');
    }, 2600);
}

export const debounce = (fn, ms = 120) => {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
};

// Ejecuta `fn` como mucho una vez por fotograma (para arrastres continuos).
export const rafThrottle = fn => {
    let pending = false, last;
    return (...args) => {
        last = args;
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            fn(...last);
        });
    };
};
