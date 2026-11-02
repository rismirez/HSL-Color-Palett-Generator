// Punto de entrada: cabecera, navegación entre módulos (carga diferida) y estado compartido.
import './styles/base.css';
import './styles/shell.css';
import './styles/modules.css';
import './styles/tools.css';
import './styles/cursor.css';
import { LANGUAGES, getLang, initLang, onLangChange, setLang, t } from './i18n/index.js';
import { applyShareUrl, getState, loadState, setState, subscribe, MODULES } from './core/store.js';
import { dropdown } from './ui/controls.js';
import { h, icon } from './ui/dom.js';
import { initIconAnimations } from './ui/icons.js';
import { applySeo, syncLangParam } from './core/seo.js';
import { getTheme, initTheme, setTheme } from './ui/theme.js';

const MODULE_ICONS = {
    generator: 'palette', extractor: 'image', accessibility: 'access', preview: 'monitor', systems: 'layers', lab: 'flask', about: 'info'
};

// Cada módulo se descarga la primera vez que se abre; después se conserva montado para no perder su estado.
const LOADERS = {
    generator: () => import('./modules/generator.js'),
    extractor: () => import('./modules/extractor.js'),
    accessibility: () => import('./modules/accessibility.js'),
    preview: () => import('./modules/preview.js'),
    systems: () => import('./modules/systems.js'),
    lab: () => import('./modules/lab.js'),
    about: () => import('./modules/about.js')
};

initLang();
initTheme();
loadState();
applyShareUrl();

const app = document.getElementById('app');
const panels = {};
const navButtons = {};

function buildHeader() {
    const langDd = dropdown({
        options: LANGUAGES, value: getLang(), iconName: 'globe', ariaLabel: t('header.language'), align: 'right',
        onChange: setLang
    });
    const themeDd = dropdown({
        options: [
            { value: 'auto', label: () => t('theme.auto') },
            { value: 'dark', label: () => t('theme.dark') },
            { value: 'light', label: () => t('theme.light') }
        ],
        value: getTheme(), iconName: 'contrast', ariaLabel: t('header.theme'), align: 'right', onChange: setTheme
    });
    onLangChange(() => {
        themeDd.refresh();
        themeDd.setAriaLabel(t('header.theme'));
        langDd.setAriaLabel(t('header.language'));
        subtitle.textContent = t('app.subtitle');
        document.querySelector('.nav').setAttribute('aria-label', t('nav.label'));
        Object.entries(navButtons).forEach(([id, b]) => { b.label.textContent = t(`nav.${id}`); });
    });

    const subtitle = h('p', { class: 'header__subtitle' }, t('app.subtitle'));
    return h('header', { class: 'header' },
        h('div', { class: 'header__brand' },
            h('img', { class: 'header__logo', src: `${import.meta.env.BASE_URL}img/favicon.png`, alt: '', width: 40, height: 40 }),
            h('div', { class: 'header__text' }, h('h1', { class: 'header__title' }, 'Magic Color Tools'), subtitle)),
        h('div', { class: 'header__controls' }, langDd.el, themeDd.el));
}

function buildNav() {
    const nav = h('nav', { class: 'nav', 'aria-label': t('nav.label') });
    for (const id of MODULES) {
        const label = h('span', { class: 'nav__label' }, t(`nav.${id}`));
        const btn = h('button', { type: 'button', class: 'nav__btn', dataset: { module: id } }, icon(MODULE_ICONS[id], 18), label);
        btn.addEventListener('click', () => setState({ module: id }, 'module'));
        navButtons[id] = { btn, label };
        nav.append(btn);
    }
    return nav;
}

const loading = new Set();

async function showModule(id) {
    for (const [mid, { btn }] of Object.entries(navButtons)) {
        btn.classList.toggle('nav__btn--on', mid === id);
        btn.setAttribute('aria-current', mid === id ? 'page' : 'false');
    }
    for (const [pid, el] of Object.entries(panels)) el.hidden = pid !== id;
    if (panels[id] || loading.has(id)) return;
    loading.add(id);
    const panel = h('section', { class: 'panel-module', id: `mod-${id}`, 'aria-label': t(`nav.${id}`) }, h('p', { class: 'loading' }, t('app.loading')));
    panels[id] = panel;
    main.append(panel);
    try {
        const mod = await LOADERS[id]();
        panel.replaceChildren();
        mod.mount(panel);
    } catch (err) {
        console.error(err);
        panel.replaceChildren(h('p', { class: 'loading' }, t('app.error')));
    } finally {
        loading.delete(id);
        panel.hidden = getState().module !== id;
    }
}

const main = h('main', { class: 'main', id: 'main-content' });
const footer = h('footer', { class: 'footer' },
    h('p', { class: 'footer__text' }, '© 2025 | ', h('span', { 'data-i18n': 'footer.made' }, t('footer.made')), ' ',
        h('span', { class: 'footer__heart' }, icon('heart', 15)), ' ',
        h('span', { 'data-i18n': 'footer.by' }, t('footer.by')), ' ',
        h('a', { href: 'https://www.rismirez.com/', target: '_blank', rel: 'noopener noreferrer', class: 'rismirez' }, 'Rismirez')));

onLangChange(() => {
    footer.querySelector('[data-i18n="footer.made"]').textContent = t('footer.made');
    footer.querySelector('[data-i18n="footer.by"]').textContent = t('footer.by');
});

onLangChange(() => {
    applySeo(getState().module);
    syncLangParam(getLang());
});

// replaceChildren sustituye el contenido estático de index.html pensado para rastreadores sin JavaScript
app.replaceChildren(h('div', { class: 'shell' }, buildHeader(), buildNav(), main, footer));
showModule(getState().module);
applySeo(getState().module);
initIconAnimations();

subscribe((state, topic) => {
    if (topic === 'module') {
        showModule(state.module);
        applySeo(state.module);
        const url = new URL(window.location.href);
        url.searchParams.set('m', state.module);
        history.replaceState(null, '', url);
    }
});
