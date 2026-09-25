#!/usr/bin/env node
/**
 * Empaqueta la demostración sin servidor en UN solo archivo HTML.
 *
 *   pnpm --filter @paid/web build:demo      # vite build --mode demo
 *   node scripts/empaquetar-demo.mjs        # → apps/web/dist-demo/paid-demo.html
 *
 * El JavaScript y el CSS van dentro del HTML, y las fuentes y los emblemas
 * como `data:`. El resultado se abre con doble clic desde el disco, se sube a
 * cualquier alojamiento estático (una carpeta de Hostinger, por ejemplo) o se
 * publica como página: no pide nada a ningún otro sitio.
 *
 * Con `--fragmento` escribe además `paid-demo-fragmento.html`, sin las
 * etiquetas `<html>`, `<head>` ni `<body>`, para los alojamientos que ponen
 * ese esqueleto por su cuenta.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(RAIZ, 'apps', 'web', 'dist-demo');

const MIME = {
  woff2: 'font/woff2',
  webp: 'image/webp',
  png: 'image/png',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  ico: 'image/x-icon',
};

function dataUri(rutaRelativa) {
  const extension = rutaRelativa.split('.').pop() ?? '';
  const mime = MIME[extension];
  if (mime === undefined) throw new Error(`Sin tipo MIME para ${rutaRelativa}`);
  const contenido = readFileSync(join(DIST, rutaRelativa));
  return `data:${mime};base64,${contenido.toString('base64')}`;
}

/** Las rutas de `public/` que el código cita literalmente, en CSS o en JS. */
function incrustarRecursos(texto) {
  return texto.replace(
    /(?:\.\.\/|\.\/|\/)((?:fuentes|identidad)\/[A-Za-z0-9._-]+\.(?:woff2|webp|png|svg|jpg))/gu,
    (_coincidencia, ruta) => dataUri(ruta),
  );
}

const indice = readFileSync(join(DIST, 'index.html'), 'utf8');
const scriptSrc = /<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/u.exec(
  indice,
);
const hojaHref = /<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/u.exec(indice);
if (scriptSrc === null || hojaHref === null)
  throw new Error('No se encontró el JS o el CSS en index.html');

const assets = readdirSync(join(DIST, 'assets'));
const js = assets.filter((a) => a.endsWith('.js'));
if (js.length !== 1) throw new Error(`Se esperaba un solo JS y hay ${js.length}: ${js.join(', ')}`);

const codigo = incrustarRecursos(readFileSync(join(DIST, scriptSrc[1]), 'utf8'))
  // Dentro de <script>, la secuencia </script> cerraría la etiqueta.
  .replace(/<\/script/giu, '<\\/script');
const estilos = incrustarRecursos(readFileSync(join(DIST, hojaHref[1]), 'utf8'));

const cuerpoOriginal = /<body>([\s\S]*)<\/body>/u.exec(indice)?.[1] ?? '<div id="raiz"></div>';
const titulo = /<title>([^<]*)<\/title>/u.exec(indice)?.[1] ?? 'PAID';

const cabeza = [
  `<title>${titulo} · demostración</title>`,
  '<meta name="robots" content="noindex, nofollow">',
  `<style>${estilos}</style>`,
].join('\n');
const cuerpo = `${cuerpoOriginal.replace(/<script[\s\S]*?<\/script>/gu, '').trim()}\n<script type="module">${codigo}</script>`;

const completo = `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${cabeza}
</head>
<body>
${cuerpo}
</body>
</html>
`;
writeFileSync(join(DIST, 'paid-demo.html'), completo);

if (process.argv.includes('--fragmento')) {
  writeFileSync(join(DIST, 'paid-demo-fragmento.html'), `${cabeza}\n${cuerpo}\n`);
}

const mb = (Buffer.byteLength(completo) / 1024 / 1024).toFixed(2);
process.stdout.write(`apps/web/dist-demo/paid-demo.html: ${mb} MB\n`);
