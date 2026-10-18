// Genera "eco-arcade-policia.html": el juego completo en UN solo archivo,
// con el logo y la música incrustados. Sirve para compartirlo por WhatsApp,
// correo o USB sin depender de la carpeta assets/.
//
// Uso:  node build-single-file.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

const png = fs.readFileSync(path.join(dir, 'assets', 'logo-policia.png'));
const m4a = fs.readFileSync(path.join(dir, 'assets', 'latin-green.m4a'));

html = html.replaceAll('assets/logo-policia.png', 'data:image/png;base64,' + png.toString('base64'));
html = html.replaceAll('assets/latin-green.m4a', 'data:audio/mp4;base64,' + m4a.toString('base64'));

const out = path.join(dir, 'eco-arcade-policia.html');
fs.writeFileSync(out, html);
console.log(`Listo: ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
