// Preview Studio: la paleta aplicada a composiciones reales, con roles reasignables y simulación de visión.
import { autoRoles } from '../core/roles.js';
import { CVD_TYPES, contrastRatio } from '../core/contrast.js';
import { getState, subscribe } from '../core/store.js';
import { onLangChange, t } from '../i18n/index.js';
import { button, dropdown, segmented } from '../ui/controls.js';
import { colorField } from '../ui/color-editor.js';
import { cvdFilter, ensureCvdFilters } from '../ui/cvd-filters.js';
import { h, icon } from '../ui/dom.js';
import { ROLES, TEMPLATE_IDS, buildTemplate } from '../ui/templates.js';

export function mount(root) {
    let templateId = 'dashboard';
    let mode = 'light';
    let vision = 'none';
    let roles = autoRoles(getState().palette, mode);
    let manual = false; // true cuando el usuario ha reasignado algún rol a mano
    let refs = {};

    function recompute() {
        if (!manual) roles = autoRoles(getState().palette, mode);
    }

    function renderPreview() {
        const el = buildTemplate(templateId, roles);
        el.style.filter = cvdFilter(vision);
        refs.stage.replaceChildren(el);
        // Aviso de contraste del par más importante (texto sobre fondo)
        const ratio = contrastRatio(roles.text, roles.background);
        refs.note.textContent = t('prev.textContrast', { ratio: ratio.toFixed(2) });
        refs.note.className = `prev__note ${ratio >= 4.5 ? 'is-ok' : 'is-bad'}`;
    }

    function renderRoles() {
        const { palette } = getState();
        refs.roles.replaceChildren(...ROLES.map(role => {
            const field = colorField({
                value: roles[role], ariaLabel: t(`prev.role.${role}`),
                onChange: hex => { roles[role] = hex; manual = true; renderPreview(); }
            });
            const chips = h('div', { class: 'role-chips' }, palette.map(c => h('button', {
                type: 'button', class: `role-chip ${c === roles[role] ? 'is-on' : ''}`, style: { background: c }, title: c, 'aria-label': `${t(`prev.role.${role}`)}: ${c}`,
                onclick: () => { roles[role] = c; manual = true; field.setValue(c); renderRoles(); renderPreview(); }
            })));
            return h('div', { class: 'role-row' },
                h('div', { class: 'role-row__head' }, h('strong', null, t(`prev.role.${role}`)), h('small', { class: 'hint' }, t(`prev.roleHint.${role}`))),
                field.el, chips);
        }));
    }

    function build() {
        root.replaceChildren();
        refs = {};
        ensureCvdFilters();
        const tplDd = dropdown({
            options: TEMPLATE_IDS.map(id => ({ value: id, label: () => t(`prev.tpl.${id}`) })), value: templateId, iconName: 'monitor', ariaLabel: t('prev.template'),
            onChange: v => { templateId = v; renderPreview(); }
        });
        const modeSeg = segmented({
            ariaLabel: t('prev.mode'), value: mode,
            options: [{ value: 'light', label: () => t('prev.light') }, { value: 'dark', label: () => t('prev.dark') }],
            onChange: v => { mode = v; manual = false; recompute(); renderRoles(); renderPreview(); }
        });
        const visionDd = dropdown({
            options: [{ value: 'none', label: () => t('prev.visionNormal') }, ...CVD_TYPES.map(v => ({ value: v, label: () => t(`cvd.${v}`) }))],
            value: vision, iconName: 'eye', ariaLabel: t('prev.vision'),
            onChange: v => { vision = v; renderPreview(); }
        });
        const autoBtn = button({
            label: () => t('prev.auto'), iconName: 'sparkle',
            onClick: () => { manual = false; recompute(); renderRoles(); renderPreview(); }
        });
        refs.stage = h('div', { class: 'prev__stage' });
        refs.note = h('p', { class: 'prev__note' });
        refs.roles = h('div', { class: 'roles-edit' });
        root.append(
            h('section', { class: 'card toolbar-lite' },
                h('div', { class: 'toolbar__row' }, tplDd.el, modeSeg.el, visionDd.el, autoBtn.el),
                h('p', { class: 'hint' }, t('prev.lead'))),
            h('div', { class: 'prev' },
                h('section', { class: 'card prev__roles' }, h('h3', { class: 'card__title' }, icon('sliders', 18), t('prev.roles')), refs.roles),
                h('section', { class: 'card prev__view' }, refs.stage, refs.note)));
        renderRoles();
        renderPreview();
    }

    build();
    onLangChange(build);
    subscribe((_, topic) => {
        if (topic !== 'palette' || !root.isConnected) return;
        recompute();
        renderRoles();
        renderPreview();
    });
}
