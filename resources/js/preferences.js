// Preferencias de idioma y tema (se carga en el <head> para evitar el parpadeo de tema)
const TRANSLATIONS = {
    es: {
        subtitle: 'Crea esquemas de color 🎨 hermosos que funcionan',
        themeAuto: 'Automático',
        themeDark: 'Oscuro',
        themeLight: 'Claro',
        selectColor: 'Seleccionar color',
        selectColorHint: 'Introduce un color hexadecimal o elígelo con el selector',
        hexPlaceholder: 'Código de color hexadecimal',
        or: 'o',
        generate: 'Generar',
        random: 'Color aleatorio',
        settings: 'Ajustes',
        tones: 'Número de tonos:',
        tonesHint: 'Número de colores por variante (más claros y más oscuros)',
        step: 'Paso de luminosidad:',
        stepHint: 'Porcentaje de luminosidad',
        tipsTitle: '💡 Consejos:',
        tipsBody: 'Si aumentas el «Número de tonos», un «Paso de luminosidad» menor mantiene la paleta equilibrada.',
        wcag: 'Analizador de contraste de color WCAG 2.1',
        selected: 'Color seleccionado',
        lighter: 'Colores más claros',
        darker: 'Colores más oscuros',
        share: 'Compartir URL',
        dlSvg: 'Descargar SVG',
        dlTxt: 'Descargar TXT',
        dlJson: 'Descargar JSON',
        dlCss: 'Descargar CSS',
        dlScss: 'Descargar SCSS',
        madeWith: 'Hecho con',
        by: 'por',
        toastHex: '¡Color hexadecimal copiado! 🎨',
        toastUrl: '¡URL para compartir copiada! 🔗',
        pageTitle: 'Generador de paletas de color HSL'
    },
    en: {
        subtitle: 'Create Beautiful Color 🎨 Schemes that works',
        themeAuto: 'Auto',
        themeDark: 'Dark',
        themeLight: 'Light',
        selectColor: 'Select color',
        selectColorHint: 'Enter a hex color or pick one from the color picker',
        hexPlaceholder: 'Hexadecimal color code',
        or: 'or',
        generate: 'Generate',
        random: 'Random color',
        settings: 'Settings',
        tones: 'Number of color tones:',
        tonesHint: 'Number of colors per shade (Lighter and Darker)',
        step: 'Lightness step:',
        stepHint: 'Percentage of Lightness',
        tipsTitle: '💡 Tips:',
        tipsBody: "If you increase the 'Number of color tones,' a smaller 'Lightness step' works best to keep the palette balanced.",
        wcag: 'WCAG 2.1 Color contrast analyzer',
        selected: 'Selected Color',
        lighter: 'Lighter colors',
        darker: 'Darker colors',
        share: 'Share URL',
        dlSvg: 'Download SVG',
        dlTxt: 'Download TXT',
        dlJson: 'Download JSON',
        dlCss: 'Download CSS',
        dlScss: 'Download SCSS',
        madeWith: 'Made with',
        by: 'by',
        toastHex: 'Hex color copied successfully! 🎨',
        toastUrl: 'Shareable URL copied successfully! 🔗',
        pageTitle: 'HSL Color Palette Generator'
    }
};

function readPref(key, fallback) {
    try {
        return localStorage.getItem(key) || fallback;
    } catch (e) {
        return fallback;
    }
}

function savePref(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) { /* almacenamiento no disponible */ }
}

let currentLang = readPref('lang', (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en');
if (!TRANSLATIONS[currentLang]) currentLang = 'en';
let currentTheme = readPref('theme', 'auto');

const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function t(key) {
    return TRANSLATIONS[currentLang][key] || TRANSLATIONS.en[key] || key;
}

function applyTheme(theme) {
    currentTheme = theme;
    const resolved = theme === 'auto' ? (colorSchemeQuery.matches ? 'dark' : 'light') : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0f1115' : '#f5f6f8');
}

function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.title = t('pageTitle');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
}

// El tema se aplica de inmediato; el idioma cuando el DOM está listo
applyTheme(currentTheme);
colorSchemeQuery.addEventListener('change', () => {
    if (currentTheme === 'auto') applyTheme('auto');
});

// Desplegable accesible propio (los <select> nativos no se pueden estilizar)
function initDropdown(root, initialValue, onChange) {
    const button = root.querySelector('.dropdown__button');
    const valueLabel = root.querySelector('.dropdown__value');
    const menu = root.querySelector('.dropdown__menu');
    const options = Array.from(menu.querySelectorAll('.dropdown__option'));
    let value = initialValue;
    let activeIndex = 0;

    function setActive(index) {
        activeIndex = (index + options.length) % options.length;
        options.forEach((opt, i) => opt.classList.toggle('dropdown__option--active', i === activeIndex));
        options[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function open() {
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        setActive(options.findIndex(opt => opt.dataset.value === value));
        menu.focus();
    }

    function close(returnFocus) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (returnFocus) button.focus();
    }

    function select(newValue) {
        value = newValue;
        refresh();
        onChange(value);
    }

    function refresh() {
        options.forEach(opt => {
            const selected = opt.dataset.value === value;
            opt.setAttribute('aria-selected', selected);
            opt.classList.toggle('dropdown__option--selected', selected);
        });
        valueLabel.textContent = options.find(opt => opt.dataset.value === value).textContent;
    }

    button.addEventListener('click', () => (menu.hidden ? open() : close(false)));

    options.forEach(opt => {
        opt.addEventListener('click', () => {
            select(opt.dataset.value);
            close(true);
        });
        opt.addEventListener('mousemove', () => setActive(options.indexOf(opt)));
    });

    menu.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(activeIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(activeIndex - 1);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            select(options[activeIndex].dataset.value);
            close(true);
        } else if (event.key === 'Escape' || event.key === 'Tab') {
            close(event.key === 'Escape');
        }
    });

    document.addEventListener('click', event => {
        if (!root.contains(event.target)) close(false);
    });

    refresh();
    return { refresh };
}

document.addEventListener('DOMContentLoaded', function () {
    applyLanguage(currentLang);

    const langDropdown = initDropdown(document.getElementById('langDropdown'), currentLang, lang => {
        savePref('lang', lang);
        applyLanguage(lang);
        themeDropdown.refresh();
    });

    const themeDropdown = initDropdown(document.getElementById('themeDropdown'), currentTheme, theme => {
        savePref('theme', theme);
        applyTheme(theme);
    });

    themeDropdown.refresh();
});
