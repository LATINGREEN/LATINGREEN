#!/usr/bin/env node
/**
 * Ubicación exacta —archivo y línea— de cada regla R1–R19 y de lo que descarta
 * cada anti-patrón P1–P11, para `docs/AUTOAUDITORIA.md`.
 *
 * PROMPT.md, Fase 5: «señala, para cada una, el archivo y la línea donde se
 * impone. Una regla sin ubicación concreta es una regla no implementada.»
 *
 * Por qué un programa y no una tabla escrita a mano: los números de línea
 * caducan con cada edición, y una auditoría con líneas equivocadas es peor que
 * una sin líneas, porque parece verificada. Aquí cada ubicación se declara por
 * un ANCLA —el nombre de la restricción, de la función o del disparador que
 * impone la regla— y la línea se calcula. Si alguien renombra o borra lo que
 * imponía la regla, `--comprobar` falla.
 *
 *   node scripts/autoauditoria.mjs              reescribe la sección generada
 *   node scripts/autoauditoria.mjs --comprobar  falla si falta un ancla o la
 *                                               sección no está al día
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(RAIZ, 'docs', 'AUTOAUDITORIA.md');
const INICIO = '<!-- ubicaciones:inicio (generado por scripts/autoauditoria.mjs; no editar a mano) -->';
const FIN = '<!-- ubicaciones:fin -->';

const M = 'packages/db/migraciones/';

/** [id, qué, [[archivo, ancla], ...]] */
const REGLAS = [
  ['R1', 'Sesión de 10 min, deslizante, evaluada en servidor', [
    [`${M}0004_seg_seguridad.sql`, 'CREATE TRIGGER sesion_fijar_expiracion'],
    ['apps/api/src/seguridad/sesion.service.ts', "configuracion.get<number>('SESION_TTL_SEGUNDOS')"],
    ['apps/api/src/tareas/tareas.service.ts', '@Cron(CronExpression.EVERY_MINUTE)'],
  ]],
  ['R2', 'Red autorizada; rangos en tabla', [
    [`${M}0004_seg_seguridad.sql`, 'CREATE TABLE seg.red_autorizada'],
    ['apps/api/src/seguridad/red.service.ts', 'AND rango >>= $1::inet'],
  ]],
  ['R3', 'Captcha de un solo uso', [
    [`${M}0004_seg_seguridad.sql`, 'CREATE TABLE seg.captcha'],
    ['apps/api/src/seguridad/captcha.service.ts', 'WHERE id = $1 AND consumido_en IS NULL'],
  ]],
  ['R4', 'Ocho causas en base, un mensaje en pantalla', [
    [`${M}0004_seg_seguridad.sql`, 'CREATE TABLE seg.intento_autenticacion'],
    ['apps/api/src/seguridad/clave.service.ts', 'const RESUMEN_FICTICIO ='],
  ]],
  ['R5', 'Credencial `<SIGLA>_PAID`', [
    [`${M}0004_seg_seguridad.sql`, 'CONSTRAINT usuario_credencial_formato'],
  ]],
  ['R6', 'Ámbito jerárquico con RLS sobre `ltree`', [
    [`${M}0010_rls_politicas.sql`, 'CREATE OR REPLACE FUNCTION seg.unidad_en_ambito'],
    [`${M}0010_rls_politicas.sql`, 'ALTER TABLE org.unidad FORCE ROW LEVEL SECURITY'],
  ]],
  ['R7', 'Contexto con `SET LOCAL` dentro de la transacción', [
    ['packages/db/src/contexto.ts', 'set_config($1, $2, true)'],
    ['apps/api/src/basedatos/basedatos.service.ts', "import { AsyncLocalStorage } from 'node:async_hooks'"],
  ]],
  ['R8', 'Tres maestros de precedencia', [
    [`${M}0007_ai_tablas_hijas.sql`, 'id_entidad     bigint NOT NULL REFERENCES ai.entidad(id)'],
    [`${M}0016_herramienta_campos_manual.sql`, 'ADD COLUMN id_personal_responsable bigint REFERENCES ai.personal(id)'],
    ['apps/api/src/maestros/herramientas.controller.ts', 'CODIGOS_ERROR.MAESTRO_REQUERIDO'],
  ]],
  ['R9', '`participo_arc` siempre TRUE', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'CONSTRAINT actividad_participo_arc_siempre_verdadero'],
    ['packages/schema/src/dominios.ts', 'export const participoArc = z.literal(true'],
  ]],
  ['R10', 'Ocho tramos; no existen 80 ni 90', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'porcentaje_avance IN (10,20,30,40,50,60,70,100)'],
    ['packages/schema/src/avance.ts', 'export const TRAMOS_AVANCE = [10, 20, 30, 40, 50, 60, 70, 100]'],
  ]],
  ['R11', '10 MB agregados por actividad', [
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION ai.verificar_cuota_adjuntos()'],
    ['packages/schema/src/adjunto.ts', 'export const CUOTA_BYTES_POR_ACTIVIDAD'],
  ]],
  ['R12', 'Extensión por categoría contra el contenido real', [
    [`${M}0002_ref_catalogos.sql`, 'CREATE TABLE ref.extension_permitida'],
    ['apps/api/src/adjuntos/adjuntos.service.ts', "import { fromBuffer } from 'file-type'"],
    ['packages/schema/src/adjunto.ts', 'export function mimeCoincideConExtension'],
  ]],
  ['R13', 'GMS en los seis formularios; decimales generadas', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'latitud_decimal     numeric(9,6) GENERATED ALWAYS AS'],
    [`${M}0005_ai_maestros.sql`, 'latitud_decimal     numeric(9,6) GENERATED ALWAYS AS'],
    ['packages/schema/src/coordenadas.ts', 'export function aDecimal('],
  ]],
  ['R14', 'Borrado lógico; el físico, con solicitud a JACID', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'GRANT DELETE ON ai.actividad'],
    [`${M}0004_seg_seguridad.sql`, 'CREATE TABLE seg.solicitud_eliminacion'],
  ]],
  ['R15', 'Bitácora obligatoria, por disparador', [
    [`${M}0008_doc_y_aud.sql`, 'CREATE TABLE aud.bitacora_cambio'],
    [`${M}0008_doc_y_aud.sql`, 'REVOKE UPDATE, DELETE, TRUNCATE ON aud.bitacora_cambio'],
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION aud.registrar_cambio()'],
  ]],
  ['R16', 'Atribuciones centralizadas en JACID', [
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION ai.verificar_campana_es_de_fuerza()'],
    [`${M}0012_ai_alianzas.sql`, 'CREATE OR REPLACE FUNCTION ai.verificar_avance_solo_en_convenio()'],
    ['apps/api/src/seguridad/permiso.guard.ts', 'export class PermisoGuard'],
  ]],
  ['R17', 'Asistencia DIRECTA exige plan operacional', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'ADD CONSTRAINT asistencia_directa_exige_plan_operacional'],
  ]],
  ['R18', 'Siete COAMI, ninguno por defecto', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'CREATE TABLE ai.actividad_coami'],
    ['packages/db/semillas/0001_catalogos.sql', 'INSERT INTO ref.coami'],
    ['packages/schema/src/dominios.ts', 'export const COAMI = ['],
  ]],
  ['R19', 'Las once pestañas; `registro_completo`', [
    [`${M}0007_ai_tablas_hijas.sql`, 'CREATE TABLE ai.act_poblacion_beneficiada'],
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION ai.recalcular_registro_completo'],
    ['packages/schema/src/pestanas.ts', 'export const PESTANAS_ACTIVIDAD = ['],
  ]],
];

const ANTIPATRONES = [
  ['P1', 'Referencia polimórfica sin integridad', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'CONSTRAINT jornada_apoyo_disyuncion_subtipo'],
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION ai.verificar_subtipo_presente()'],
  ]],
  ['P2', 'Tabla documentada y no implementada', [
    ['packages/db/src/pruebas/puerta1.test.ts', "describe('Inventario: ninguna tabla esperada falta (P2)'"],
  ]],
  ['P3', '«Auditoría» de cuatro columnas', [
    [`${M}0009_disparadores.sql`, 'aud.fijar_columnas_auditoria()'],
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION aud.registrar_cambio()'],
  ]],
  ['P4', 'RBAC de nombre', [
    [`${M}0004_seg_seguridad.sql`, 'CREATE TABLE seg.usuario_rol'],
    ['apps/api/src/seguridad/permiso.guard.ts', 'export class PermisoGuard'],
  ]],
  ['P5', '`CHECK` de fila para una regla agregada', [
    [`${M}0009_disparadores.sql`, 'CREATE OR REPLACE FUNCTION ai.verificar_cuota_adjuntos()'],
  ]],
  ['P6', 'Columnas «calculadas por disparador» sin disparador', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'ubicacion           geography(Point,4326) GENERATED ALWAYS AS'],
  ]],
  ['P7', 'Testigo de sesión en claro', [
    [`${M}0004_seg_seguridad.sql`, 'hash_testigo'],
  ]],
  ['P8', 'Borrado físico prohibido solo en la documentación', [
    [`${M}0006_ai_actividad_y_subtipos.sql`, 'GRANT DELETE ON ai.actividad'],
  ]],
  ['P9', 'Dominios cerrados como texto libre', [
    [`${M}0002_ref_catalogos.sql`, 'CREATE TABLE ref.tipo_actividad'],
    [`${M}0001_extensiones_esquemas_y_roles.sql`, 'ref.normalizar_texto'],
  ]],
  ['P10', 'Geografía y jerarquía desnormalizadas', [
    [`${M}0003_org_unidades.sql`, 'CREATE TABLE org.unidad'],
    [`${M}0002_ref_catalogos.sql`, 'CREATE TABLE ref.municipio'],
  ]],
  ['P11', '`SET` en lugar de `SET LOCAL`', [
    ['packages/db/src/contexto.ts', 'set_config($1, $2, true)'],
    ['apps/api/src/seguridad/transaccion.interceptor.ts', 'export class TransaccionInterceptor'],
  ]],
];

const cache = new Map();
function lineas(archivo) {
  if (!cache.has(archivo)) cache.set(archivo, readFileSync(join(RAIZ, archivo), 'utf8').split('\n'));
  return cache.get(archivo);
}

const faltantes = [];
function ubicar(archivo, ancla) {
  let contenido;
  try {
    contenido = lineas(archivo);
  } catch {
    faltantes.push(`${archivo} (no existe) — ${ancla}`);
    return null;
  }
  const indice = contenido.findIndex((l) => l.includes(ancla));
  if (indice === -1) {
    faltantes.push(`${archivo} — ancla «${ancla}» no encontrada`);
    return null;
  }
  return `${archivo}:${indice + 1}`;
}

function tabla(titulo, filas) {
  const salida = [`| # | ${titulo} | Archivo:línea | Ancla |`, '|---|---|---|---|'];
  for (const [id, que, anclas] of filas) {
    anclas.forEach(([archivo, ancla], i) => {
      const donde = ubicar(archivo, ancla);
      const celda = donde === null ? '**FALTA**' : `\`${donde}\``;
      const anclaVisible = `\`${ancla.replaceAll('|', '\\|').replaceAll('`', "'")}\``;
      salida.push(`| ${i === 0 ? id : ''} | ${i === 0 ? que : ''} | ${celda} | ${anclaVisible} |`);
    });
  }
  return salida.join('\n');
}

const seccion = [
  INICIO,
  '',
  tabla('Regla', REGLAS),
  '',
  tabla('Anti-patrón descartado por', ANTIPATRONES),
  '',
  FIN,
].join('\n');

const doc = readFileSync(DOC, 'utf8');
const a = doc.indexOf(INICIO);
const b = doc.indexOf(FIN);
if (a === -1 || b === -1) {
  console.error(`Faltan los marcadores de la sección generada en ${DOC}.`);
  process.exit(1);
}
const nuevo = doc.slice(0, a) + seccion + doc.slice(b + FIN.length);

if (faltantes.length > 0) {
  console.error('Anclas que ya no existen (la regla podría haber dejado de imponerse):');
  for (const f of faltantes) console.error(`  - ${f}`);
  process.exit(1);
}

if (process.argv.includes('--comprobar')) {
  if (nuevo !== doc) {
    console.error(
      'docs/AUTOAUDITORIA.md no está al día: las líneas cambiaron. Ejecute node scripts/autoauditoria.mjs',
    );
    process.exit(1);
  }
  process.stdout.write('Autoauditoría al día: todas las anclas existen y las líneas coinciden.\n');
} else {
  writeFileSync(DOC, nuevo);
  process.stdout.write('docs/AUTOAUDITORIA.md actualizado.\n');
}
