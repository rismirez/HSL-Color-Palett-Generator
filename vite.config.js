import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { MIME, SEO_FILES, normalizeSite, renderFile, renderIndex } from './scripts/seo-lib.mjs';

// Inyecta los metadatos SEO/GEO en index.html y emite robots.txt, sitemap.xml, llms.txt y el manifest
// con el dominio definido en VITE_SITE_URL (ver .env).
function seoPlugin() {
    let site;
    return {
        name: 'magic-color-seo',
        configResolved(config) {
            site = normalizeSite(loadEnv(config.mode, config.root, 'VITE_').VITE_SITE_URL);
        },
        transformIndexHtml: { order: 'pre', handler: html => renderIndex(html, site) },
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const name = (req.url || '').split('?')[0].replace(/^\//, '');
                if (!SEO_FILES.includes(name)) return next();
                res.setHeader('Content-Type', MIME[path.extname(name)]);
                res.end(renderFile(name, site));
            });
        },
        generateBundle() {
            for (const name of SEO_FILES) this.emitFile({ type: 'asset', fileName: name, source: renderFile(name, site) });
        }
    };
}

export default defineConfig({
    base: './',
    plugins: [seoPlugin()],
    build: { target: 'es2020', chunkSizeWarningLimit: 300 }
});
