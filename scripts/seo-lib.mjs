// Contenido SEO/GEO compartido por el build y las pruebas: sustituye marcadores en index.html y genera
// robots.txt, sitemap.xml, llms.txt y manifest.webmanifest a partir de seo/ y del diccionario en inglés.
import fs from 'node:fs';
import path from 'node:path';
import en from '../src/i18n/en.js';

const ROOT = path.resolve(import.meta.dirname, '..');

export const DEFAULT_SITE = 'https://hsl-color.ramirezchristian.com';
export const SEO_FILES = ['robots.txt', 'sitemap.xml', 'llms.txt', 'manifest.webmanifest'];
export const MIME = {
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8'
};
export const AUTHOR = { name: 'Rismirez', url: 'https://www.rismirez.com/', sameAs: ['https://x.com/Rismirez'] };
export const FEATURE_COUNT = 8;
export const FAQ_COUNT = 7;

export const normalizeSite = url => String(url || DEFAULT_SITE).trim().replace(/\/+$/, '');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const range = n => Array.from({ length: n }, (_, i) => i + 1);

export const features = () => range(FEATURE_COUNT).map(i => en[`about.feature.${i}`]);
export const faq = () => range(FAQ_COUNT).map(i => ({ question: en[`faq.q${i}`], answer: en[`faq.a${i}`] }));

/** Datos estructurados (schema.org). Todo el texto procede del diccionario, igual que el contenido visible. */
export function jsonLd(site) {
    const author = { '@id': `${site}/#author` };
    const image = `${site}/img/og-image.jpg`;
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebSite',
                '@id': `${site}/#website`,
                url: `${site}/`,
                name: en['seo.suffix'],
                description: en['seo.description'],
                inLanguage: ['en', 'es'],
                publisher: author
            },
            {
                '@type': 'WebApplication',
                '@id': `${site}/#app`,
                url: `${site}/`,
                name: en['seo.suffix'],
                description: en['seo.description'],
                applicationCategory: 'DesignApplication',
                applicationSubCategory: 'Color palette generator',
                operatingSystem: 'Any (web browser)',
                browserRequirements: 'Requires JavaScript and a modern web browser',
                isAccessibleForFree: true,
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                featureList: features(),
                inLanguage: ['en', 'es'],
                image,
                screenshot: image,
                author,
                publisher: author,
                keywords: 'color palette generator, OKLCH, WCAG contrast checker, color blindness simulator, design tokens, gradient generator, color extractor',
                softwareVersion: '2.0.0'
            },
            { '@type': 'Person', '@id': `${site}/#author`, name: AUTHOR.name, url: AUTHOR.url, sameAs: AUTHOR.sameAs },
            {
                '@type': 'FAQPage',
                '@id': `${site}/#faq`,
                inLanguage: 'en',
                mainEntity: faq().map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } }))
            }
        ]
    };
}

// Se escapa "<" para que ningún texto pueda cerrar la etiqueta <script>
export const jsonLdScript = site =>
    `<script type="application/ld+json">${JSON.stringify(jsonLd(site)).replace(/</g, '\\u003c')}</script>`;

/** HTML estático para rastreadores que no ejecutan JavaScript; la aplicación lo sustituye al arrancar. */
export function fallbackHtml() {
    const items = features().map(f => `<li>${esc(f)}</li>`).join('');
    const questions = faq().map(f => `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>`).join('');
    return `<article class="seo-fallback"><h1>${esc(en['seo.suffix'])}</h1><p>${esc(en['about.intro'])}</p>` +
        `<h2>${esc(en['about.featuresTitle'])}</h2><ul>${items}</ul><h2>${esc(en['about.faqTitle'])}</h2>${questions}</article>`;
}

export function renderIndex(html, site) {
    return html
        .replaceAll('<!--SEO:JSONLD-->', jsonLdScript(site))
        .replaceAll('<!--SEO:FALLBACK-->', fallbackHtml())
        .replaceAll('%SEO_TITLE%', esc(en['seo.title']))
        .replaceAll('%SEO_DESCRIPTION%', esc(en['seo.description']))
        .replaceAll('%SITE_URL%', site);
}

export function renderFile(name, site, date = new Date()) {
    const source = fs.readFileSync(path.join(ROOT, 'seo', name), 'utf8');
    return source
        .replaceAll('%SITE_URL%', site)
        .replaceAll('%DATE%', date.toISOString().slice(0, 10))
        .replaceAll('%DESCRIPTION%', en['seo.description'].replace(/"/g, '\\"'));
}
