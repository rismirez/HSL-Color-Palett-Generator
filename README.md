# Magic Color Tools · Color Studio

Herramienta web para crear, editar, extraer, analizar y exportar paletas de color. Funciona por completo en el navegador: sin registro, sin servidor y sin enviar imágenes a ningún sitio.

*A browser-based color studio to create, edit, extract, test and export palettes. Everything runs locally: no sign-up, no server, no image uploads.*

Disponible en español e inglés · Tema automático, claro y oscuro · Responsive.

## Módulos / Modules

| Módulo | Qué hace |
| --- | --- |
| **Generator** | Paletas de 1 a 16 colores con 8 armonías, parámetros (temperatura, saturación, luminosidad, rango de tonos, contraste, distribución), estilos (pastel, vibrante, apagada, oscura, clara, monocromática), bloqueo de colores, rueda cromática, editor de color completo (HEX, RGB, HSL, HSV, OKLCH, CMYK), variaciones, escalas 50–950 (HSL, LAB, OKLCH), el generador de tonos original y exportación. |
| **Extractor** | Paletas desde imágenes JPG/PNG/WebP (subir, arrastrar o pegar): k-means ponderado en OKLab, colores dominantes/secundarios/de acento, selector de píxel, comparación de resultados y envío al Generator. |
| **Accessibility** | Contraste WCAG 2.x (AA/AAA), matriz de la paleta, uso recomendado de cada color, correcciones automáticas que conservan el tono y simulación de daltonismo. |
| **Preview** | La paleta aplicada a 8 composiciones (dashboard, app móvil, web corporativa, e-commerce, landing, branding, cartel, videojuego) con roles reasignables. |
| **Color Systems** | Tokens primitivos y semánticos, modo claro/oscuro, estados, nomenclatura configurable y exportación a CSS, SCSS, JSON, Tailwind y Design Tokens. |
| **Color Lab** | Mezclador, estudio de degradados, comparador de paletas y simulador de daltonismo en composiciones. |

Pendiente (fases 3 y 4): biblioteca personal, galería de inspiración, generación por descripción, Color Naming Studio y Color Challenge.

## Iconos / Icons

Los iconos de la interfaz son los animados de [AnimateIcons](https://animateicons.in) (MIT, basados en Lucide), convertidos con `scripts/extract-icons.mjs` y reproducidos con la Web Animations API al pasar el ratón o enfocar con teclado; no se usa React. La rueda cromática es un icono propio en el mismo estilo. Licencias en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## SEO, GEO y redes sociales

- **Dominio**: se define una sola vez en `.env` (`VITE_SITE_URL`). Con él se generan canonical, `hreflang`, Open Graph, sitemap, robots, `llms.txt` y JSON-LD. **Cámbialo si publicas en otro dominio.**
- **index.html**: título, descripción, canonical, hreflang (`?lang=en|es`), robots, Open Graph, X/Twitter Cards con imagen de 1200×630, PWA/iOS/Windows y JSON-LD (WebSite, WebApplication, Person y FAQPage). El contenido de respaldo para rastreadores sin JavaScript se inyecta en `#app` y la aplicación lo sustituye al arrancar.
- **Dinámico**: al cambiar de idioma o de módulo se actualizan título, descripción, `og:*`, `twitter:*` y canonical (`src/core/seo.js`).
- **GEO (motores generativos)**: `llms.txt`, un `robots.txt` que permite GPTBot, ClaudeBot, PerplexityBot, Google-Extended y similares, y una página «Acerca de» (pestaña junto al Laboratorio) con preguntas frecuentes que coincide con el JSON-LD. Los textos viven en `src/i18n/*/seo.js`.
- **Ficheros generados en el build**: `robots.txt`, `sitemap.xml`, `llms.txt` y `manifest.webmanifest` (plantillas en `seo/`).
- **Imágenes**: `scripts/make-social-images.mjs` genera la imagen social y los iconos PWA.

## Desarrollo / Development

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas del motor cromático, exportaciones y traducciones
npm run build    # build de producción en dist/
```

JavaScript nativo (ES modules) + Vite. Cada módulo se descarga la primera vez que se abre.

```
src/
  core/      motor cromático y lógica pura (sin DOM, con pruebas)
  modules/   una pantalla por módulo
  ui/        componentes compartidos
  i18n/      traducciones es/en
  styles/    estilos
```

## Notas técnicas

- **Color**: OKLCH es el espacio principal para escalas, mezclas y correcciones; los colores fuera de gamut se reducen en croma manteniendo luminosidad y tono. CMYK es la conversión simple, sin perfiles ICC.
- **Contraste**: luminancia relativa de WCAG 2.x. Daltonismo: matrices de Machado, Oliveira y Fernandes (2009).
- **Privacidad**: el estado se guarda en `localStorage`; las imágenes se procesan en el navegador y no se almacenan.
- **Compartir**: la URL incluye paleta, colores bloqueados, armonía, módulo y escala. Los enlaces del generador original (`?color=…&tones=…&step=…`) siguen funcionando.
- **IA**: no hay integración de IA; nombres y paletas se generan de forma algorítmica y local.
