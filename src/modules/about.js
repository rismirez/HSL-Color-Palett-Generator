// Página "Acerca de" con funciones y preguntas frecuentes. Es el mismo contenido que se publica como
// FAQPage en el JSON-LD de index.html (en inglés), de modo que lo estructurado coincide con lo que se ve.
import { onLangChange, t } from '../i18n/index.js';
import { h, icon } from '../ui/dom.js';

const FEATURES = 8;
const QUESTIONS = 7;
const range = n => Array.from({ length: n }, (_, i) => i + 1);

export function mount(root) {
    function render() {
        root.replaceChildren(h('section', { class: 'card about', 'aria-labelledby': 'about-title' },
            h('h2', { class: 'card__title', id: 'about-title' }, t('about.title')),
            h('p', { class: 'about__intro' }, t('about.intro')),
            h('h3', { class: 'about__sub' }, t('about.featuresTitle')),
            h('ul', { class: 'about__features' }, range(FEATURES).map(i => h('li', null, t(`about.feature.${i}`)))),
            h('h3', { class: 'about__sub' }, t('about.faqTitle')),
            h('div', { class: 'faq' }, range(QUESTIONS).map(i => h('details', { class: 'faq__item' },
                h('summary', { class: 'faq__q' }, t(`faq.q${i}`), icon('chevron', 16)),
                h('p', { class: 'faq__a' }, t(`faq.a${i}`)))))));
    }
    render();
    onLangChange(render);
}
