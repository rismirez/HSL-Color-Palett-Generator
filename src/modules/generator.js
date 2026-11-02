// Generator: paleta principal, armonías, edición individual, escalas, tonos clásicos y exportación.
import { clamp, formatColor, hexToHsl, hexToOklch, randomHex } from '../core/color.js';
import {
    DEFAULT_PARAMS, HARMONIES, PRESETS, complementary, darker, detectHarmony, generatePalette, lighter,
    regenerateOne, variations
} from '../core/harmony.js';
import { SCALE_SPACES, generateScale } from '../core/scale.js';
import { colorName } from '../core/names.js';
import { readableOn } from '../core/contrast.js';
import { buildShades } from '../core/shades.js';
import {
    DEFAULT_IMAGE_OPTIONS, IMAGE_LAYOUTS, TEXT_FORMATS, canvasToBlob, copyText, downloadFile, formatPaletteText,
    paletteToAse, paletteToCanvas, paletteToCss, paletteToGpl, paletteToJson, paletteToScss, paletteToSvg, paletteToTxt,
    scaleToCss, scaleToJson, scaleToScss, scaleToTailwind, shadesToCss, shadesToJson, shadesToScss, shadesToSvg,
    shadesToText, slug
} from '../core/export.js';
import { buildShareUrl, getState, regenerate, setPalette, setState, subscribe } from '../core/store.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { button, dropdown, segmented, slider, toggle } from '../ui/controls.js';
import { colorEditor, colorField, showPopover } from '../ui/color-editor.js';
import { h, icon, rafThrottle, toast } from '../ui/dom.js';

const COUNTS = [2, 3, 4, 5, 6, 8, 10];
const MAX_COLORS = 16;
const SIZE_PRESETS = [
    ['1600x900', 1600, 900], ['1920x1080', 1920, 1080], ['1080x1080', 1080, 1080],
    ['1200x630', 1200, 630], ['1080x1920', 1080, 1920]
];

// Generador pseudoaleatorio con semilla: mover un slider cambia la paleta de forma continua, sin parpadeos.
function seededRand(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let x = a;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

export function mount(root) {
    let seed = Math.floor(Math.random() * 1e9);
    let customCount = false;
    let imageOpts = { ...DEFAULT_IMAGE_OPTIONS };
    let sizeKey = '1600x900';
    let copyFormat = 'hex';
    let scaleFormat = 'css';
    let columns = [];
    let refs = {};

    const lang = () => getLang();
    const state = () => getState();

    // ---------- Acciones ----------

    const generate = ({ ignoreLocks = false } = {}) => {
        seed = Math.floor(Math.random() * 1e9);
        regenerate({ ignoreLocks, rand: seededRand(seed) });
    };
    const regenerateSmooth = () => regenerate({ rand: seededRand(seed) });

    function setCount(n) {
        n = clamp(Math.round(n) || 1, 1, MAX_COLORS);
        const { palette, locked, params, mainColor, useMain } = state();
        if (n === palette.length) return;
        if (n < palette.length) {
            setPalette(palette.slice(0, n), locked.slice(0, n));
        } else {
            const next = generatePalette({ count: n, locked: palette, base: useMain ? mainColor : null, params });
            setPalette(next, [...locked, ...Array(n - locked.length).fill(false)]);
        }
    }

    function updateColor(i, hex) {
        const palette = state().palette.slice();
        palette[i] = hex;
        // Con color principal activo, editar la posición 0 actualiza el color principal y la armonía
        if (i === 0 && state().useMain) {
            setState({ mainColor: hex }, 'params');
            setPalette(palette);
            regenerateSmooth();
            return;
        }
        setPalette(palette);
    }

    const toggleLock = i => {
        const locked = state().locked.slice();
        locked[i] = !locked[i];
        setPalette(state().palette, locked);
    };

    function duplicate(i) {
        const { palette, locked } = state();
        if (palette.length >= MAX_COLORS) return toast(t('gen.maxColors', { n: MAX_COLORS }));
        const p = palette.slice(), l = locked.slice();
        p.splice(i + 1, 0, palette[i]);
        l.splice(i + 1, 0, false);
        setPalette(p, l);
    }

    function remove(i) {
        const { palette, locked } = state();
        if (palette.length <= 1) return toast(t('gen.minColors'));
        setPalette(palette.filter((_, k) => k !== i), locked.filter((_, k) => k !== i));
    }

    function move(from, to) {
        const { palette, locked } = state();
        if (to < 0 || to >= palette.length || from === to) return;
        const p = palette.slice(), l = locked.slice();
        p.splice(to, 0, p.splice(from, 1)[0]);
        l.splice(to, 0, l.splice(from, 1)[0]);
        setPalette(p, l);
    }

    async function copy(text, message = t('toast.copied')) {
        toast((await copyText(text)) ? message : t('toast.copyFailed'));
    }

    function openVariations(i, anchor) {
        const base = state().palette[i];
        const groups = [
            ['gen.lighter', [lighter(base, 0.06), lighter(base, 0.12), lighter(base, 0.18)]],
            ['gen.darker', [darker(base, 0.06), darker(base, 0.12), darker(base, 0.18)]],
            ['gen.complementary', [complementary(base)]],
            ['gen.variations', variations(base, 5)]
        ];
        const content = h('div', { class: 'vars' }, groups.map(([key, list]) =>
            h('div', { class: 'vars__group' }, h('span', { class: 'vars__label' }, t(key)),
                h('div', { class: 'vars__row' }, list.map(hex => h('button', {
                    type: 'button', class: 'vars__swatch', style: { background: hex }, title: hex, 'aria-label': hex,
                    onclick: () => updateColor(i, hex)
                }, h('span', { class: 'vars__hex', style: { color: readableOn(hex) } }, hex.slice(1)))),
                h('button', {
                    type: 'button', class: 'btn btn--ghost btn--sm', title: t('gen.addAll'),
                    onclick: () => {
                        const { palette, locked } = state();
                        const room = MAX_COLORS - palette.length;
                        if (room <= 0) return toast(t('gen.maxColors', { n: MAX_COLORS }));
                        const add = list.slice(0, room);
                        setPalette([...palette, ...add], [...locked, ...add.map(() => false)]);
                    }
                }, icon('plus', 14), t('gen.addAll'))))));
        showPopover(anchor, content, { label: t('gen.variations') });
    }

    function openEditor(i, anchor) {
        const editor = colorEditor({ value: state().palette[i], onChange: hex => updateColor(i, hex) });
        showPopover(anchor, editor.el, { label: t('gen.edit') });
    }

    // ---------- Columnas de la paleta (se reutilizan para animar el cambio de color) ----------

    function createColumn() {
        const el = h('div', { class: 'swatch', draggable: true });
        const idx = () => Number(el.dataset.i);
        const nameEl = h('span', { class: 'swatch__name' });
        const hexBtn = h('button', { type: 'button', class: 'swatch__hex' });
        const meta = h('span', { class: 'swatch__meta' });
        const lockBtn = h('button', { type: 'button', class: 'swatch__lock' });
        const mk = (iconName, key, fn, extra = '') => {
            const b = h('button', { type: 'button', class: `swatch__act ${extra}`, onclick: e => fn(idx(), e.currentTarget) }, icon(iconName, 16));
            b.dataset.key = key;
            return b;
        };
        const acts = [
            mk('edit', 'gen.edit', openEditor),
            mk('copy', 'gen.copy', i => copy(state().palette[i])),
            mk('refresh', 'gen.regenOne', i => {
                const palette = state().palette.slice();
                palette[i] = regenerateOne(palette, i, state().params);
                setPalette(palette);
            }),
            mk('sliders', 'gen.variations', openVariations),
            mk('plus', 'gen.duplicate', i => duplicate(i)),
            mk('left', 'gen.moveLeft', i => move(i, i - 1)),
            mk('right', 'gen.moveRight', i => move(i, i + 1)),
            mk('trash', 'gen.remove', i => remove(i))
        ];
        lockBtn.addEventListener('click', () => toggleLock(idx()));
        hexBtn.addEventListener('click', () => copy(state().palette[idx()]));
        el.append(lockBtn, h('div', { class: 'swatch__info' }, nameEl, hexBtn, meta), h('div', { class: 'swatch__acts' }, acts));

        el.addEventListener('dragstart', e => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(idx()));
            el.classList.add('swatch--drag');
        });
        el.addEventListener('dragend', () => el.classList.remove('swatch--drag'));
        el.addEventListener('dragover', e => {
            e.preventDefault();
            el.classList.add('swatch--over');
        });
        el.addEventListener('dragleave', () => el.classList.remove('swatch--over'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.classList.remove('swatch--over');
            const from = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isInteger(from)) move(from, idx());
        });
        return { el, nameEl, hexBtn, meta, lockBtn, acts };
    }

    function renderPalette() {
        const { palette, locked } = state();
        while (columns.length < palette.length) {
            const c = createColumn();
            columns.push(c);
            refs.strip.append(c.el);
        }
        while (columns.length > palette.length) columns.pop().el.remove();
        palette.forEach((hex, i) => {
            const c = columns[i];
            const fg = readableOn(hex);
            const { h: hue, s, l } = hexToHsl(hex);
            c.el.dataset.i = i;
            c.el.style.background = hex;
            c.el.style.color = fg;
            c.el.classList.toggle('swatch--locked', Boolean(locked[i]));
            c.nameEl.textContent = colorName(hex, lang());
            c.hexBtn.textContent = hex.slice(1).toUpperCase();
            c.hexBtn.title = t('gen.copy');
            c.meta.textContent = `HSL ${Math.round(hue)}° ${Math.round(s)}% ${Math.round(l)}%`;
            c.lockBtn.replaceChildren(icon(locked[i] ? 'lock' : 'unlock', 18));
            const lockText = locked[i] ? t('gen.unlock') : t('gen.lock');
            c.lockBtn.title = lockText;
            c.lockBtn.setAttribute('aria-label', lockText);
            c.lockBtn.setAttribute('aria-pressed', Boolean(locked[i]));
            c.acts.forEach(b => {
                b.title = t(b.dataset.key);
                b.setAttribute('aria-label', t(b.dataset.key));
            });
            c.acts[5].disabled = i === 0;
            c.acts[6].disabled = i === palette.length - 1;
        });
    }

    // ---------- Rueda cromática ----------

    function renderWheel() {
        const { palette, params } = state();
        const R = 80, cx = 100, cy = 100;
        const pts = palette.map(hex => {
            const { h: hue, s } = hexToHsl(hex);
            const a = ((hue - 90) * Math.PI) / 180;
            const r = 14 + (s / 100) * (R - 14);
            return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), hex };
        });
        const svgNs = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('viewBox', '0 0 200 200');
        svg.setAttribute('class', 'wheel__svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', t('gen.wheelLabel'));
        if (pts.length > 1) {
            const poly = document.createElementNS(svgNs, params.harmony === 'complementary' || pts.length === 2 ? 'polyline' : 'polygon');
            poly.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
            poly.setAttribute('class', 'wheel__shape');
            svg.append(poly);
        }
        pts.forEach(p => {
            const c = document.createElementNS(svgNs, 'circle');
            c.setAttribute('cx', p.x.toFixed(1));
            c.setAttribute('cy', p.y.toFixed(1));
            c.setAttribute('r', 8);
            c.setAttribute('fill', p.hex);
            c.setAttribute('class', 'wheel__dot');
            svg.append(c);
        });
        refs.wheel.replaceChildren(svg);
        const detected = detectHarmony(palette);
        refs.wheelCaption.textContent = t('gen.detected', { name: t(`harmony.${detected.name}`) });
    }

    // ---------- Escala ----------

    function currentScale() {
        const { palette, scale } = state();
        const base = palette[clamp(scale.index, 0, palette.length - 1)];
        return { base, scale: generateScale(base, scale.space) };
    }

    function renderScale() {
        const { base, scale } = currentScale();
        const name = colorName(base, lang());
        refs.scaleGrid.replaceChildren(...scale.map(s => {
            const fg = readableOn(s.hex);
            const ok = hexToOklch(s.hex);
            return h('button', {
                type: 'button', class: `step ${s.base ? 'step--base' : ''}`, style: { background: s.hex, color: fg },
                title: t('gen.copy'), onclick: () => copy(s.hex)
            }, h('span', { class: 'step__n' }, s.step), h('span', { class: 'step__hex' }, s.hex.slice(1).toUpperCase()),
            h('span', { class: 'step__detail' }, formatColor(s.hex, 'rgb')),
            h('span', { class: 'step__detail' }, formatColor(s.hex, 'hsl')),
            h('span', { class: 'step__detail' }, `oklch ${(ok.l * 100).toFixed(0)}% ${ok.c.toFixed(2)} ${Math.round(ok.h)}`),
            s.base && h('span', { class: 'step__badge' }, t('gen.original')));
        }));
        refs.scaleName.textContent = name;
    }

    function scaleExport(kind) {
        const { base, scale } = currentScale();
        const name = colorName(base, 'en');
        const map = {
            css: [scaleToCss(name, scale), 'text/css', 'css'],
            scss: [scaleToScss(name, scale), 'text/plain', 'scss'],
            json: [scaleToJson(name, scale), 'application/json', 'json'],
            tailwind: [scaleToTailwind(name, scale), 'text/javascript', 'tailwind.js'],
            hex: [scale.map(s => s.hex).join('\n'), 'text/plain', 'txt']
        };
        return { name, data: map[kind] };
    }

    // ---------- Tonos clásicos ----------

    function renderShades() {
        const { shades } = state();
        const s = buildShades(shades.base, shades.tones, shades.step);
        const box = c => {
            const fg = readableOn(c.hex);
            return h('div', { class: 'color-box', style: { background: c.hex, color: fg } },
                h('span', null, `HSL: ${c.hsl}`), h('span', null, `HEX: ${c.hex}`),
                h('button', { type: 'button', class: 'color-box__copy', title: t('gen.copy'), 'aria-label': t('gen.copy'), onclick: () => copy(c.hex) }, icon('copy', 16)));
        };
        refs.shadeSelected.replaceChildren(box(s.selected));
        refs.shadeLighter.replaceChildren(...s.lighter.map(box));
        refs.shadeDarker.replaceChildren(...s.darker.map(box));
        return s;
    }

    // ---------- Exportación ----------

    const currentImageSize = () => {
        const preset = SIZE_PRESETS.find(p => p[0] === sizeKey);
        return preset ? { width: preset[1], height: preset[2] } : { width: imageOpts.width, height: imageOpts.height };
    };

    const renderImagePreview = rafThrottle(() => {
        const size = currentImageSize();
        const canvas = paletteToCanvas(state().palette, { ...imageOpts, ...size }, lang());
        canvas.className = 'export__canvas';
        refs.imagePreview.replaceChildren(canvas);
    });

    async function downloadImage(kind) {
        const size = currentImageSize();
        const opts = { ...imageOpts, ...size };
        if (kind === 'svg') {
            downloadFile('palette.svg', paletteToSvg(state().palette, opts, lang()), 'image/svg+xml');
        } else {
            const blob = await canvasToBlob(paletteToCanvas(state().palette, opts, lang()));
            downloadFile('palette.png', blob);
        }
    }

    const downloads = () => {
        const p = state().palette;
        const names = p.map(c => colorName(c, 'en'));
        return [
            ['TXT', () => downloadFile('palette.txt', paletteToTxt(p, lang()))],
            ['JSON', () => downloadFile('palette.json', paletteToJson(p, null, lang()), 'application/json')],
            ['CSS', () => downloadFile('palette.css', paletteToCss(p, names), 'text/css')],
            ['SCSS', () => downloadFile('palette.scss', paletteToScss(p, names))],
            ['SVG', () => downloadImage('svg')],
            ['PNG', () => downloadImage('png')],
            ['ASE', () => downloadFile('palette.ase', paletteToAse(p, lang()))],
            ['GPL', () => downloadFile('palette.gpl', paletteToGpl(p, 'Magic Color Tools', lang()))]
        ];
    };

    // ---------- Construcción de la interfaz ----------

    function section(titleKey, ...children) {
        const title = h('h3', { class: 'card__title' }, t(titleKey));
        return h('section', { class: 'card' }, title, ...children);
    }

    function applyParams(patch, { smooth = true, preset = 'none' } = {}) {
        setState({ params: { ...state().params, ...patch }, preset }, 'params');
        if (smooth) regenerateSmooth();
    }

    function build() {
        root.replaceChildren();
        columns = [];
        refs = {};
        const s = state();

        // --- Barra de control ---
        const mainField = colorField({
            value: s.mainColor, ariaLabel: t('gen.mainColor'),
            onChange: hex => {
                setState({ mainColor: hex }, 'params');
                if (state().useMain) regenerateSmooth();
            }
        });
        const useMain = toggle({
            label: t('gen.useMain'), checked: s.useMain,
            onChange: on => {
                setState({ useMain: on }, 'params');
                if (on) regenerateSmooth();
            }
        });
        const applyMain = button({
            label: () => t('gen.generate'), iconName: 'sparkle', variant: 'primary',
            onClick: () => {
                // Comportamiento original: genera la paleta alrededor del color indicado
                setState({ useMain: true }, 'params');
                useMain.setChecked(true);
                generate();
            }
        });
        const randomMain = button({
            label: () => t('gen.randomColor'), iconName: 'dice',
            onClick: () => {
                const hex = randomHex();
                mainField.setValue(hex);
                setState({ mainColor: hex, useMain: true }, 'params');
                useMain.setChecked(true);
                generate();
            }
        });
        const countDd = dropdown({
            options: [...COUNTS.map(n => ({ value: String(n), label: () => t('gen.nColors', { n }) })), { value: 'custom', label: () => t('gen.custom') }],
            value: customCount || !COUNTS.includes(s.palette.length) ? 'custom' : String(s.palette.length), ariaLabel: t('gen.count'),
            onChange: v => {
                customCount = v === 'custom';
                if (customCount) refs.customCount.hidden = false;
                else {
                    refs.customCount.hidden = true;
                    setCount(Number(v));
                }
            }
        });
        refs.countDd = countDd;
        refs.customCount = h('input', {
            type: 'number', min: 1, max: MAX_COLORS, class: 'num', value: s.palette.length, 'aria-label': t('gen.customCount'),
            hidden: !(customCount || !COUNTS.includes(s.palette.length))
        });
        refs.customCount.addEventListener('change', () => setCount(Number(refs.customCount.value)));
        const harmonyDd = dropdown({
            options: Object.keys(HARMONIES).map(k => ({ value: k, label: () => t(`harmony.${k}`) })),
            value: s.params.harmony, iconName: 'wheel', ariaLabel: t('gen.harmony'),
            onChange: v => applyParams({ harmony: v }, { preset: state().preset === 'mono' ? 'none' : state().preset })
        });
        refs.harmonyDd = harmonyDd;
        const generateBtn = button({ label: () => t('gen.new'), iconName: 'refresh', variant: 'primary', onClick: () => generate() });
        const regenAll = button({ label: () => t('gen.regenAll'), iconName: 'dice', onClick: () => generate({ ignoreLocks: true }) });
        const shareBtn = button({
            label: () => t('gen.share'), iconName: 'share',
            onClick: () => copy(buildShareUrl(), t('toast.urlCopied'))
        });

        refs.toolbar = h('section', { class: 'card toolbar' },
            h('div', { class: 'toolbar__main' },
                h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('gen.mainColor')), mainField.el, h('small', { class: 'field__hint' }, t('gen.mainHint'))),
                h('div', { class: 'toolbar__btns' }, applyMain.el, randomMain.el),
                useMain.el),
            h('div', { class: 'toolbar__sep' }),
            h('div', { class: 'toolbar__gen' },
                h('div', { class: 'toolbar__row' }, countDd.el, refs.customCount, harmonyDd.el),
                h('div', { class: 'toolbar__btns' }, generateBtn.el, regenAll.el, shareBtn.el),
                h('small', { class: 'field__hint' }, t('gen.spaceHint'))));

        // --- Parámetros ---
        const temp = segmented({
            ariaLabel: t('gen.temperature'), value: s.params.temperature,
            options: ['any', 'warm', 'neutral', 'cool'].map(v => ({ value: v, label: () => t(`temp.${v}`) })),
            onChange: v => applyParams({ temperature: v })
        });
        const dist = segmented({
            ariaLabel: t('gen.distribution'), value: s.params.distribution,
            options: ['even', 'random'].map(v => ({ value: v, label: () => t(`dist.${v}`) })),
            onChange: v => applyParams({ distribution: v })
        });
        const presets = segmented({
            ariaLabel: t('gen.presets'), value: s.preset,
            options: ['none', 'pastel', 'vibrant', 'muted', 'dark', 'light', 'mono'].map(v => ({ value: v, label: () => t(`preset.${v}`) })),
            onChange: v => {
                if (v === 'mono') applyParams({ harmony: 'monochromatic' }, { preset: v });
                else if (PRESETS[v]) applyParams(PRESETS[v], { preset: v });
                else applyParams({ ...DEFAULT_PARAMS, harmony: state().params.harmony, temperature: state().params.temperature }, { preset: v });
                syncParamControls();
            }
        });
        const rangeSlider = (key, label, min, max, fmt, paired) => slider({
            label: () => t(label), min, max, value: s.params[key], format: fmt,
            onInput: v => {
                const patch = { [key]: v };
                if (paired) {
                    // Los mínimos nunca superan a sus máximos
                    if (paired.type === 'min' && v > state().params[paired.key]) patch[paired.key] = v;
                    if (paired.type === 'max' && v < state().params[paired.key]) patch[paired.key] = v;
                }
                applyParams(patch);
                syncParamControls();
            }
        });
        const pct = v => `${v}%`;
        const sliders = {
            sMin: rangeSlider('sMin', 'gen.satMin', 0, 100, pct, { type: 'min', key: 'sMax' }),
            sMax: rangeSlider('sMax', 'gen.satMax', 0, 100, pct, { type: 'max', key: 'sMin' }),
            lMin: rangeSlider('lMin', 'gen.lightMin', 0, 100, pct, { type: 'min', key: 'lMax' }),
            lMax: rangeSlider('lMax', 'gen.lightMax', 0, 100, pct, { type: 'max', key: 'lMin' }),
            hueSpread: rangeSlider('hueSpread', 'gen.hueSpread', 0, 200, pct),
            contrast: rangeSlider('contrast', 'gen.contrast', 0, 100, pct)
        };
        function syncParamControls() {
            const p = state().params;
            Object.entries(sliders).forEach(([k, sl]) => sl.setValue(p[k]));
            temp.setValue(p.temperature);
            dist.setValue(p.distribution);
            presets.setValue(state().preset);
            harmonyDd.setValue(p.harmony);
        }
        refs.syncParamControls = syncParamControls;
        const paramsBody = h('div', { class: 'params' },
            h('div', { class: 'params__col' },
                h('span', { class: 'field__label' }, t('gen.presets')), presets.el,
                h('span', { class: 'field__label' }, t('gen.temperature')), temp.el,
                h('span', { class: 'field__label' }, t('gen.distribution')), dist.el),
            h('div', { class: 'params__col' }, sliders.sMin.el, sliders.sMax.el, sliders.lMin.el, sliders.lMax.el),
            h('div', { class: 'params__col' }, sliders.hueSpread.el, sliders.contrast.el,
                h('small', { class: 'field__hint' }, t('gen.paramsHint'))));
        const paramsDetails = h('details', { class: 'card card--details' },
            h('summary', { class: 'card__title card__summary' }, icon('sliders', 18), t('gen.params'), icon('chevron', 18)), paramsBody);

        // --- Paleta ---
        refs.strip = h('div', { class: 'strip', role: 'list', 'aria-label': t('gen.palette') });
        refs.wheel = h('div', { class: 'wheel' });
        refs.wheelCaption = h('small', { class: 'wheel__caption' });
        const paletteCard = h('section', { class: 'card card--palette' },
            h('div', { class: 'palette-layout' },
                h('div', { class: 'palette-layout__strip' }, refs.strip),
                h('aside', { class: 'palette-layout__wheel' }, h('div', { class: 'wheel__ring' }, refs.wheel), refs.wheelCaption)));

        // --- Escala ---
        const { palette } = state();
        const sourceOptions = () => state().palette.map((c, i) => ({ value: String(i), label: `${i + 1} · ${c.toUpperCase()}` }));
        refs.scaleSource = dropdown({
            options: sourceOptions(), value: String(s.scale.index), ariaLabel: t('gen.scaleSource'),
            onChange: v => setState({ scale: { ...state().scale, index: Number(v) } }, 'scale')
        });
        const spaceDd = dropdown({
            options: SCALE_SPACES.map(v => ({ value: v, label: v.toUpperCase() })), value: s.scale.space, ariaLabel: t('gen.scaleSpace'),
            onChange: v => setState({ scale: { ...state().scale, space: v } }, 'scale')
        });
        refs.scaleGrid = h('div', { class: 'scale' });
        refs.scaleName = h('span', { class: 'scale__name' });
        const scaleFmtDd = dropdown({
            options: ['css', 'scss', 'json', 'tailwind'].map(v => ({ value: v, label: v === 'tailwind' ? 'Tailwind' : v.toUpperCase() })),
            value: scaleFormat, ariaLabel: t('gen.format'), onChange: v => { scaleFormat = v; }
        });
        const copyScaleHex = button({
            label: () => t('gen.copyScale'), iconName: 'copy',
            onClick: () => copy(scaleExport('hex').data[0], t('toast.scaleCopied'))
        });
        const copyScaleCode = button({
            label: () => t('gen.copyCode'), iconName: 'code', onClick: () => copy(scaleExport(scaleFormat).data[0])
        });
        const scaleDownload = button({
            label: () => t('gen.downloadScale'), iconName: 'download',
            onClick: () => {
                const { data, name } = scaleExport(scaleFormat);
                downloadFile(`${slug(name)}-scale.${data[2]}`, data[0], data[1]);
            }
        });
        const scaleCard = section('gen.scale',
            h('p', { class: 'card__lead' }, t('gen.scaleLead')),
            h('div', { class: 'toolbar__row' }, refs.scaleSource.el, spaceDd.el, refs.scaleName),
            refs.scaleGrid,
            h('div', { class: 'toolbar__row' }, copyScaleHex.el, scaleFmtDd.el, copyScaleCode.el, scaleDownload.el));

        // --- Tonos clásicos ---
        const shadeField = colorField({
            value: s.shades.base, ariaLabel: t('gen.shadeBase'),
            onChange: hex => {
                setState({ shades: { ...state().shades, base: hex } }, 'shades');
            }
        });
        const useFromPalette = button({
            label: () => t('gen.useSelected'), iconName: 'palette',
            onClick: () => {
                const hex = state().palette[clamp(state().scale.index, 0, state().palette.length - 1)];
                shadeField.setValue(hex);
                setState({ shades: { ...state().shades, base: hex } }, 'shades');
            }
        });
        const tones = slider({
            label: () => t('gen.tones'), min: 1, max: 10, value: s.shades.tones, hint: t('gen.tonesHint'),
            onInput: v => setState({ shades: { ...state().shades, tones: v } }, 'shades')
        });
        const step = slider({
            label: () => t('gen.step'), min: 1, max: 20, value: s.shades.step, format: v => `${v}%`, hint: t('gen.stepHint'),
            onInput: v => setState({ shades: { ...state().shades, step: v } }, 'shades')
        });
        refs.shadeSelected = h('div', { class: 'shades__selected' });
        refs.shadeLighter = h('div', { class: 'shades__list' });
        refs.shadeDarker = h('div', { class: 'shades__list' });
        const dl = (label, fn) => button({ label, iconName: 'download', onClick: fn });
        const shadeDownloads = [
            dl('SVG', () => downloadFile('color-palette.svg', shadesToSvg(renderShades()), 'image/svg+xml')),
            dl('TXT', () => downloadFile('color-palette.txt', shadesToText(renderShades()))),
            dl('JSON', () => downloadFile('color-palette.json', shadesToJson(renderShades()), 'application/json')),
            dl('CSS', () => downloadFile('color-palette.css', shadesToCss(renderShades()), 'text/css')),
            dl('SCSS', () => downloadFile('color-palette.scss', shadesToScss(renderShades())))
        ];
        const shadesCard = section('gen.shades',
            h('p', { class: 'card__lead' }, t('gen.shadesLead')),
            h('div', { class: 'shades' },
                h('div', { class: 'shades__controls' },
                    h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('gen.shadeBase')), shadeField.el), useFromPalette.el, tones.el, step.el),
                h('div', { class: 'shades__out' },
                    h('h4', { class: 'subtitle' }, t('gen.selected')), refs.shadeSelected,
                    h('div', { class: 'shades__cols' },
                        h('div', null, h('h4', { class: 'subtitle' }, t('gen.lighter')), refs.shadeLighter),
                        h('div', null, h('h4', { class: 'subtitle' }, t('gen.darker')), refs.shadeDarker)))),
            h('div', { class: 'btnrow' },
                button({ label: () => t('gen.shareUrl'), iconName: 'share', onClick: () => copy(buildShareUrl(), t('toast.urlCopied')) }).el,
                shadeDownloads.map(b => b.el)));

        // --- Exportación ---
        const fmtDd = dropdown({
            options: TEXT_FORMATS.map(f => ({ value: f, label: f.toUpperCase() })), value: copyFormat, ariaLabel: t('gen.format'),
            onChange: v => { copyFormat = v; }
        });
        const copyAll = button({
            label: () => t('gen.copyAll'), iconName: 'copy',
            onClick: () => copy(formatPaletteText(state().palette, copyFormat), t('toast.paletteCopied'))
        });
        const copyCss = button({
            label: () => t('gen.copyCss'), iconName: 'code',
            onClick: () => copy(paletteToCss(state().palette, state().palette.map(c => colorName(c, 'en'))))
        });
        const copyJson = button({
            label: () => t('gen.copyJson'), iconName: 'code',
            onClick: () => copy(paletteToJson(state().palette, null, lang()))
        });
        const layoutSeg = segmented({
            ariaLabel: t('gen.layout'), value: imageOpts.layout,
            options: IMAGE_LAYOUTS.map(v => ({ value: v, label: () => t(`layout.${v}`) })),
            onChange: v => { imageOpts.layout = v; renderImagePreview(); }
        });
        const sizeDd = dropdown({
            options: [...SIZE_PRESETS.map(p => ({ value: p[0], label: p[0].replace('x', ' × ') })), { value: 'custom', label: () => t('gen.custom') }],
            value: sizeKey, ariaLabel: t('gen.size'),
            onChange: v => {
                sizeKey = v;
                refs.customSize.hidden = v !== 'custom';
                renderImagePreview();
            }
        });
        const sizeInput = (key, label) => {
            const input = h('input', { type: 'number', min: 64, max: 4096, class: 'num', value: imageOpts[key], 'aria-label': label });
            input.addEventListener('change', () => {
                imageOpts[key] = clamp(Math.round(+input.value) || imageOpts[key], 64, 4096);
                input.value = imageOpts[key];
                renderImagePreview();
            });
            return input;
        };
        refs.customSize = h('div', { class: 'toolbar__row', hidden: sizeKey !== 'custom' },
            sizeInput('width', t('gen.width')), h('span', null, '×'), sizeInput('height', t('gen.height')));
        const toggles = ['name', 'hex', 'rgb', 'hsl', 'brand'].map(k => toggle({
            label: () => t(`opt.${k}`), checked: imageOpts[k],
            onChange: v => { imageOpts[k] = v; renderImagePreview(); }
        }));
        refs.imagePreview = h('div', { class: 'export__preview' });
        const exportCard = section('gen.export',
            h('div', { class: 'export' },
                h('div', { class: 'export__col' },
                    h('h4', { class: 'subtitle' }, t('gen.copyTitle')),
                    h('div', { class: 'toolbar__row' }, fmtDd.el, copyAll.el),
                    h('div', { class: 'btnrow' }, copyCss.el, copyJson.el),
                    h('h4', { class: 'subtitle' }, t('gen.downloadTitle')),
                    h('div', { class: 'btnrow' }, downloads().map(([label, fn]) => button({ label, iconName: 'download', onClick: fn }).el))),
                h('div', { class: 'export__col' },
                    h('h4', { class: 'subtitle' }, t('gen.imageTitle')),
                    layoutSeg.el,
                    h('div', { class: 'toolbar__row' }, sizeDd.el, refs.customSize),
                    h('div', { class: 'toggles' }, toggles.map(x => x.el)),
                    refs.imagePreview)));

        root.append(refs.toolbar, paletteCard, paramsDetails, scaleCard, shadesCard, exportCard);
        refs.sourceOptions = sourceOptions;
        renderAll();
    }

    function renderAll() {
        renderPalette();
        renderWheel();
        refs.scaleSource.setOptions(refs.sourceOptions());
        refs.scaleSource.setValue(String(clamp(state().scale.index, 0, state().palette.length - 1)));
        renderScale();
        renderShades();
        renderImagePreview();
        refs.syncParamControls?.();
        refs.harmonyDd.setValue(state().params.harmony);
        const n = state().palette.length;
        if (!customCount) refs.countDd.setValue(COUNTS.includes(n) ? String(n) : 'custom');
        if (!COUNTS.includes(n)) refs.customCount.hidden = false;
        refs.customCount.value = n;
    }

    build();
    onLangChange(build);
    subscribe((_, topic) => {
        if (!root.isConnected) return;
        if (topic === 'palette' || topic === 'params') renderAll();
        else if (topic === 'scale') renderScale();
        else if (topic === 'shades') renderShades();
    });

    document.addEventListener('keydown', e => {
        if (e.code !== 'Space' || root.hidden || e.repeat) return;
        if (document.activeElement !== document.body) return;
        e.preventDefault();
        generate();
    });
}
