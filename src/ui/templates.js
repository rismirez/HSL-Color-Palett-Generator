// Plantillas de Preview Studio: composiciones reales cuyos colores salen de los roles asignados.
import { mixColors } from '../core/color.js';
import { readableOn } from '../core/contrast.js';
import { t } from '../i18n/index.js';
import { h } from './dom.js';

export const ROLES = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'border'];
export const TEMPLATE_IDS = ['dashboard', 'mobile', 'corporate', 'ecommerce', 'landing', 'branding', 'editorial', 'game'];

// Variables CSS de un conjunto de roles (más los derivados necesarios para el texto sobre cada color).
export function rolesStyle(roles) {
    return {
        '--primary': roles.primary, '--secondary': roles.secondary, '--accent': roles.accent,
        '--background': roles.background, '--surface': roles.surface, '--text': roles.text, '--border': roles.border,
        '--on-primary': readableOn(roles.primary), '--on-secondary': readableOn(roles.secondary), '--on-accent': readableOn(roles.accent),
        '--muted': mixColors(roles.text, roles.background, 0.45, 'oklch')
    };
}

const bars = (values, cls) => h('div', { class: 'tpl-bars' }, values.map((v, i) => h('span', { class: `${cls}${i % 3 === 1 ? ' is-2' : i % 3 === 2 ? ' is-3' : ''}`, style: { height: `${v}%` } })));
const line = (w = 100) => h('i', { class: 'tpl-line', style: { width: `${w}%` } });

const builders = {
    dashboard: () => h('div', { class: 'tpl-dash' },
        h('aside', { class: 'tpl-dash__side' }, h('b', { class: 'tpl-logo' }, 'Acme'),
            ['Overview', 'Reports', 'Customers', 'Settings'].map((x, i) => h('span', { class: `tpl-nav ${i === 0 ? 'is-on' : ''}` }, x))),
        h('div', { class: 'tpl-dash__main' },
            h('div', { class: 'tpl-bar' }, h('strong', null, t('tpl.overview')), h('span', { class: 'tpl-btn' }, t('tpl.export'))),
            h('div', { class: 'tpl-kpis' }, [['tpl.revenue', '$48.2k', '+12%'], ['tpl.users', '8,420', '+4%'], ['tpl.orders', '1,284', '-2%']].map(([k, v, d]) =>
                h('div', { class: 'tpl-card' }, h('small', { class: 'tpl-muted' }, t(k)), h('strong', { class: 'tpl-big' }, v), h('span', { class: 'tpl-chip' }, d)))),
            h('div', { class: 'tpl-grid2' },
                h('div', { class: 'tpl-card' }, h('small', { class: 'tpl-muted' }, t('tpl.growth')), bars([40, 65, 50, 80, 60, 92, 70, 85], 'tpl-bar-i')),
                h('div', { class: 'tpl-card' }, h('small', { class: 'tpl-muted' }, t('tpl.recent')), [80, 65, 90, 55].map(w => h('div', { class: 'tpl-row' }, h('i', { class: 'tpl-dot' }), line(w))))))),

    mobile: () => h('div', { class: 'tpl-phone-wrap' }, h('div', { class: 'tpl-phone' },
        h('div', { class: 'tpl-phone__head' }, h('strong', null, t('tpl.hello')), h('span', { class: 'tpl-avatar' })),
        h('div', { class: 'tpl-phone__body' },
            h('div', { class: 'tpl-hero-card' }, h('small', null, t('tpl.balance')), h('strong', { class: 'tpl-big' }, '$2,480')),
            [1, 2, 3].map(i => h('div', { class: 'tpl-card tpl-row-card' }, h('i', { class: 'tpl-dot' }), h('div', { class: 'tpl-grow' }, line(70), line(40)), h('b', { class: 'tpl-accent-text' }, `+${i * 12}`)))),
        h('span', { class: 'tpl-fab' }, '+'),
        h('div', { class: 'tpl-tabs' }, [0, 1, 2, 3].map(i => h('i', { class: `tpl-tab ${i === 0 ? 'is-on' : ''}` }))))),

    corporate: () => h('div', { class: 'tpl-web' },
        h('nav', { class: 'tpl-web__nav' }, h('b', { class: 'tpl-logo' }, 'Acme'), h('span', { class: 'tpl-grow' }), ['Product', 'Company', 'Contact'].map(x => h('span', { class: 'tpl-link' }, x)), h('span', { class: 'tpl-btn' }, t('tpl.start'))),
        h('header', { class: 'tpl-web__hero' }, h('h2', null, t('tpl.headline')), h('p', { class: 'tpl-muted' }, t('tpl.body')),
            h('div', { class: 'tpl-btns' }, h('span', { class: 'tpl-btn' }, t('tpl.start')), h('span', { class: 'tpl-btn tpl-btn--ghost' }, t('tpl.learn')))),
        h('div', { class: 'tpl-grid3' }, [0, 1, 2].map(i => h('div', { class: 'tpl-card' }, h('i', { class: `tpl-icon is-${i}` }), h('strong', null, t(`tpl.feature${i + 1}`)), line(90), line(65)))),
        h('footer', { class: 'tpl-web__foot' }, h('small', null, '© Acme'))),

    ecommerce: () => h('div', { class: 'tpl-shop' },
        h('nav', { class: 'tpl-web__nav' }, h('b', { class: 'tpl-logo' }, 'Shop'), h('span', { class: 'tpl-search' }, t('tpl.search')), h('span', { class: 'tpl-btn' }, t('tpl.cart'))),
        h('div', { class: 'tpl-shop__filters' }, ['All', 'New', 'Sale', 'Popular'].map((x, i) => h('span', { class: `tpl-pill ${i === 0 ? 'is-on' : ''}` }, x))),
        h('div', { class: 'tpl-grid3' }, [0, 1, 2].map(i => h('div', { class: 'tpl-card tpl-product' },
            h('div', { class: `tpl-img is-${i}` }), h('strong', null, `${t('tpl.product')} ${i + 1}`), h('div', { class: 'tpl-price' }, h('b', { class: 'tpl-accent-text' }, `$${(i + 2) * 19}.00`), i === 1 && h('span', { class: 'tpl-tag' }, t('tpl.sale'))),
            h('span', { class: 'tpl-btn' }, t('tpl.addCart')))))),

    landing: () => h('div', { class: 'tpl-land' },
        h('header', { class: 'tpl-land__hero' }, h('small', { class: 'tpl-tag' }, t('tpl.new')), h('h2', null, t('tpl.headline')), h('p', null, t('tpl.body')),
            h('div', { class: 'tpl-btns' }, h('span', { class: 'tpl-btn tpl-btn--accent' }, t('tpl.start')), h('span', { class: 'tpl-btn tpl-btn--ghost tpl-btn--light' }, t('tpl.learn')))),
        h('div', { class: 'tpl-grid3' }, [0, 1, 2].map(i => h('div', { class: 'tpl-card' }, h('i', { class: `tpl-icon is-${i}` }), h('strong', null, t(`tpl.feature${i + 1}`)), line(90)))),
        h('div', { class: 'tpl-card tpl-price-card' }, h('small', { class: 'tpl-muted' }, t('tpl.pricing')), h('strong', { class: 'tpl-big' }, '$29'), h('span', { class: 'tpl-btn' }, t('tpl.start')))),

    branding: () => h('div', { class: 'tpl-brand' },
        h('div', { class: 'tpl-brand__logo' }, h('span', { class: 'tpl-mark' }, h('i'), h('i'), h('i')), h('strong', { class: 'tpl-wordmark' }, 'Acme')),
        h('div', { class: 'tpl-brand__cards' },
            h('div', { class: 'tpl-bcard tpl-bcard--front' }, h('b', { class: 'tpl-wordmark' }, 'Acme'), h('small', null, 'Studio')),
            h('div', { class: 'tpl-bcard tpl-bcard--back' }, h('strong', null, 'Alex Rivera'), h('small', { class: 'tpl-muted' }, 'Creative Director'), line(60), line(45))),
        h('div', { class: 'tpl-brand__swatches' }, ['primary', 'secondary', 'accent', 'surface', 'text'].map(r => h('span', { class: `tpl-sw tpl-sw--${r}` }, r))),
        h('p', { class: 'tpl-type' }, h('strong', null, 'Aa'), h('span', { class: 'tpl-muted' }, ' Bb Cc 123'))),

    editorial: () => h('div', { class: 'tpl-poster' },
        h('div', { class: 'tpl-poster__top' }, h('small', null, 'VOL. 07 — 2025'), h('small', null, 'Editorial')),
        h('h2', { class: 'tpl-poster__title' }, t('tpl.editorialTitle')),
        h('div', { class: 'tpl-poster__shapes' }, h('i', { class: 'tpl-circle' }), h('i', { class: 'tpl-bar-shape' }), h('i', { class: 'tpl-tri' })),
        h('p', { class: 'tpl-poster__sub' }, t('tpl.editorialSub')), h('div', { class: 'tpl-poster__foot' }, line(40), h('b', null, '→'))),

    game: () => h('div', { class: 'tpl-game' },
        h('div', { class: 'tpl-game__hud' },
            h('div', { class: 'tpl-meter' }, h('small', null, t('tpl.health')), h('span', { class: 'tpl-meter__bar is-1' }, h('i', { style: { width: '72%' } }))),
            h('div', { class: 'tpl-meter' }, h('small', null, t('tpl.mana')), h('span', { class: 'tpl-meter__bar is-2' }, h('i', { style: { width: '45%' } }))),
            h('b', { class: 'tpl-score' }, `${t('tpl.score')} 012,480`)),
        h('div', { class: 'tpl-game__menu' }, h('h2', null, 'NOVA QUEST'), h('span', { class: 'tpl-btn' }, t('tpl.play')), h('span', { class: 'tpl-btn tpl-btn--ghost' }, t('tpl.options'))),
        h('div', { class: 'tpl-game__inv' }, [0, 1, 2, 3, 4].map(i => h('span', { class: `tpl-slot ${i === 1 ? 'is-on' : ''}` }))))
};

export function buildTemplate(id, roles) {
    return h('div', { class: `tpl tpl--${id}`, style: rolesStyle(roles) }, builders[id]());
}
