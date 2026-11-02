// Color Systems: tokens primitivos y semánticos, modos claro/oscuro, estados y exportación.
import { copyText, downloadFile } from '../core/export.js';
import { colorName } from '../core/names.js';
import {
    BRAND_ROLES, DEFAULT_NAMING, MODES, NAME_STYLES, NEUTRAL_ROLES, STATES, SYSTEM_EXPORTS, buildSystem, checkSystem,
    defaultSeeds, primitiveBases, primitiveName, semanticName
} from '../core/system.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { getState, subscribe } from '../core/store.js';
import { button, dropdown, segmented } from '../ui/controls.js';
import { colorField } from '../ui/color-editor.js';
import { debounce, h, icon, toast } from '../ui/dom.js';
import { buildTemplate } from '../ui/templates.js';

export function mount(root) {
    let manualSeeds = {};
    let naming = { ...DEFAULT_NAMING, aliases: {} };
    let overrides = { light: {}, dark: {} };
    let viewMode = 'light';
    let format = 'css';
    let sys = null;
    let refs = {};

    const seeds = () => ({ ...defaultSeeds(getState().palette), ...manualSeeds });
    const compute = () => { sys = buildSystem(seeds(), overrides); };

    // ---------- Edición de tokens ----------

    function setOverride(mode, role, state, hex) {
        if (state === null) (overrides[mode] ||= {})[role] = hex;
        else ((overrides[mode] ||= {})[role] ||= {})[state] = hex;
    }

    function tokenRow(mode, role, state) {
        const isBrand = BRAND_ROLES.includes(role);
        const value = isBrand ? sys.tokens[mode].brand[role][state] : sys.tokens[mode].neutral[role];
        const edited = isBrand ? Boolean(overrides[mode]?.[role]?.[state]) : Boolean(overrides[mode]?.[role]);
        const field = colorField({
            value, ariaLabel: semanticName(role, state === 'on' ? 'on' : state, naming),
            onChange: hex => {
                setOverride(mode, role, isBrand ? state : null, hex);
                row.classList.add('trow--edited');
                refreshOutputs();
            }
        });
        const row = h('div', { class: `trow ${edited ? 'trow--edited' : ''}` },
            h('code', { class: 'trow__name' }, `--${semanticName(role, isBrand ? (state === 'on' ? 'on' : state) : null, naming)}`),
            field.el);
        return row;
    }

    function renderTokens() {
        refs.tokens.replaceChildren(
            ...BRAND_ROLES.map(role => h('details', { class: 'tgroup' },
                h('summary', { class: 'tgroup__head' },
                    h('span', { class: 'tgroup__sw', style: { background: sys.tokens[viewMode].brand[role].default } }),
                    h('strong', null, t(`sys.role.${role}`)), h('span', { class: 'hint' }, colorName(sys.seeds[role], getLang())), icon('chevron', 16)),
                h('div', { class: 'tgroup__rows' }, [...STATES, 'on'].map(state => h('div', { class: 'tstate' },
                    h('small', { class: 'tstate__label' }, t(`sys.state.${state}`)), tokenRow(viewMode, role, state)))))),
            h('details', { class: 'tgroup', open: true },
                h('summary', { class: 'tgroup__head' }, h('span', { class: 'tgroup__sw', style: { background: sys.tokens[viewMode].neutral.surface } }),
                    h('strong', null, t('sys.neutrals')), icon('chevron', 16)),
                h('div', { class: 'tgroup__rows' }, NEUTRAL_ROLES.map(role => h('div', { class: 'tstate' },
                    h('small', { class: 'tstate__label' }, t(`sys.role.${role}`)), tokenRow(viewMode, role, null))))));
    }

    // ---------- Salidas derivadas ----------

    function renderChecks() {
        refs.checks.replaceChildren(...MODES.map(mode => h('div', { class: 'checks__col' },
            h('h4', { class: 'subtitle' }, t(`sys.mode.${mode}`)),
            checkSystem(sys, mode).map(r => h('div', { class: `check ${r.pass ? 'is-pass' : 'is-fail'}` },
                h('span', { class: 'check__sw', style: { background: r.bg, color: r.fg } }, 'Aa'),
                h('span', { class: 'check__label' }, t(`sys.check.${r.id}`)),
                h('span', { class: 'check__ratio' }, `${r.ratio.toFixed(2)} · ${r.min}:1`),
                icon(r.pass ? 'ok' : 'x', 16))))));
    }

    function rolesFor(mode) {
        const { brand, neutral } = sys.tokens[mode];
        return {
            primary: brand.primary.default, secondary: brand.secondary.default, accent: brand.accent.default,
            background: neutral.background, surface: neutral.surface, text: neutral.text, border: neutral.border
        };
    }

    function renderPreview() {
        refs.preview.replaceChildren(...MODES.map(mode => h('div', { class: 'sys-prev' },
            h('span', { class: 'sys-prev__label' }, t(`sys.mode.${mode}`)), buildTemplate('dashboard', rolesFor(mode)))));
    }

    function renderPrimitives() {
        const bases = primitiveBases(sys, naming);
        refs.primitives.replaceChildren(...Object.entries(sys.primitives).map(([key, scale]) => h('div', { class: 'prim' },
            h('span', { class: 'prim__name' }, bases[key]),
            h('div', { class: 'prim__strip' }, scale.map(s => h('button', {
                type: 'button', class: 'prim__step', style: { background: s.hex }, title: `${primitiveName(bases[key], s.step, naming)} · ${s.hex}`,
                'aria-label': `${primitiveName(bases[key], s.step, naming)} ${s.hex}`,
                onclick: async () => toast((await copyText(s.hex)) ? t('toast.copied') : t('toast.copyFailed'))
            }, h('span', null, s.step)))))));
    }

    const exportText = () => SYSTEM_EXPORTS[format].fn(sys, naming);

    function renderExport() {
        refs.code.textContent = exportText();
    }

    const refreshOutputs = debounce(() => {
        compute();
        renderChecks();
        renderPreview();
        renderPrimitives();
        renderExport();
    }, 80);

    function renderAll() {
        compute();
        renderSeeds();
        renderTokens();
        renderChecks();
        renderPreview();
        renderPrimitives();
        renderExport();
    }

    // ---------- Semillas y nomenclatura ----------

    function renderSeeds() {
        const current = seeds();
        refs.seeds.replaceChildren(...BRAND_ROLES.map(role => {
            const field = colorField({
                value: current[role], ariaLabel: t(`sys.role.${role}`),
                onChange: hex => {
                    manualSeeds[role] = hex;
                    overrides = { light: {}, dark: {} };
                    compute();
                    renderTokens();
                    refreshOutputs();
                }
            });
            return h('div', { class: 'field' }, h('span', { class: 'field__label' }, t(`sys.role.${role}`)), field.el);
        }));
    }

    function build() {
        root.replaceChildren();
        refs = {};
        refs.seeds = h('div', { class: 'seeds' });
        const resetSeeds = button({
            label: () => t('sys.fromPalette'), iconName: 'palette',
            onClick: () => { manualSeeds = {}; overrides = { light: {}, dark: {} }; renderAll(); }
        });
        const resetEdits = button({
            label: () => t('sys.resetEdits'), iconName: 'refresh',
            onClick: () => { overrides = { light: {}, dark: {} }; renderAll(); }
        });

        const prefix = h('input', { type: 'text', class: 'text-input', value: naming.prefix, maxlength: 16, 'aria-label': t('sys.prefix') });
        prefix.addEventListener('input', () => { naming.prefix = prefix.value.replace(/[^A-Za-z0-9_-]/g, ''); renderTokens(); refreshOutputs(); });
        const styleDd = dropdown({
            options: NAME_STYLES.map(s => ({ value: s, label: () => t(`sys.style.${s}`) })), value: naming.style, ariaLabel: t('sys.style'),
            onChange: v => { naming.style = v; renderTokens(); refreshOutputs(); }
        });
        const primDd = dropdown({
            options: ['hue', 'role'].map(s => ({ value: s, label: () => t(`sys.prim.${s}`) })), value: naming.primitives, ariaLabel: t('sys.primNaming'),
            onChange: v => { naming.primitives = v; refreshOutputs(); }
        });
        const aliasInputs = [...BRAND_ROLES, ...NEUTRAL_ROLES].map(role => {
            const input = h('input', { type: 'text', class: 'text-input', value: naming.aliases[role] || '', placeholder: role, maxlength: 24, 'aria-label': `${t('sys.alias')}: ${role}` });
            input.addEventListener('input', () => {
                const v = input.value.replace(/[^A-Za-z0-9_-]/g, '');
                if (v) naming.aliases[role] = v; else delete naming.aliases[role];
                renderTokens();
                refreshOutputs();
            });
            return h('label', { class: 'field' }, h('span', { class: 'field__label' }, t(`sys.role.${role}`)), input);
        });

        refs.tokens = h('div', { class: 'tokens' });
        const modeSeg = segmented({
            ariaLabel: t('sys.mode'), value: viewMode,
            options: MODES.map(m => ({ value: m, label: () => t(`sys.mode.${m}`) })),
            onChange: v => { viewMode = v; renderTokens(); }
        });
        refs.checks = h('div', { class: 'checks' });
        refs.preview = h('div', { class: 'sys-prevs' });
        refs.primitives = h('div', { class: 'prims' });

        const fmtDd = dropdown({
            options: Object.entries(SYSTEM_EXPORTS).map(([k, v]) => ({ value: k, label: v.label })), value: format, ariaLabel: t('gen.format'),
            onChange: v => { format = v; renderExport(); }
        });
        refs.code = h('pre', { class: 'code', tabindex: '0' });
        const copyBtn = button({
            label: () => t('gen.copyCode'), iconName: 'copy',
            onClick: async () => toast((await copyText(exportText())) ? t('toast.copied') : t('toast.copyFailed'))
        });
        const dlBtn = button({
            label: () => t('gen.downloadScale'), iconName: 'download',
            onClick: () => downloadFile(`color-system.${SYSTEM_EXPORTS[format].ext}`, exportText(), SYSTEM_EXPORTS[format].mime)
        });

        root.append(
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('sys.seeds')), h('p', { class: 'card__lead' }, t('sys.seedsLead')),
                refs.seeds, h('div', { class: 'btnrow' }, resetSeeds.el)),
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('sys.primitives')), h('p', { class: 'card__lead' }, t('sys.primitivesLead')), refs.primitives),
            h('div', { class: 'sys-grid' },
                h('section', { class: 'card' },
                    h('div', { class: 'sys-head' }, h('h3', { class: 'card__title' }, t('sys.semantic')), modeSeg.el, resetEdits.el),
                    h('p', { class: 'card__lead' }, t('sys.semanticLead')), refs.tokens),
                h('div', { class: 'sys-side' },
                    h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('sys.naming')),
                        h('div', { class: 'naming' },
                            h('label', { class: 'field' }, h('span', { class: 'field__label' }, t('sys.prefix')), prefix),
                            h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('sys.style')), styleDd.el),
                            h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('sys.primNaming')), primDd.el)),
                        h('details', { class: 'alias' }, h('summary', null, t('sys.aliases')), h('div', { class: 'alias__grid' }, aliasInputs))),
                    h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('sys.contrast')), refs.checks))),
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, t('sys.previewTitle')), refs.preview),
            h('section', { class: 'card' }, h('h3', { class: 'card__title' }, icon('code', 18), t('sys.export')),
                h('div', { class: 'toolbar__row' }, fmtDd.el, copyBtn.el, dlBtn.el), refs.code));
        renderAll();
    }

    build();
    onLangChange(build);
    subscribe((_, topic) => {
        if (topic !== 'palette' || !root.isConnected) return;
        // Los tokens editados a mano se conservan mientras no cambien las semillas
        renderAll();
    });
}
