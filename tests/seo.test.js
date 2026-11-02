import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import en from '../src/i18n/en.js';
import es from '../src/i18n/es.js';
import { MODULES } from '../src/core/store.js';
import { seoFor } from '../src/core/seo.js';
import {
    DEFAULT_SITE, FAQ_COUNT, FEATURE_COUNT, SEO_FILES, faq, jsonLd, normalizeSite, renderFile, renderIndex
} from '../scripts/seo-lib.mjs';

const SITE = 'https://example.test';
const html = renderIndex(readFileSync('index.html', 'utf8'), SITE);
const meta = (attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];

function imageSize(file) {
    const b = readFileSync(file);
    if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)]; // PNG: IHDR
    let o = 2; // JPEG: primer marcador SOF
    while (o < b.length) {
        const marker = b[o + 1];
        if (marker >= 0xc0 && marker <= 0xc3) return [b.readUInt16BE(o + 7), b.readUInt16BE(o + 5)];
        o += 2 + b.readUInt16BE(o + 2);
    }
    throw new Error('dimensiones no encontradas');
}

test('index.html: marcadores resueltos y etiquetas esenciales', () => {
    assert.ok(!/%[A-Z_]+%/.test(html), 'quedan marcadores sin sustituir');
    assert.ok(!html.includes('<!--SEO:'), 'quedan marcadores SEO');
    assert.match(html, /<html lang="en"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.test\/">/);
    for (const lang of ['en', 'es', 'x-default']) assert.match(html, new RegExp(`hreflang="${lang}"`));
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(html, /<meta name="viewport" content="[^"]*initial-scale=1/);
    assert.match(meta('name', 'robots'), /index, follow/);
    assert.match(meta('name', 'theme-color'), /^#[0-9a-f]{6}$/i);
    assert.ok(meta('name', 'description'));
    assert.match(html, /rel="apple-touch-icon"/);
    assert.match(html, /rel="sitemap"/);
    assert.match(html, /llms\.txt/);
});

test('título y descripción con longitud útil para buscadores', () => {
    for (const [name, dict] of [['en', en], ['es', es]]) {
        assert.ok(dict['seo.title'].length <= 65, `${name} título: ${dict['seo.title'].length}`);
        assert.ok(dict['seo.description'].length >= 70 && dict['seo.description'].length <= 160, `${name} descripción`);
        for (const m of MODULES) {
            const { title, description } = seoFor(m, key => dict[key]);
            assert.ok(title.length <= 90, `${name} ${m} título ${title.length}`);
            assert.ok(description.length >= 70 && description.length <= 160, `${name} ${m} descripción ${description.length}`);
        }
    }
    assert.equal(meta('property', 'og:title'), en['seo.title'].replaceAll('&', '&amp;'));
});

test('Open Graph y Twitter Cards completos con imagen absoluta', () => {
    for (const p of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:locale', 'og:locale:alternate']) {
        assert.ok(meta('property', p), `falta ${p}`);
    }
    for (const n of ['twitter:card', 'twitter:site', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
        assert.ok(meta('name', n), `falta ${n}`);
    }
    assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
    assert.match(meta('property', 'og:image'), /^https:\/\/example\.test\/img\/og-image\.jpg$/);
    assert.equal(meta('name', 'twitter:image'), meta('property', 'og:image'));
    assert.equal(meta('property', 'og:image:width'), '1200');
    assert.equal(meta('property', 'og:image:height'), '630');
    assert.deepEqual(imageSize('public/img/og-image.jpg'), [1200, 630]);
});

test('JSON-LD válido y coherente con el contenido visible', () => {
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(block, 'sin JSON-LD');
    const data = JSON.parse(block[1]);
    const types = data['@graph'].map(n => n['@type']);
    assert.deepEqual(types, ['WebSite', 'WebApplication', 'Person', 'FAQPage']);
    const app = data['@graph'][1];
    assert.equal(app.isAccessibleForFree, true);
    assert.equal(app.offers.price, '0');
    assert.equal(app.featureList.length, FEATURE_COUNT);
    assert.equal(app.image, `${SITE}/img/og-image.jpg`);
    const questions = data['@graph'][3].mainEntity;
    assert.equal(questions.length, FAQ_COUNT);
    questions.forEach((q, i) => {
        assert.equal(q.name, en[`faq.q${i + 1}`]);
        assert.equal(q.acceptedAnswer.text, en[`faq.a${i + 1}`]);
    });
    // El mismo texto está en el HTML estático de respaldo para rastreadores sin JavaScript
    for (const f of faq()) assert.ok(html.includes(f.question.replaceAll('&', '&amp;')), f.question);
    assert.match(html, /<div id="app"><article class="seo-fallback"><h1>Magic Color Tools<\/h1>/);
    // Un texto con "</script>" no puede romper el bloque
    assert.ok(!jsonLd(SITE) || !block[1].includes('</'));
});

test('robots.txt, sitemap.xml, llms.txt y manifest', () => {
    const robots = renderFile('robots.txt', SITE);
    assert.match(robots, /^User-agent: \*\nAllow: \//m);
    assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) assert.match(robots, new RegExp(`User-agent: ${bot}`));
    assert.ok(!/Disallow:\s*\/\s*$/m.test(robots));

    const sitemap = renderFile('sitemap.xml', SITE, new Date('2026-01-31T10:00:00Z'));
    assert.match(sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    assert.ok(locs.includes(`${SITE}/`) && locs.every(l => l.startsWith(SITE)));
    assert.match(sitemap, /<lastmod>2026-01-31<\/lastmod>/);
    assert.match(sitemap, /hreflang="es" href="https:\/\/example\.test\/\?lang=es"/);
    assert.equal((sitemap.match(/<url>/g) || []).length, (sitemap.match(/<\/url>/g) || []).length);

    const llms = renderFile('llms.txt', SITE);
    assert.match(llms, /^# Magic Color Tools\n\n> /);
    assert.ok(llms.includes(en['seo.description']));
    for (const m of MODULES) assert.ok(llms.includes(`${SITE}/?m=${m}`), `llms sin ${m}`);

    const manifest = JSON.parse(renderFile('manifest.webmanifest', SITE));
    assert.equal(manifest.name, 'Magic Color Tools');
    assert.ok(manifest.short_name.length <= 12);
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.icons.some(i => i.purpose === 'maskable'));
    for (const icon of manifest.icons) {
        const file = `public/${icon.src}`;
        assert.ok(existsSync(file), `falta ${file}`);
        assert.deepEqual(imageSize(file).join('x'), icon.sizes);
    }
    for (const s of manifest.shortcuts) assert.match(s.url, /\?m=/);
    assert.deepEqual([...SEO_FILES].sort(), ['llms.txt', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml']);
});

test('iconos y recursos enlazados existen', () => {
    for (const f of ['favicon-32.png', 'favicon.png', 'apple-touch-icon.png', 'og-image.jpg', 'icon-192.png', 'icon-512.png']) {
        assert.ok(existsSync(`public/img/${f}`), f);
    }
    assert.deepEqual(imageSize('public/img/apple-touch-icon.png'), [180, 180]);
    assert.deepEqual(imageSize('public/img/favicon-32.png'), [32, 32]);
});

test('normalización del dominio', () => {
    assert.equal(normalizeSite('https://a.test///'), 'https://a.test');
    assert.equal(normalizeSite(''), DEFAULT_SITE);
    assert.equal(normalizeSite(undefined), DEFAULT_SITE);
    assert.match(readFileSync('.env', 'utf8'), /^VITE_SITE_URL=https:\/\//m);
});
