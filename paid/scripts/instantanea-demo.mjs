#!/usr/bin/env node
/**
 * Instantánea de la API real para la demostración sin servidor.
 *
 * Ingresa en la API que levanta `./scripts/mirar.sh` y guarda lo que responde
 * —la sesión, los catálogos, los tres maestros, la normatividad y cada jornada
 * con sus pestañas y sus adjuntos— en `apps/web/src/demo/instantanea.json`.
 * El servidor simulado de `apps/web/src/demo/servidor.ts` arranca de ahí.
 *
 * Se toma de la API y no se escribe a mano para que la demostración muestre
 * exactamente lo que el servidor devuelve: mismas formas, mismos
 * identificadores, mismos nombres. Si la API cambia, se vuelve a tomar.
 *
 *   ./scripts/mirar.sh            # en otra terminal
 *   node scripts/instantanea-demo.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = process.env.API_URL ?? 'http://127.0.0.1:3000/api';
const CABECERA = 'x-paid-testigo';

let testigo = '';

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(testigo !== '' ? { [CABECERA]: testigo } : {}),
      ...(opciones.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${opciones.method ?? 'GET'} ${ruta} → ${r.status} ${await r.text()}`);
  return r;
}
const json = async (ruta, opciones) => (await pedir(ruta, opciones)).json();

function resolver(texto) {
  const m = /(-?\d+)\s*([+-])\s*(-?\d+)/u.exec(texto);
  if (m === null) throw new Error(`Reto inesperado: ${texto}`);
  return String(m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]));
}

const reto = await json('/autenticacion/reto', { method: 'POST', body: '{}' });
const sesion = await json('/autenticacion/ingreso', {
  method: 'POST',
  body: JSON.stringify({
    credencial: 'BIM23_PAID',
    clave: process.env.CLAVE ?? 'Desarrollo2026*',
    idCaptcha: reto.idCaptcha,
    respuestaCaptcha: resolver(reto.textoReto),
  }),
});
testigo = sesion.testigo;

const nombres = (await json('/catalogos')).catalogos;
const catalogos = {};
for (const nombre of nombres) {
  if (nombre === 'municipio') continue;
  catalogos[nombre] = await json(`/catalogos/${nombre}`);
}
// Los municipios se piden por departamento; se guardan con él.
const municipios = [];
for (const d of catalogos['departamento'] ?? []) {
  for (const m of await json(`/catalogos/municipio?idDepartamento=${d.id}`)) {
    municipios.push({ ...m, idDepartamento: d.id });
  }
}

const personal = (await json('/personal')).filas;
const entidades = (await json('/entidades')).filas;
const herramientas = (await json('/herramientas')).filas;
const normatividad = (await json('/normatividad')).filas;

const listado = (await json('/jornadas?porPagina=500&pagina=1')).filas;
const jornadas = [];
for (const fila of listado) {
  const detalle = await json(`/jornadas/${fila.id}`);
  const pestanas = {};
  for (const p of [
    'TIPO_OPERACION',
    'ENTIDADES_SERVICIOS',
    'SERVICIOS_PRESTADOS',
    'POBLACION_BENEFICIADA',
    'ENTIDADES_APOYADAS',
    'MEDIOS_DIFUSION',
    'MEDIOS_UTILIZADOS',
    'RECURSOS_UTILIZADOS',
    'BIENES_DONADOS',
    'RESUMEN',
  ]) {
    pestanas[p] = await json(`/jornadas/${fila.id}/pestanas/${p}`);
  }
  const adjuntos = [];
  for (const a of await json(`/jornadas/${fila.id}/adjuntos`)) {
    const binario = Buffer.from(
      await (await pedir(`/jornadas/${fila.id}/adjuntos/${a.id}`)).arrayBuffer(),
    );
    // Solo los pequeños viajan en la instantánea: la demostración no necesita
    // más, y un JSON de megas no vale la pena.
    adjuntos.push({
      ...a,
      base64: binario.byteLength <= 64 * 1024 ? binario.toString('base64') : null,
    });
  }
  jornadas.push({ listado: fila, detalle, pestanas, adjuntos });
}

await pedir('/autenticacion/salida', { method: 'POST', body: '{}' });

const { testigo: _t, ...sesionSinTestigo } = sesion;
const instantanea = {
  tomadaEn: new Date().toISOString(),
  sesion: sesionSinTestigo,
  catalogos,
  municipios,
  personal,
  entidades,
  herramientas,
  normatividad,
  jornadas,
};
const destino = join(RAIZ, 'apps', 'web', 'src', 'demo', 'instantanea.json');
writeFileSync(destino, `${JSON.stringify(instantanea, null, 1)}\n`);
process.stdout.write(
  `Instantánea: ${Object.keys(catalogos).length} catálogos, ${municipios.length} municipios, ` +
    `${personal.length} personas, ${entidades.length} entidades, ${herramientas.length} herramientas, ` +
    `${jornadas.length} jornadas → ${destino}\n`,
);
