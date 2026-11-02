// Selector de color completo (HSV visual + campos HEX/RGB/HSL/HSV/OKLCH/CMYK sincronizados) y popover.
import { clamp, formatColor, hexToHsv, hsvToRgb, normalizeHex, parseColor, rgbToHex } from '../core/color.js';
import { t } from '../i18n/index.js';
import { h, icon, rafThrottle } from './dom.js';

const FIELDS = ['hex', 'rgb', 'hsl', 'hsv', 'oklch', 'cmyk'];

export function colorEditor({ value, onChange }) {
    let hsv = hexToHsv(value);
    let hex = normalizeHex(value);

    const thumb = h('div', { class: 'cp__thumb' });
    const sv = h('div', { class: 'cp__sv', tabindex: '0', role: 'application', 'aria-label': t('picker.area') }, thumb);
    const hue = h('input', { type: 'range', min: 0, max: 359, step: 1, class: 'cp__hue', 'aria-label': t('picker.hue') });
    const inputs = {};
    const rows = FIELDS.map(f => {
        const input = h('input', { type: 'text', class: 'cp__input', spellcheck: false, autocomplete: 'off', 'aria-label': f.toUpperCase() });
        inputs[f] = input;
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') input.blur();
        });
        input.addEventListener('change', () => {
            const parsed = parseColor(input.value);
            if (parsed) {
                input.classList.remove('cp__input--bad');
                setFromHex(parsed, true);
            } else {
                input.classList.add('cp__input--bad');
            }
        });
        input.addEventListener('blur', () => {
            if (input.classList.contains('cp__input--bad')) {
                input.classList.remove('cp__input--bad');
                paintFields();
            }
        });
        return h('label', { class: 'cp__row' }, h('span', { class: 'cp__label' }, f.toUpperCase()), input);
    });

    const dropper = window.EyeDropper
        ? h('button', {
            type: 'button', class: 'btn btn--outline btn--icon', title: t('picker.dropper'), 'aria-label': t('picker.dropper'),
            onclick: async () => {
                try {
                    const result = await new window.EyeDropper().open();
                    setFromHex(result.sRGBHex, true);
                } catch { /* cancelado */ }
            }
        }, icon('dropper', 16))
        : null;

    const root = h('div', { class: 'cp' }, sv, h('div', { class: 'cp__hue-row' }, hue, dropper), h('div', { class: 'cp__fields' }, rows));

    function paintArea() {
        sv.style.setProperty('--hue', `hsl(${hsv.h}, 100%, 50%)`);
        thumb.style.left = `${hsv.s}%`;
        thumb.style.top = `${100 - hsv.v}%`;
        thumb.style.background = hex;
        hue.value = hsv.h;
    }

    function paintFields() {
        for (const f of FIELDS) {
            if (document.activeElement !== inputs[f]) inputs[f].value = formatColor(hex, f);
        }
    }

    function commit(emit) {
        hex = rgbToHex(hsvToRgb(hsv));
        paintArea();
        paintFields();
        if (emit) onChange?.(hex);
    }

    function setFromHex(next, emit) {
        const prev = hsv;
        const parsed = hexToHsv(next);
        // En grises o negros el tono no está definido: se conserva el anterior para que el slider no salte
        hsv = {
            h: parsed.s < 1 || parsed.v < 1 ? prev.h : parsed.h,
            s: parsed.v < 1 ? prev.s : parsed.s,
            v: parsed.v
        };
        hex = normalizeHex(next);
        paintArea();
        paintFields();
        if (emit) onChange?.(hex);
    }

    const move = rafThrottle(e => {
        const r = sv.getBoundingClientRect();
        hsv = { ...hsv, s: clamp(((e.clientX - r.left) / r.width) * 100, 0, 100), v: clamp(100 - ((e.clientY - r.top) / r.height) * 100, 0, 100) };
        commit(true);
    });
    sv.addEventListener('pointerdown', e => {
        sv.setPointerCapture(e.pointerId);
        move(e);
        const up = () => {
            sv.removeEventListener('pointermove', move);
            sv.removeEventListener('pointerup', up);
        };
        sv.addEventListener('pointermove', move);
        sv.addEventListener('pointerup', up);
    });
    sv.addEventListener('keydown', e => {
        const d = e.shiftKey ? 10 : 2;
        const keys = {
            ArrowLeft: { s: -d }, ArrowRight: { s: d }, ArrowUp: { v: d }, ArrowDown: { v: -d }
        };
        const delta = keys[e.key];
        if (!delta) return;
        e.preventDefault();
        hsv = { ...hsv, s: clamp(hsv.s + (delta.s || 0), 0, 100), v: clamp(hsv.v + (delta.v || 0), 0, 100) };
        commit(true);
    });
    hue.addEventListener('input', () => {
        hsv = { ...hsv, h: +hue.value };
        commit(true);
    });

    paintArea();
    paintFields();
    return {
        el: root,
        setValue(v) {
            const n = normalizeHex(v);
            if (n && n !== hex) setFromHex(n, false);
        },
        get value() { return hex; }
    };
}

// ---------- Popover ----------

let openPopover = null;

export function closePopover() {
    if (!openPopover) return;
    openPopover.el.remove();
    document.removeEventListener('pointerdown', openPopover.outside, true);
    document.removeEventListener('keydown', openPopover.key, true);
    window.removeEventListener('resize', openPopover.reposition);
    const { anchor, onClose } = openPopover;
    openPopover = null;
    onClose?.();
    anchor?.focus?.({ preventScroll: true });
}

export function showPopover(anchor, content, { onClose, label } = {}) {
    closePopover();
    const el = h('div', { class: 'popover', role: 'dialog', 'aria-label': label }, content);
    document.body.append(el);

    const reposition = () => {
        const a = anchor.getBoundingClientRect();
        const w = el.offsetWidth, hgt = el.offsetHeight;
        let left = clamp(a.left, 8, window.innerWidth - w - 8);
        let top = a.bottom + 8;
        if (top + hgt > window.innerHeight - 8) top = Math.max(8, a.top - hgt - 8);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    };
    const outside = e => {
        if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
    };
    const key = e => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closePopover();
        }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', reposition);
    openPopover = { el, anchor, outside, key, reposition, onClose };
    reposition();
    return el;
}

/** Campo de color: muestra + texto; al pulsar la muestra se abre el selector completo. */
export function colorField({ value, onChange, ariaLabel }) {
    let current = normalizeHex(value);
    let editor = null;
    const swatch = h('button', { type: 'button', class: 'cf__swatch', 'aria-label': ariaLabel || t('picker.open') });
    const input = h('input', { type: 'text', class: 'cf__input', spellcheck: false, 'aria-label': ariaLabel, maxlength: 40 });
    const root = h('div', { class: 'cf' }, swatch, input);

    function paint() {
        swatch.style.background = current;
        if (document.activeElement !== input) input.value = current;
    }
    function set(v, emit) {
        const n = normalizeHex(v);
        if (!n) return;
        current = n;
        paint();
        editor?.setValue(n);
        if (emit) onChange?.(n);
    }
    swatch.addEventListener('click', () => {
        editor = colorEditor({ value: current, onChange: v => set(v, true) });
        showPopover(swatch, editor.el, { onClose: () => { editor = null; }, label: ariaLabel });
    });
    input.addEventListener('change', () => {
        const parsed = parseColor(input.value);
        if (parsed) set(parsed, true);
        else input.value = current;
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    input.addEventListener('blur', paint);
    paint();
    return { el: root, setValue: v => set(v, false), get value() { return current; } };
}
