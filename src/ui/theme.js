// Tema: automático (sigue el sistema), claro u oscuro.
const query = window.matchMedia('(prefers-color-scheme: dark)');
let theme = 'auto';
const listeners = new Set();

function read() {
    try {
        return localStorage.getItem('theme');
    } catch {
        return null;
    }
}

function resolved() {
    return theme === 'auto' ? (query.matches ? 'dark' : 'light') : theme;
}

function apply() {
    const mode = resolved();
    document.documentElement.setAttribute('data-theme', mode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0f1115' : '#f5f6f8');
    listeners.forEach(fn => fn(mode));
}

export function initTheme() {
    const stored = read();
    theme = ['auto', 'dark', 'light'].includes(stored) ? stored : 'auto';
    apply();
    query.addEventListener('change', () => theme === 'auto' && apply());
    return theme;
}

export const getTheme = () => theme;
export const getResolvedTheme = resolved;

export function setTheme(next) {
    if (!['auto', 'dark', 'light'].includes(next)) return;
    theme = next;
    try {
        localStorage.setItem('theme', next);
    } catch { /* almacenamiento no disponible */ }
    apply();
}

export const onThemeChange = fn => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
