// Controles reutilizables: desplegable accesible, slider, segmentado e interruptor.
import { h, icon } from './dom.js';

let dropdownId = 0;

/**
 * Desplegable propio (los <select> nativos no se pueden estilizar).
 * options: [{ value, label }]. `label` puede ser una función para traducciones perezosas.
 */
export function dropdown({ options, value, onChange, iconName, ariaLabel, align = 'left', className = '' }) {
    const id = `dd-${++dropdownId}`;
    let current = value;
    let items = options;
    let activeIndex = 0;

    const labelOf = o => (typeof o.label === 'function' ? o.label() : o.label);
    const valueEl = h('span', { class: 'dropdown__value' });
    const button = h('button', {
        type: 'button', class: 'dropdown__button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
        'aria-controls': id, 'aria-label': ariaLabel
    }, iconName && h('span', { class: 'dropdown__icon' }, icon(iconName)), valueEl,
    h('span', { class: 'dropdown__chevron' }, icon('chevron')));
    const menu = h('ul', {
        id, class: `dropdown__menu dropdown__menu--${align}`, role: 'listbox', tabindex: '-1', hidden: true, 'aria-label': ariaLabel
    });
    const root = h('div', { class: `dropdown ${className}` }, button, menu);

    const optionEls = () => Array.from(menu.children);

    function renderOptions() {
        menu.replaceChildren(...items.map(o => {
            const li = h('li', { class: 'dropdown__option', role: 'option', dataset: { value: o.value } },
                h('span', { class: 'dropdown__check' }, icon('check', 14)), h('span', { class: 'dropdown__text' }, labelOf(o)));
            li.addEventListener('click', () => {
                select(o.value);
                close(true);
            });
            li.addEventListener('mousemove', () => setActive(optionEls().indexOf(li)));
            return li;
        }));
        refresh();
    }

    function refresh() {
        const selected = items.find(o => String(o.value) === String(current)) || items[0];
        valueEl.textContent = selected ? labelOf(selected) : '';
        optionEls().forEach((li, i) => {
            // Las etiquetas pueden ser funciones de traducción: se reevalúan al cambiar de idioma
            if (items[i]) li.querySelector('.dropdown__text').textContent = labelOf(items[i]);
            const on = li.dataset.value === String(current);
            li.setAttribute('aria-selected', on);
            li.classList.toggle('dropdown__option--selected', on);
        });
    }

    function setActive(index) {
        const els = optionEls();
        if (!els.length) return;
        activeIndex = (index + els.length) % els.length;
        els.forEach((li, i) => li.classList.toggle('dropdown__option--active', i === activeIndex));
        els[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function open() {
        document.dispatchEvent(new CustomEvent('dropdown:open', { detail: root }));
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        setActive(items.findIndex(o => String(o.value) === String(current)));
        menu.focus({ preventScroll: true });
    }

    function close(returnFocus) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (returnFocus) button.focus();
    }

    function select(v) {
        const changed = String(v) !== String(current);
        current = v;
        refresh();
        if (changed) onChange?.(v);
    }

    button.addEventListener('click', () => (menu.hidden ? open() : close(false)));
    button.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            open();
        }
    });
    menu.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
        else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
        else if (e.key === 'End') { e.preventDefault(); setActive(items.length - 1); }
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(items[activeIndex].value);
            close(true);
        } else if (e.key === 'Escape') { e.preventDefault(); close(true); }
        else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('click', e => { if (!root.contains(e.target)) close(false); });
    document.addEventListener('dropdown:open', e => { if (e.detail !== root) close(false); });

    renderOptions();
    return {
        el: root,
        setValue(v) { current = v; refresh(); },
        setOptions(next) { items = next; renderOptions(); },
        setAriaLabel(text) {
            button.setAttribute('aria-label', text);
            menu.setAttribute('aria-label', text);
        },
        refresh,
        get value() { return current; }
    };
}

let sliderId = 0;

/** Slider con etiqueta, valor y relleno de progreso. */
export function slider({ label, min, max, step = 1, value, format = v => v, onInput, hint }) {
    const id = `sl-${++sliderId}`;
    const input = h('input', { id, type: 'range', min, max, step, value, class: 'slider__input' });
    const valueEl = h('output', { class: 'slider__value', for: id });
    const labelEl = h('label', { for: id, class: 'slider__label' });
    const root = h('div', { class: 'slider' },
        h('div', { class: 'slider__head' }, labelEl, valueEl), input, hint && h('small', { class: 'slider__hint' }, hint));

    function paint() {
        const pct = ((input.value - min) / (max - min)) * 100;
        input.style.setProperty('--fill', `${pct}%`);
        valueEl.textContent = format(+input.value);
    }
    input.addEventListener('input', () => {
        paint();
        onInput?.(+input.value);
    });
    const api = {
        el: root,
        setValue(v) { input.value = v; paint(); },
        setLabel(text) { labelEl.textContent = text; },
        get value() { return +input.value; }
    };
    labelEl.textContent = typeof label === 'function' ? label() : label;
    paint();
    return api;
}

/** Control segmentado (radiogroup). options: [{ value, label }] */
export function segmented({ options, value, onChange, ariaLabel }) {
    let current = value;
    const buttons = options.map(o => {
        const b = h('button', { type: 'button', class: 'segmented__btn', role: 'radio', dataset: { value: o.value } });
        b.addEventListener('click', () => {
            current = o.value;
            paint();
            onChange?.(o.value);
        });
        return b;
    });
    const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': ariaLabel }, buttons);
    const labelOf = o => (typeof o.label === 'function' ? o.label() : o.label);
    function paint() {
        buttons.forEach((b, i) => {
            b.textContent = labelOf(options[i]);
            const on = String(options[i].value) === String(current);
            b.setAttribute('aria-checked', on);
            b.classList.toggle('segmented__btn--on', on);
        });
    }
    paint();
    return { el: root, setValue(v) { current = v; paint(); }, refresh: paint, get value() { return current; } };
}

/** Interruptor con texto. */
export function toggle({ label, checked = false, onChange }) {
    const input = h('input', { type: 'checkbox', class: 'toggle__input', checked });
    const text = h('span', { class: 'toggle__text' }, typeof label === 'function' ? label() : label);
    const root = h('label', { class: 'toggle' }, input, h('span', { class: 'toggle__track' }), text);
    input.addEventListener('change', () => onChange?.(input.checked));
    return {
        el: root,
        setChecked(v) { input.checked = v; },
        setLabel(s) { text.textContent = s; },
        get checked() { return input.checked; }
    };
}

/** Botón con icono y texto (el texto puede ser una función para traducirse al cambiar de idioma). */
export function button({ label, iconName, onClick, variant = 'outline', title, className = '' }) {
    const text = h('span', { class: 'btn__text' });
    const el = h('button', { type: 'button', class: `btn btn--${variant} ${className}`, title }, iconName && icon(iconName, 16), text);
    const refresh = () => { if (label) text.textContent = typeof label === 'function' ? label() : label; };
    el.addEventListener('click', onClick);
    refresh();
    return { el, refresh, setLabel(l) { label = l; refresh(); } };
}
