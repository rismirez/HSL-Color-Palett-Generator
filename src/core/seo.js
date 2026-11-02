// Metadatos dinámicos: la aplicación es de una sola página, así que título, descripción, Open Graph y canonical
// se actualizan al cambiar de idioma o de módulo (la versión estática de index.html está en inglés).
import { getLang, t } from '../i18n/index.js';

const LOCALES = { en: 'en_US', es: 'es_ES' };

function setContent(selector, value) {
    document.querySelector(selector)?.setAttribute('content', value);
}

export function seoFor(module, translate = t) {
    if (module === 'generator') return { title: translate('seo.title'), description: translate('seo.description') };
    return {
        title: `${translate(`seo.module.${module}.title`)} | ${translate('seo.suffix')}`,
        description: translate(`seo.module.${module}.description`)
    };
}

export function applySeo(module) {
    const lang = getLang();
    const { title, description } = seoFor(module);
    document.title = title;
    setContent('meta[name="description"]', description);
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) setContent(selector, title);
    for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) setContent(selector, description);
    setContent('meta[property="og:locale"]', LOCALES[lang] || LOCALES.en);
    setContent('meta[property="og:locale:alternate"]', LOCALES[lang === 'es' ? 'en' : 'es']);

    // Si la URL fija el idioma (?lang=xx) el canonical apunta a esa versión; si no, a la raíz
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
        const origin = new URL(canonical.href).origin;
        const explicit = new URLSearchParams(window.location.search).has('lang');
        const href = explicit ? `${origin}/?lang=${lang}` : `${origin}/`;
        canonical.setAttribute('href', href);
        setContent('meta[property="og:url"]', href);
    }
}

/** Mantiene ?lang= sincronizado cuando ya estaba presente en la URL. */
export function syncLangParam(lang) {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('lang')) return;
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
}
