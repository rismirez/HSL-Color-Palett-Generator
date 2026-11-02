// Accessibility: contraste WCAG, análisis de paletas, correcciones y simulación de daltonismo.
import {
    CVD_TYPES, WCAG, analyzePalette, evaluateContrast, readableOn, relativeLuminance, simulateCvd, suggestFixes
} from '../core/contrast.js';
import { colorName } from '../core/names.js';
import { hexToOklab, oklabDistance } from '../core/oklab-cache.js';
import { getLang, onLangChange, t } from '../i18n/index.js';
import { getState, setPalette, subscribe } from '../core/store.js';
import { button, segmented } from '../ui/controls.js';
import { colorField } from '../ui/color-editor.js';
import { h, icon, toast } from '../ui/dom.js';

const LEVELS = { AA: WCAG.aaNormal, AAA: WCAG.aaaNormal };

function defaultPair() {
    const sorted = getState().palette.slice().sort((a, b) => relativeLuminance(b) - relativeLuminance(a));
    return { bg: sorted[0], fg: sorted[sorted.length - 1] };
}

export function mount(root) {
    let { fg, bg } = defaultPair();
    let level = 'AA';
    let refs = {};

    // ---------- Comprobador de contraste ----------

    const badge = (ok, label) => h('div', { class: `badge ${ok ? 'badge--ok' : 'badge--bad'}` }, icon(ok ? 'ok' : 'x', 16), h('span', null, label));

    function renderChecker() {
        const e = evaluateContrast(fg, bg);
        refs.preview.style.background = bg;
        refs.preview.style.color = fg;
        refs.ratio.textContent = `${e.ratio.toFixed(2)} : 1`;
        const grade = e.aaaNormal ? 'AAA' : e.aaNormal ? 'AA' : e.aaLarge ? 'AA+' : '—';
        refs.grade.textContent = e.aaNormal ? t(`acc.grade.${grade}`) : e.aaLarge ? t('acc.grade.largeOnly') : t('acc.grade.fail');
        refs.grade.className = `checker__grade ${e.aaNormal ? 'is-ok' : e.aaLarge ? 'is-warn' : 'is-bad'}`;
        refs.badges.replaceChildren(
            badge(e.aaNormal, `AA · ${t('acc.normalText')} (4.5)`),
            badge(e.aaLarge, `AA · ${t('acc.largeText')} (3)`),
            badge(e.aaaNormal, `AAA · ${t('acc.normalText')} (7)`),
            badge(e.aaaLarge, `AAA · ${t('acc.largeText')} (4.5)`),
            badge(e.ui, `${t('acc.ui')} (3)`));

        const fixes = suggestFixes(fg, bg, LEVELS[level]);
        const failing = e.ratio < LEVELS[level];
        refs.fixes.replaceChildren(
            h('h4', { class: 'subtitle' }, t('acc.fixes')),
            !failing
                ? h('p', { class: 'hint' }, t('acc.noFixNeeded', { level }))
                : fixes.length
                    ? h('div', { class: 'fixes' }, fixes.map(f => h('div', { class: 'fix' },
                        h('div', { class: 'fix__sample', style: { background: f.bg, color: f.fg } }, 'Aa'),
                        h('div', { class: 'fix__info' }, h('strong', null, t(`acc.fix.${f.kind}`)), h('span', { class: 'hint' }, `${f.ratio.toFixed(2)} : 1 · ${f.fg.toUpperCase()} / ${f.bg.toUpperCase()}`)),
                        button({
                            label: () => t('acc.apply'), iconName: 'check', variant: 'ghost',
                            onClick: () => { fg = f.fg; bg = f.bg; fgField.setValue(fg); bgField.setValue(bg); renderChecker(); }
                        }).el)))
                    : h('p', { class: 'hint' }, t('acc.noFixFound')));
    }

    let fgField, bgField;

    // ---------- Análisis de la paleta ----------

    function renderAnalysis() {
        const { palette, locked } = getState();
        const { pairs, roles, issues } = analyzePalette(palette);
        const lookup = (i, j) => pairs.find(p => p.i === i && p.j === j);

        const head = h('tr', null, h('th', { scope: 'col', class: 'matrix__corner' }, h('span', { class: 'hint' }, `${t('acc.textRow')} ↓ / ${t('acc.bgCol')} →`)),
            palette.map((c, j) => h('th', { scope: 'col' }, h('span', { class: 'matrix__sw', style: { background: c }, title: c }))));
        const rows = palette.map((c, i) => h('tr', null,
            h('th', { scope: 'row' }, h('span', { class: 'matrix__sw', style: { background: c }, title: c })),
            palette.map((_, j) => {
                if (i === j) return h('td', { class: 'matrix__cell matrix__cell--self' }, '—');
                const p = lookup(i, j);
                const cls = p.aaaNormal ? 'aaa' : p.aaNormal ? 'aa' : p.aaLarge ? 'large' : 'fail';
                return h('td', null, h('button', {
                    type: 'button', class: `matrix__cell matrix__cell--${cls}`, style: { background: palette[j], color: palette[i] },
                    title: `${palette[i]} / ${palette[j]} · ${p.ratio.toFixed(2)}`,
                    'aria-label': `${palette[i]} / ${palette[j]}: ${p.ratio.toFixed(2)}`,
                    onclick: () => { fg = palette[i]; bg = palette[j]; fgField.setValue(fg); bgField.setValue(bg); renderChecker(); refs.checker.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                }, h('span', { class: 'matrix__aa' }, 'Aa'), h('span', { class: 'matrix__ratio' }, p.ratio.toFixed(1))));
            })));
        refs.matrix.replaceChildren(h('thead', null, head), h('tbody', null, rows));

        refs.roles.replaceChildren(...roles.map(r => h('div', { class: 'role' },
            h('span', { class: 'role__sw', style: { background: r.hex } }),
            h('div', { class: 'role__info' }, h('strong', null, colorName(r.hex, getLang())), h('span', { class: 'hint' }, r.hex.toUpperCase())),
            h('div', { class: 'role__tags' },
                tag(r.text, 'acc.role.text'), tag(r.background, 'acc.role.background'), tag(r.interactive, 'acc.role.interactive')))));

        // Parejas con contraste insuficiente y su corrección automática
        if (!issues.length) {
            refs.issues.replaceChildren(h('p', { class: 'hint badge--ok-text' }, icon('ok', 16), t('acc.allGood')));
            return;
        }
        refs.issues.replaceChildren(...issues.slice(0, 8).map(p => {
            const fixes = suggestFixes(p.fg, p.bg, WCAG.aaNormal).filter(f =>
                !((f.fg !== p.fg && locked[p.i]) || (f.bg !== p.bg && locked[p.j])));
            return h('div', { class: 'issue' },
                h('div', { class: 'issue__pair' },
                    h('span', { class: 'issue__sw', style: { background: p.bg, color: p.fg } }, 'Aa'),
                    h('div', { class: 'issue__info' }, h('strong', null, `${p.ratio.toFixed(2)} : 1`), h('span', { class: 'hint' }, `${p.fg.toUpperCase()} / ${p.bg.toUpperCase()}`))),
                h('div', { class: 'issue__fixes' }, fixes.length
                    ? fixes.slice(0, 2).map(f => h('button', {
                        type: 'button', class: 'btn btn--sm', title: `${f.ratio.toFixed(2)} : 1`,
                        onclick: () => {
                            const next = getState().palette.slice();
                            next[p.i] = f.fg;
                            next[p.j] = f.bg;
                            setPalette(next);
                            toast(t('acc.applied'));
                        }
                    }, h('span', { class: 'fix__mini', style: { background: f.bg, color: f.fg } }, 'Aa'), t(`acc.fix.${f.kind}`)))
                    : h('span', { class: 'hint' }, t('acc.noFixFound'))));
        }));
    }

    const tag = (on, key) => h('span', { class: `tag ${on ? 'tag--on' : ''}` }, on && icon('check', 12), t(key));

    // ---------- Daltonismo ----------

    function renderCvd() {
        const { palette } = getState();
        const rows = [['original', palette], ...CVD_TYPES.map(type => [type, palette.map(c => simulateCvd(c, type))])];
        refs.cvd.replaceChildren(...rows.map(([type, colors]) => h('div', { class: 'cvd' },
            h('span', { class: 'cvd__name' }, t(`cvd.${type}`)),
            h('div', { class: 'cvd__strip' }, colors.map(c => h('div', { class: 'cvd__seg', style: { background: c, color: readableOn(c) }, title: c }, h('span', null, c.slice(1).toUpperCase())))))));

        // Pares que se distinguen bien con visión normal pero se confunden bajo cada tipo de daltonismo
        const warnings = [];
        for (const type of CVD_TYPES) {
            const sim = palette.map(c => hexToOklab(simulateCvd(c, type)));
            const orig = palette.map(c => hexToOklab(c));
            for (let i = 0; i < palette.length; i++) {
                for (let j = i + 1; j < palette.length; j++) {
                    if (oklabDistance(orig[i], orig[j]) >= 0.06 && oklabDistance(sim[i], sim[j]) < 0.035) warnings.push({ type, i, j });
                }
            }
        }
        refs.cvdWarn.replaceChildren(warnings.length
            ? h('div', { class: 'warns' }, warnings.slice(0, 12).map(w => h('div', { class: 'warn' }, icon('warn', 16),
                h('span', null, t('cvd.confusable', { type: t(`cvd.${w.type}`), a: w.i + 1, b: w.j + 1 })),
                h('span', { class: 'warn__sw', style: { background: palette[w.i] } }), h('span', { class: 'warn__sw', style: { background: palette[w.j] } }))))
            : h('p', { class: 'hint badge--ok-text' }, icon('ok', 16), t('cvd.noneConfusable')));
    }

    function build() {
        root.replaceChildren();
        refs = {};
        refs.preview = h('div', { class: 'checker__preview' },
            h('p', { class: 'checker__large' }, t('acc.sampleLarge')), h('p', { class: 'checker__normal' }, t('acc.sampleText')),
            h('p', { class: 'checker__small' }, t('acc.sampleSmall')));
        refs.ratio = h('div', { class: 'checker__ratio' });
        refs.grade = h('div', { class: 'checker__grade' });
        refs.badges = h('div', { class: 'badges' });
        refs.fixes = h('div', { class: 'checker__fixes' });

        fgField = colorField({ value: fg, ariaLabel: t('acc.textColor'), onChange: v => { fg = v; renderChecker(); } });
        bgField = colorField({ value: bg, ariaLabel: t('acc.bgColor'), onChange: v => { bg = v; renderChecker(); } });
        const swap = h('button', {
            type: 'button', class: 'btn btn--icon', title: t('acc.swap'), 'aria-label': t('acc.swap'),
            onclick: () => { [fg, bg] = [bg, fg]; fgField.setValue(fg); bgField.setValue(bg); renderChecker(); }
        }, icon('swap', 16));
        const levelSeg = segmented({
            ariaLabel: t('acc.target'), value: level,
            options: [{ value: 'AA', label: 'AA (4.5)' }, { value: 'AAA', label: 'AAA (7)' }],
            onChange: v => { level = v; renderChecker(); }
        });

        refs.checker = h('section', { class: 'card' },
            h('h3', { class: 'card__title' }, t('acc.checker')),
            h('p', { class: 'card__lead' }, t('acc.checkerLead')),
            h('div', { class: 'checker' },
                h('div', { class: 'checker__inputs' },
                    h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('acc.textColor')), fgField.el),
                    swap,
                    h('div', { class: 'field' }, h('span', { class: 'field__label' }, t('acc.bgColor')), bgField.el),
                    h('div', { class: 'field checker__target' }, h('span', { class: 'field__label' }, t('acc.target')), levelSeg.el)),
                h('div', { class: 'checker__out' }, refs.preview,
                    h('div', { class: 'checker__result' }, refs.ratio, refs.grade, refs.badges)),
                refs.fixes));

        refs.matrix = h('table', { class: 'matrix' });
        refs.roles = h('div', { class: 'roles' });
        refs.issues = h('div', { class: 'issues' });
        const analysisCard = h('section', { class: 'card' },
            h('h3', { class: 'card__title' }, t('acc.analysis')),
            h('p', { class: 'card__lead' }, t('acc.analysisLead')),
            h('div', { class: 'matrix-wrap' }, refs.matrix),
            h('div', { class: 'legend' },
                h('span', null, h('i', { class: 'dot dot--aaa' }), 'AAA'), h('span', null, h('i', { class: 'dot dot--aa' }), 'AA'),
                h('span', null, h('i', { class: 'dot dot--large' }), t('acc.legendLarge')), h('span', null, h('i', { class: 'dot dot--fail' }), t('acc.legendFail'))),
            h('h4', { class: 'subtitle' }, t('acc.roles')), refs.roles,
            h('h4', { class: 'subtitle' }, t('acc.issues')), refs.issues);

        refs.cvd = h('div', { class: 'cvd-list' });
        refs.cvdWarn = h('div', { class: 'cvd-warn' });
        const cvdCard = h('section', { class: 'card' },
            h('h3', { class: 'card__title' }, t('cvd.title')), h('p', { class: 'card__lead' }, t('cvd.lead')),
            refs.cvd, h('h4', { class: 'subtitle' }, t('cvd.risks')), refs.cvdWarn);

        root.append(refs.checker, analysisCard, cvdCard);
        renderChecker();
        renderAnalysis();
        renderCvd();
    }

    build();
    onLangChange(build);
    subscribe((_, topic) => {
        if (topic === 'palette' && root.isConnected) {
            renderAnalysis();
            renderCvd();
        }
    });
}
