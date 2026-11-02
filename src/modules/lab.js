// Color Lab: mezclador, estudio de degradados, comparador de paletas y simulador de daltonismo en composiciones.
import { clamp, mixColors, normalizeHex, SPACES } from '../core/color.js';
import { autoRoles } from '../core/roles.js';
import { CVD_TYPES } from '../core/contrast.js';
import { copyText, downloadFile } from '../core/export.js';
import { generatePalette } from '../core/harmony.js';
import { colorName } from '../core/names.js';
import { paletteStats, parseHexList } from '../core/stats.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { getState, setPalette, setState, subscribe } from '../core/store.js';
import { button, dropdown, segmented, slider } from '../ui/controls.js';
import { colorField } from '../ui/color-editor.js';
import { cvdFilter, ensureCvdFilters } from '../ui/cvd-filters.js';
import { h, icon, toast } from '../ui/dom.js';
import { TEMPLATE_IDS, buildTemplate } from '../ui/templates.js';
import { readableOn } from '../core/contrast.js';

const TABS = ['mixer', 'gradient', 'comparator', 'blindness'];

async function copy(text) {
    toast((await copyText(text)) ? t('toast.copied') : t('toast.copyFailed'));
}

const strip = (colors, extra = '') => h('div', { class: `lstrip ${extra}` }, colors.map(c =>
    h('button', {
        type: 'button', class: 'lstrip__seg', style: { background: c, color: readableOn(c) }, title: c, 'aria-label': `${t('gen.copy')} ${c}`,
        onclick: () => copy(c)
    }, h('span', null, c.slice(1).toUpperCase()))));

// ======================= Mixer =======================

function mixerView() {
    const p = getState().palette;
    let a = p[0], b = p[1] || p[0];
    let space = 'oklch';
    let steps = 7;
    let amount = 50;
    const out = h('div', { class: 'mixer' });
    const result = h('div', { class: 'mix-result' });

    function render() {
        const list = Array.from({ length: steps }, (_, i) => mixColors(a, b, i / (steps - 1), space));
        const mid = mixColors(a, b, amount / 100, space);
        result.replaceChildren(
            h('div', { class: 'mix-result__sw', style: { background: mid, color: readableOn(mid) } },
                h('strong', null, mid.toUpperCase()), h('span', null, colorName(mid, getLang()))),
            button({ label: () => t('gen.copy'), iconName: 'copy', onClick: () => copy(mid) }).el);
        out.replaceChildren(
            h('div', { class: 'mix-row' }, h('span', { class: 'mix-row__label' }, `${t('lab.steps')}`), strip(list)),
            h('h4', { class: 'subtitle' }, t('lab.allSpaces')),
            ...SPACES.map(s => h('div', { class: `mix-row ${s === space ? 'mix-row--on' : ''}` },
                h('span', { class: 'mix-row__label' }, s.toUpperCase()), strip(Array.from({ length: steps }, (_, i) => mixColors(a, b, i / (steps - 1), s)), 'lstrip--thin'))));
        return list;
    }

    const fa = colorField({ value: a, ariaLabel: t('lab.colorA'), onChange: v => { a = v; render(); } });
    const fb = colorField({ value: b, ariaLabel: t('lab.colorB'), onChange: v => { b = v; render(); } });
    const swap = h('button', { type: 'button', class: 'btn btn--icon', title: t('acc.swap'), 'aria-label': t('acc.swap'), onclick: () => { [a, b] = [b, a]; fa.setValue(a); fb.setValue(b); render(); } }, icon('swap', 16));
    const spaceDd = dropdown({ options: SPACES.map(s => ({ value: s, label: s.toUpperCase() })), value: space, ariaLabel: t('lab.space'), onChange: v => { space = v; render(); } });
    const stepsSl = slider({ label: () => t('lab.steps'), min: 3, max: 15, value: steps, onInput: v => { steps = v; render(); } });
    const amountSl = slider({ label: () => t('lab.amount'), min: 0, max: 100, value: amount, format: v => `${v}%`, onInput: v => { amount = v; render(); } });
    const send = button({
        label: () => t('lab.sendMix'), iconName: 'palette', variant: 'primary',
        onClick: () => {
            const list = Array.from({ length: steps }, (_, i) => mixColors(a, b, i / (steps - 1), space)).slice(0, 16);
            setPalette(list);
            setState({ module: 'generator' }, 'module');
            toast(t('ext.sent'));
        }
    });
    const el = h('div', { class: 'lab-grid' },
        h('div', { class: 'card' }, h('h3', { class: 'card__title' }, t('lab.mixer')), h('p', { class: 'card__lead' }, t('lab.mixerLead')),
            h('div', { class: 'toolbar__row' }, h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'A'), fa.el), swap, h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'B'), fb.el)),
            h('div', { class: 'toolbar__row' }, spaceDd.el), stepsSl.el, amountSl.el, result, send.el),
        h('div', { class: 'card' }, out));
    render();
    return { el };
}

// ======================= Gradient Studio =======================

const GRADIENT_SPACES = ['srgb', 'oklch', 'oklab', 'hsl', 'lab'];

function gradientView() {
    let type = 'linear';
    let angle = 90;
    let shape = 'circle';
    let interp = 'srgb';
    let cx = 50, cy = 50;
    const pal = getState().palette;
    let stops = pal.slice(0, 3).map((hex, i, arr) => ({ hex, pos: Math.round((i / Math.max(arr.length - 1, 1)) * 100), mid: 50 }));
    if (stops.length < 2) stops = [{ hex: pal[0], pos: 0, mid: 50 }, { hex: '#ffffff', pos: 100, mid: 50 }];

    const prev = h('div', { class: 'grad-prev', role: 'img', 'aria-label': t('lab.gradPreview') });
    const code = h('pre', { class: 'code' });
    const list = h('div', { class: 'stops' });
    const note = h('p', { class: 'hint' });

    function css(withSpace = true) {
        const sorted = stops.slice().sort((x, y) => x.pos - y.pos);
        const parts = [];
        sorted.forEach((s, i) => {
            if (i > 0) {
                // Punto de transición entre dos paradas (hint de CSS) como % absoluto entre ambas
                const prevStop = sorted[i - 1];
                const hint = Math.round(prevStop.pos + ((s.pos - prevStop.pos) * (prevStop.mid ?? 50)) / 100);
                if (prevStop.mid !== 50 && hint > prevStop.pos && hint < s.pos) parts.push(`${hint}%`);
            }
            parts.push(`${s.hex} ${s.pos}%`);
        });
        const space = withSpace && interp !== 'srgb' ? `in ${interp} ` : '';
        let head;
        if (type === 'linear') head = `${space}${angle}deg`;
        else if (type === 'radial') head = `${space}${shape} at ${cx}% ${cy}%`;
        else head = `${space}from ${angle}deg at ${cx}% ${cy}%`;
        return `${type}-gradient(${head}, ${parts.join(', ')})`;
    }

    function render() {
        let value = css(true);
        let supported = true;
        if (interp !== 'srgb' && window.CSS?.supports && !CSS.supports('background-image', value)) {
            value = css(false);
            supported = false;
        }
        prev.style.backgroundImage = value;
        note.textContent = supported ? '' : t('lab.noInterp');
        code.textContent = `background: ${css(false)};\n${interp !== 'srgb' ? `/* ${t('lab.modern')} */\nbackground: ${css(true)};\n` : ''}`;
    }

    function renderStops() {
        const sorted = stops;
        list.replaceChildren(...sorted.map((s, i) => {
            const field = colorField({ value: s.hex, ariaLabel: `${t('lab.stop')} ${i + 1}`, onChange: v => { s.hex = v; render(); } });
            const pos = slider({ label: () => t('lab.position'), min: 0, max: 100, value: s.pos, format: v => `${v}%`, onInput: v => { s.pos = v; render(); } });
            const mid = i < sorted.length - 1 && slider({ label: () => t('lab.midpoint'), min: 10, max: 90, value: s.mid ?? 50, format: v => `${v}%`, onInput: v => { s.mid = v; render(); } });
            return h('div', { class: 'stop' },
                h('div', { class: 'stop__head' }, h('strong', null, `${t('lab.stop')} ${i + 1}`),
                    h('button', {
                        type: 'button', class: 'btn btn--ghost btn--icon', title: t('gen.remove'), 'aria-label': t('gen.remove'),
                        onclick: () => {
                            if (stops.length <= 2) return toast(t('lab.minStops'));
                            stops.splice(i, 1);
                            renderStops();
                            render();
                        }
                    }, icon('trash', 16))),
                field.el, pos.el, mid ? mid.el : null);
        }));
    }

    const typeSeg = segmented({
        ariaLabel: t('lab.gradType'), value: type,
        options: ['linear', 'radial', 'conic'].map(v => ({ value: v, label: () => t(`lab.grad.${v}`) })),
        onChange: v => { type = v; syncControls(); render(); }
    });
    const angleSl = slider({ label: () => t('lab.angle'), min: 0, max: 360, value: angle, format: v => `${v}°`, onInput: v => { angle = v; render(); } });
    const shapeSeg = segmented({
        ariaLabel: t('lab.shape'), value: shape,
        options: ['circle', 'ellipse'].map(v => ({ value: v, label: () => t(`lab.shape.${v}`) })), onChange: v => { shape = v; render(); }
    });
    const cxSl = slider({ label: () => t('lab.centerX'), min: 0, max: 100, value: cx, format: v => `${v}%`, onInput: v => { cx = v; render(); } });
    const cySl = slider({ label: () => t('lab.centerY'), min: 0, max: 100, value: cy, format: v => `${v}%`, onInput: v => { cy = v; render(); } });
    const interpDd = dropdown({
        options: GRADIENT_SPACES.map(s => ({ value: s, label: s === 'srgb' ? 'sRGB' : s.toUpperCase() })), value: interp, ariaLabel: t('lab.interp'),
        onChange: v => { interp = v; render(); }
    });
    const angleWrap = h('div', null, angleSl.el);
    const shapeWrap = h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('lab.shape')), shapeSeg.el);
    const centerWrap = h('div', { class: 'stack' }, cxSl.el, cySl.el);

    function syncControls() {
        angleWrap.hidden = type === 'radial';
        shapeWrap.hidden = type !== 'radial';
        centerWrap.hidden = type === 'linear';
    }

    const add = button({
        label: () => t('lab.addStop'), iconName: 'plus',
        onClick: () => {
            if (stops.length >= 8) return toast(t('lab.maxStops'));
            const sorted = stops.slice().sort((x, y) => x.pos - y.pos);
            const last = sorted[sorted.length - 1];
            stops.push({ hex: getState().palette[stops.length % getState().palette.length], pos: clamp(Math.round((last.pos + sorted[sorted.length - 2].pos) / 2), 0, 100), mid: 50 });
            renderStops();
            render();
        }
    });
    const fromPalette = button({
        label: () => t('lab.fromPalette'), iconName: 'palette',
        onClick: () => {
            const p2 = getState().palette.slice(0, 8);
            stops = p2.map((hex, i) => ({ hex, pos: Math.round((i / Math.max(p2.length - 1, 1)) * 100), mid: 50 }));
            if (stops.length < 2) stops.push({ hex: '#ffffff', pos: 100, mid: 50 });
            renderStops();
            render();
        }
    });
    const copyBtn = button({ label: () => t('gen.copyCode'), iconName: 'copy', onClick: () => copy(code.textContent) });
    const dl = button({ label: () => t('gen.downloadScale'), iconName: 'download', onClick: () => downloadFile('gradient.css', `.gradient {\n  ${code.textContent.split('\n').join('\n  ')}\n}\n`, 'text/css') });

    const el = h('div', { class: 'lab-grid' },
        h('div', { class: 'card' }, h('h3', { class: 'card__title' }, t('lab.gradient')), h('p', { class: 'card__lead' }, t('lab.gradientLead')),
            typeSeg.el, angleWrap, shapeWrap, centerWrap, h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('lab.interp')), interpDd.el),
            h('div', { class: 'toolbar__row' }, add.el, fromPalette.el), list),
        h('div', { class: 'card grad-card' }, prev, note, code, h('div', { class: 'btnrow' }, copyBtn.el, dl.el)));
    syncControls();
    renderStops();
    render();
    return { el, refresh: () => {} };
}

// ======================= Comparador =======================

function comparatorView() {
    let items = []; // { id, name, colors, live }
    let nextId = 1;
    const out = h('div', { class: 'cmp' });
    const input = h('textarea', { class: 'text-input', rows: 2, placeholder: '#8a42fb, #42d0fb, #ffd166', 'aria-label': t('lab.pasteHex') });

    function ensureLive() {
        const live = items.find(i => i.live);
        if (live) live.colors = getState().palette;
        else items.unshift({ id: nextId++, name: t('lab.current'), colors: getState().palette, live: true });
    }

    const fmtTemp = v => (v > 0.15 ? t('lab.warm') : v < -0.15 ? t('lab.cool') : t('lab.neutralT'));
    const rows = [
        ['lab.stat.colors', s => s.count],
        ['lab.stat.temperature', s => `${fmtTemp(s.temperature)} (${s.temperature.toFixed(2)})`],
        ['lab.stat.saturation', s => `${s.saturation.toFixed(0)}%`],
        ['lab.stat.lightness', s => `${s.lightness.toFixed(0)}%`],
        ['lab.stat.hueSpread', s => `${s.hueSpread.toFixed(0)}°`],
        ['lab.stat.harmony', s => t(`harmony.${s.harmony}`)],
        ['lab.stat.contrast', s => `${s.minContrast.toFixed(1)} – ${s.maxContrast.toFixed(1)} (Ø ${s.avgContrast.toFixed(1)})`]
    ];

    function render() {
        ensureLive();
        const stats = items.map(i => paletteStats(i.colors));
        const maxBin = Math.max(1, ...stats.flatMap(s => s.hueBins));
        out.replaceChildren(
            h('div', { class: 'cmp-cards', style: { '--n': items.length } }, items.map((it, i) => h('div', { class: 'cmp-card' },
                h('div', { class: 'cmp-card__head' }, h('strong', null, it.name),
                    h('div', { class: 'cmp-card__acts' },
                        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', title: t('lab.useInGenerator'), onclick: () => { setPalette(it.colors.slice(0, 16)); setState({ module: 'generator' }, 'module'); } }, icon('palette', 14), t('lab.use')),
                        !it.live && h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: t('gen.remove'), 'aria-label': t('gen.remove'), onclick: () => { items = items.filter(x => x !== it); render(); } }, icon('trash', 16)))),
                strip(it.colors),
                h('div', { class: 'hist', role: 'img', 'aria-label': t('lab.hueDist') }, stats[i].hueBins.map((n, b) => h('span', {
                    class: 'hist__bar', style: { height: `${(n / maxBin) * 100}%`, background: `hsl(${b * 30 + 15} 80% 55%)` }, title: `${b * 30}°–${b * 30 + 30}°: ${n}`
                }))))),
            ),
            h('table', { class: 'cmp-table' },
                h('thead', null, h('tr', null, h('th', null), items.map(it => h('th', { scope: 'col' }, it.name)))),
                h('tbody', null, rows.map(([key, fn]) => h('tr', null, h('th', { scope: 'row' }, t(key)), stats.map(s => h('td', null, fn(s))))))));
    }

    const addRandom = button({
        label: () => t('lab.addRandom'), iconName: 'dice',
        onClick: () => {
            const harmonies = ['analogous', 'complementary', 'triadic', 'split', 'monochromatic'];
            const hm = harmonies[Math.floor(Math.random() * harmonies.length)];
            items.push({ id: nextId++, name: `${t('lab.random')} ${items.length}`, colors: generatePalette({ count: getState().palette.length, params: { harmony: hm } }), live: false });
            render();
        }
    });
    const addSnapshot = button({
        label: () => t('lab.snapshot'), iconName: 'copy',
        onClick: () => { items.push({ id: nextId++, name: `${t('lab.saved')} ${items.length}`, colors: getState().palette.slice(), live: false }); render(); }
    });
    const addText = button({
        label: () => t('lab.addHex'), iconName: 'plus',
        onClick: () => {
            const colors = parseHexList(input.value, normalizeHex);
            if (colors.length < 2) return toast(t('lab.needTwo'));
            items.push({ id: nextId++, name: `${t('lab.custom')} ${items.length}`, colors, live: false });
            input.value = '';
            render();
        }
    });
    const el = h('div', { class: 'card' }, h('h3', { class: 'card__title' }, t('lab.comparator')), h('p', { class: 'card__lead' }, t('lab.comparatorLead')),
        h('div', { class: 'toolbar__row' }, addRandom.el, addSnapshot.el), h('div', { class: 'cmp-add' }, input, addText.el), out);
    render();
    return { el, refresh: render };
}

// ======================= Simulador en composiciones =======================

function blindnessView() {
    let tplId = 'dashboard';
    let source = 'template';
    let mode = 'light';
    let imageUrl = null;
    const grid = h('div', { class: 'bl-grid' });

    function render() {
        ensureCvdFilters();
        const roles = autoRoles(getState().palette, mode);
        const kinds = ['none', ...CVD_TYPES];
        grid.replaceChildren(...kinds.map(kind => {
            const content = source === 'image' && imageUrl
                ? h('img', { class: 'bl-img', src: imageUrl, alt: '' })
                : buildTemplate(tplId, roles);
            content.style.filter = cvdFilter(kind);
            return h('figure', { class: 'bl-card' }, h('div', { class: 'bl-card__view' }, content),
                h('figcaption', null, kind === 'none' ? t('prev.visionNormal') : t(`cvd.${kind}`)));
        }));
    }

    const tplDd = dropdown({ options: TEMPLATE_IDS.map(id => ({ value: id, label: () => t(`prev.tpl.${id}`) })), value: tplId, iconName: 'monitor', ariaLabel: t('prev.template'), onChange: v => { tplId = v; source = 'template'; srcSeg.setValue('template'); render(); } });
    const modeSeg = segmented({ ariaLabel: t('prev.mode'), value: mode, options: [{ value: 'light', label: () => t('prev.light') }, { value: 'dark', label: () => t('prev.dark') }], onChange: v => { mode = v; render(); } });
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'visually-hidden', 'aria-label': t('lab.ownImage') });
    file.addEventListener('change', () => {
        const f = file.files[0];
        if (!f || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 20 * 1024 * 1024) return toast(t('ext.badType'));
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = URL.createObjectURL(f);
        source = 'image';
        srcSeg.setValue('image');
        render();
    });
    const srcSeg = segmented({
        ariaLabel: t('lab.source'), value: source,
        options: [{ value: 'template', label: () => t('lab.srcTemplate') }, { value: 'image', label: () => t('lab.srcImage') }],
        onChange: v => {
            if (v === 'image' && !imageUrl) { file.click(); srcSeg.setValue(source); return; }
            source = v;
            render();
        }
    });
    const pick = button({ label: () => t('lab.ownImage'), iconName: 'image', onClick: () => file.click() });
    const el = h('div', { class: 'card' }, h('h3', { class: 'card__title' }, t('lab.blindness')), h('p', { class: 'card__lead' }, t('lab.blindnessLead')),
        h('div', { class: 'toolbar__row' }, srcSeg.el, tplDd.el, modeSeg.el, pick.el, file), grid);
    render();
    return { el, refresh: render };
}

// ======================= Módulo =======================

export function mount(root) {
    let tab = 'mixer';
    let views = {};

    function build() {
        root.replaceChildren();
        views = { mixer: mixerView(), gradient: gradientView(), comparator: comparatorView(), blindness: blindnessView() };
        const body = h('div', { class: 'lab-body' }, TABS.map(id => {
            const wrap = h('div', { class: 'lab-pane', dataset: { tab: id }, hidden: id !== tab }, views[id].el);
            return wrap;
        }));
        const seg = segmented({
            ariaLabel: t('nav.lab'), value: tab,
            options: TABS.map(id => ({ value: id, label: () => t(`lab.tab.${id}`) })),
            onChange: v => {
                tab = v;
                body.querySelectorAll('.lab-pane').forEach(p => { p.hidden = p.dataset.tab !== v; });
                views[v].refresh?.();
            }
        });
        root.append(h('div', { class: 'lab-tabs' }, seg.el), body);
    }

    build();
    onLangChange(build);
    subscribe((_, topic) => {
        if (topic !== 'palette' || !root.isConnected) return;
        views.comparator?.refresh();
        views.blindness?.refresh();
    });
}
