// Internacionalización: español e inglés. Las claves faltantes caen al inglés y, en último término, a la propia clave.
import es from './es.js';
import en from './en.js';

const DICTIONARIES = { es, en };
export const LANGUAGES = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }];

const listeners = new Set();
let lang = 'en';

function read(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function initLang() {
    // ?lang=es|en (enlaces hreflang) tiene prioridad sobre la preferencia guardada
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    const stored = DICTIONARIES[fromUrl] ? fromUrl : read('lang');
    lang = DICTIONARIES[stored] ? stored : (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
    document.documentElement.lang = lang;
    return lang;
}

export const getLang = () => lang;

export function setLang(next) {
    if (!DICTIONARIES[next] || next === lang) return;
    lang = next;
    try {
        localStorage.setItem('lang', next);
    } catch { /* almacenamiento no disponible */ }
    document.documentElement.lang = next;
    listeners.forEach(fn => fn(next));
}

export const onLangChange = fn => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export function t(key, vars) {
    let text = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
    return text;
}
