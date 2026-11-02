// Extractor: paletas a partir de imágenes, procesadas por completo en el navegador.
import { clamp, rgbToHex } from '../core/color.js';
import { colorName } from '../core/names.js';
import { readableOn } from '../core/contrast.js';
import { ACCEPTED_TYPES, extractPalette, loadImage, validateImageFile } from '../core/extract.js';
import { canvasToBlob, copyText, downloadFile } from '../core/export.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { getState, setPalette, setState } from '../core/store.js';
import { button, dropdown, slider } from '../ui/controls.js';
import { colorField } from '../ui/color-editor.js';
import { debounce, h, icon, toast } from '../ui/dom.js';

const COUNTS = [3, 5, 6, 8, 10];
const MAX_DISPLAY = 760;

export function mount(root) {
    let image = null; // { width, height, data, source }
    let fileName = 'image';
    let k = 5;
    let customK = false;
    let bias = 0;
    let altSeed = 7;
    let variants = []; // [{ id, colors }]
    let activeVariant = 'main';
    let result = []; // colores editables: { hex, weight, role }
    let picks = [];
    let refs = {};

    // ---------- Lógica ----------

    function compute() {
        if (!image) return;
        variants = [
            { id: 'main', colors: extractPalette(image, k, { seed: 1, bias }) },
            { id: 'vivid', colors: extractPalette(image, k, { seed: 1, bias: 1 }) },
            { id: 'alt', colors: extractPalette(image, k, { seed: altSeed, bias }) }
        ];
        const chosen = variants.find(v => v.id === activeVariant) || variants[0];
        result = chosen.colors.map(c => ({ ...c }));
        renderResults();
    }
    const computeSoon = debounce(compute, 150);

    async function handleFile(file) {
        const problem = validateImageFile(file);
        if (problem) return toast(t(problem === 'type' ? 'ext.badType' : 'ext.tooBig'));
        try {
            image = await loadImage(file);
        } catch {
            return toast(t('ext.decodeFailed'));
        }
        fileName = (file.name || 'image').replace(/\.[^.]+$/, '');
        picks = [];
        activeVariant = 'main';
        drawImage();
        refs.dropzone.hidden = true;
        refs.stage.hidden = false;
        refs.panel.hidden = false;
        compute();
    }

    function drawImage() {
        const { source } = image;
        const scale = Math.min(1, MAX_DISPLAY / source.width);
        const canvas = refs.canvas;
        canvas.width = Math.round(source.width * scale);
        canvas.height = Math.round(source.height * scale);
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0, canvas.width, canvas.height);
        refs.markers.replaceChildren();
    }

    function pickAt(e) {
        if (!image) return;
        const r = refs.canvas.getBoundingClientRect();
        const x = clamp(Math.floor(((e.clientX - r.left) / r.width) * refs.canvas.width), 0, refs.canvas.width - 1);
        const y = clamp(Math.floor(((e.clientY - r.top) / r.height) * refs.canvas.height), 0, refs.canvas.height - 1);
        const [pr, pg, pb] = refs.canvas.getContext('2d').getImageData(x, y, 1, 1).data;
        const hex = rgbToHex({ r: pr, g: pg, b: pb });
        picks = [{ hex, x: x / refs.canvas.width, y: y / refs.canvas.height }, ...picks].slice(0, 12);
        renderPicks();
    }

    async function copy(text) {
        toast((await copyText(text)) ? t('toast.copied') : t('toast.copyFailed'));
    }

    function sendToGenerator() {
        if (!result.length) return;
        setPalette(result.slice(0, 16).map(c => c.hex));
        setState({ module: 'generator' }, 'module');
        toast(t('ext.sent'));
    }

    async function saveWithImage() {
        if (!image || !result.length) return;
        const w = 1200;
        const imgH = Math.round((image.source.height / image.source.width) * w);
        const stripH = 180;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = imgH + stripH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image.source, 0, 0, w, imgH);
        const cw = w / result.length;
        result.forEach((c, i) => {
            ctx.fillStyle = c.hex;
            ctx.fillRect(i * cw, imgH, cw, stripH);
            ctx.fillStyle = readableOn(c.hex);
            ctx.font = '600 22px system-ui, sans-serif';
            ctx.fillText(c.hex.toUpperCase(), i * cw + 16, imgH + stripH - 20, cw - 24);
        });
        downloadFile(`${fileName}-palette.png`, await canvasToBlob(canvas));
    }

    // ---------- Render ----------

    function swatchBar(colors, onUse, active) {
        return h('div', { class: `variant ${active ? 'variant--on' : ''}` },
            h('div', { class: 'variant__bar' }, colors.map(c => h('div', {
                class: 'variant__seg', style: { background: c.hex, flexGrow: Math.max(c.weight, 0.04) }, title: `${c.hex} · ${(c.weight * 100).toFixed(1)}%`
            }))),
            onUse && button({ label: () => (active ? t('ext.inUse') : t('ext.useThis')), iconName: active ? 'check' : 'eye', variant: 'ghost', onClick: onUse }).el);
    }

    function renderResults() {
        const names = { main: t('ext.variantMain'), vivid: t('ext.variantVivid'), alt: t('ext.variantAlt') };
        refs.variants.replaceChildren(...variants.map(v => h('div', { class: 'variant-wrap' },
            h('span', { class: 'variant__name' }, names[v.id]),
            swatchBar(v.colors, () => {
                activeVariant = v.id;
                result = v.colors.map(c => ({ ...c }));
                renderResults();
            }, v.id === activeVariant))));

        refs.result.replaceChildren(...result.map((c, i) => {
            const field = colorField({
                value: c.hex, ariaLabel: t('ext.editColor'),
                onChange: hex => {
                    result[i] = { ...result[i], hex };
                    refs.names[i].textContent = colorName(hex, getLang());
                    refs.chips[i].style.background = hex;
                }
            });
            const chip = h('div', { class: 'chip', style: { background: c.hex, color: readableOn(c.hex) } });
            const name = h('span', { class: 'chip__name' }, colorName(c.hex, getLang()));
            chip.append(name, h('span', { class: 'chip__meta' }, `${(c.weight * 100).toFixed(1)}% · ${t(`ext.role.${c.role}`)}`));
            (refs.chips ||= [])[i] = chip;
            (refs.names ||= [])[i] = name;
            return h('div', { class: 'res' }, chip, field.el,
                h('div', { class: 'res__acts' },
                    h('button', { type: 'button', class: 'btn btn--ghost btn--icon', title: t('gen.copy'), 'aria-label': t('gen.copy'), onclick: () => copy(result[i].hex) }, icon('copy', 16)),
                    h('button', {
                        type: 'button', class: 'btn btn--ghost btn--icon', title: t('gen.remove'), 'aria-label': t('gen.remove'),
                        onclick: () => {
                            if (result.length <= 1) return toast(t('gen.minColors'));
                            result.splice(i, 1);
                            renderResults();
                        }
                    }, icon('trash', 16))));
        }));
    }

    function renderPicks() {
        refs.markers.replaceChildren(...picks.map((p, i) => h('span', {
            class: `marker ${i === 0 ? 'marker--last' : ''}`, style: { left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: p.hex }
        })));
        refs.picks.replaceChildren(...(picks.length ? picks.map(p => h('div', { class: 'pick' },
            h('button', {
                type: 'button', class: 'pick__sw', style: { background: p.hex }, title: t('gen.copy'), 'aria-label': `${t('gen.copy')} ${p.hex}`, onclick: () => copy(p.hex)
            }),
            h('span', { class: 'pick__hex' }, p.hex.toUpperCase()),
            h('button', {
                type: 'button', class: 'btn btn--ghost btn--sm', title: t('ext.addToResult'),
                onclick: () => {
                    result.push({ hex: p.hex, weight: 0, role: 'accent' });
                    renderResults();
                }
            }, icon('plus', 14), t('ext.addToResult'))))
            : [h('p', { class: 'hint' }, t('ext.pickHint'))]));
    }

    function build() {
        const keepImage = Boolean(image);
        root.replaceChildren();
        refs = {};

        const input = h('input', { type: 'file', accept: ACCEPTED_TYPES.join(','), class: 'visually-hidden', 'aria-label': t('ext.choose') });
        input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));
        refs.dropzone = h('div', { class: 'drop', tabindex: '0', role: 'button', 'aria-label': t('ext.dropTitle') },
            icon('upload', 36), h('strong', null, t('ext.dropTitle')), h('span', { class: 'hint' }, t('ext.dropHint')),
            button({ label: () => t('ext.choose'), iconName: 'image', variant: 'primary', onClick: e => { e.stopPropagation(); input.click(); } }).el,
            h('small', { class: 'hint' }, t('ext.local')), input);
        refs.dropzone.addEventListener('click', () => input.click());
        refs.dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
        ['dragenter', 'dragover'].forEach(ev => refs.dropzone.addEventListener(ev, e => { e.preventDefault(); refs.dropzone.classList.add('drop--over'); }));
        ['dragleave', 'drop'].forEach(ev => refs.dropzone.addEventListener(ev, e => { e.preventDefault(); refs.dropzone.classList.remove('drop--over'); }));
        refs.dropzone.addEventListener('drop', e => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));

        refs.canvas = h('canvas', { class: 'stage__canvas', 'aria-label': t('ext.canvasLabel'), role: 'img' });
        refs.canvas.addEventListener('click', pickAt);
        refs.markers = h('div', { class: 'markers' });
        const another = button({ label: () => t('ext.another'), iconName: 'image', onClick: () => input.click() });
        refs.stage = h('div', { class: 'stage', hidden: true },
            h('div', { class: 'stage__wrap' }, refs.canvas, refs.markers), h('p', { class: 'hint' }, t('ext.clickHint')), another.el);

        const countDd = dropdown({
            options: [...COUNTS.map(n => ({ value: String(n), label: () => t('gen.nColors', { n }) })), { value: 'custom', label: () => t('gen.custom') }],
            value: customK ? 'custom' : String(k), ariaLabel: t('gen.count'),
            onChange: v => {
                customK = v === 'custom';
                refs.customK.hidden = !customK;
                if (!customK) { k = Number(v); compute(); }
            }
        });
        refs.customK = h('input', { type: 'number', min: 1, max: 16, class: 'num', value: k, hidden: !customK, 'aria-label': t('gen.customCount') });
        refs.customK.addEventListener('change', () => { k = clamp(Math.round(+refs.customK.value) || k, 1, 16); refs.customK.value = k; compute(); });
        const weight = slider({
            label: () => t('ext.weight'), min: 0, max: 100, value: Math.round(bias * 100), format: v => `${v}%`, hint: t('ext.weightHint'),
            onInput: v => { bias = v / 100; computeSoon(); }
        });
        const altBtn = button({ label: () => t('ext.alternative'), iconName: 'refresh', onClick: () => { altSeed += 11; activeVariant = 'alt'; compute(); } });
        const sendBtn = button({ label: () => t('ext.send'), iconName: 'palette', variant: 'primary', onClick: sendToGenerator });
        const copyBtn = button({ label: () => t('gen.copyAll'), iconName: 'copy', onClick: () => copy(result.map(c => c.hex).join('\n')) });
        const saveBtn = button({ label: () => t('ext.saveImage'), iconName: 'download', onClick: saveWithImage });

        refs.variants = h('div', { class: 'variants' });
        refs.result = h('div', { class: 'res-list' });
        refs.picks = h('div', { class: 'picks' });
        refs.panel = h('div', { class: 'ext__panel', hidden: true },
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('ext.settings')),
                h('div', { class: 'toolbar__row' }, countDd.el, refs.customK), weight.el, altBtn.el),
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('ext.compare')), refs.variants),
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('ext.result')), refs.result,
                h('div', { class: 'btnrow' }, sendBtn.el, copyBtn.el, saveBtn.el)),
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('ext.picked')), refs.picks));

        root.append(h('div', { class: 'ext' },
            h('section', { class: 'card ext__left' }, h('h3', { class: 'card__title' }, t('ext.title')),
                h('p', { class: 'card__lead' }, t('ext.lead')), refs.dropzone, refs.stage),
            refs.panel));

        if (keepImage) {
            refs.dropzone.hidden = true;
            refs.stage.hidden = false;
            refs.panel.hidden = false;
            drawImage();
            renderPicks();
            renderResults();
        } else {
            renderPicks();
        }
    }

    build();
    onLangChange(build);

    document.addEventListener('paste', e => {
        if (root.hidden) return;
        const file = Array.from(e.clipboardData?.files || []).find(f => ACCEPTED_TYPES.includes(f.type));
        if (file) {
            e.preventDefault();
            handleFile(file);
        }
    });
}
