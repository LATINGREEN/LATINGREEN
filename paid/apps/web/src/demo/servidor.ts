/**
 * Servidor SIMULADO para la demostración sin servidor (`vite build --mode demo`).
 *
 * Existe para mostrar la PAID funcionando a quien no puede instalarla: la
 * interfaz es la misma, pixel por pixel, y en lugar de hablar con la API por
 * la red le habla a este módulo, que corre en el navegador.
 *
 * Lo que sí es real:
 * - Los datos de partida: `instantanea.json` se toma de la API real con
 *   `scripts/instantanea-demo.mjs`, así que las formas y los nombres son los
 *   que el servidor devuelve.
 * - La validación: cada petición se valida con los MISMOS esquemas Zod de
 *   `@paid/schema` que usa la API (A.6), y las reglas que la API añade encima
 *   (R4, R11, R12, R19, la semejanza de entidades, los datos de las láminas
 *   20–21 y 46) se replican aquí con los mismos mensajes.
 *
 * Lo que NO es real, y la demostración lo dice en pantalla:
 * - No hay base de datos: nada de RLS, bitácora ni disparadores. Al recargar
 *   la página, todo vuelve a la instantánea.
 * - Solo existe la credencial BIM23_PAID.
 *
 * Nunca entra en la compilación normal: `api/cliente.ts` lo carga con un
 * `import()` detrás de `import.meta.env.MODE === 'demo'`, que Vite resuelve en
 * tiempo de compilación y elimina en cualquier otro modo.
 */
import {
  CABECERA_TESTIGO,
  CAPTCHA_TTL_SEGUNDOS,
  CODIGOS_ERROR,
  CUOTA_BYTES_POR_ACTIVIDAD,
  ESQUEMA_POR_PESTANA,
  FASES_DOCUMENTALES,
  MENSAJE_CREDENCIALES_INVALIDAS,
  MIME_ESPERADO_POR_EXTENSION,
  PESTANAS_ACTIVIDAD,
  SESION_TTL_SEGUNDOS,
  UMBRAL_BLOQUEO_ENTIDAD,
  UMBRAL_SEMEJANZA_ENTIDAD,
  aDecimal,
  actualizarJornada,
  calcularCuota,
  categoriaDeExtension,
  crearEntidad,
  crearHerramienta,
  crearJornada,
  crearPersonal,
  esPestanaConDatos,
  evaluarPestanas,
  extensionDe,
  extensionPermitida,
  filtroJornadas,
  formatearBytes,
  formatearFechaDdMmAaaa,
  mimeCoincideConExtension,
  normalizarTexto,
  solicitudIngreso,
} from '@paid/schema';
import type {
  AdjuntoEnListado,
  EntidadEnListado,
  EntidadSemejante,
  FilaPestana,
  HerramientaEnListado,
  JornadaDetalle,
  JornadaEnListado,
  NormatividadEnListado,
  OpcionCatalogo,
  PersonalEnListado,
  PestanaActividad,
  PestanaConDatos,
  RespuestaIngreso,
} from '@paid/schema';
import instantaneaCruda from './instantanea.json';

// ── La instantánea ─────────────────────────────────────────────────────────

interface AdjuntoInstantanea extends AdjuntoEnListado {
  readonly base64: string | null;
}

interface JornadaInstantanea {
  readonly listado: JornadaEnListado;
  readonly detalle: JornadaDetalle;
  readonly pestanas: Readonly<Record<string, readonly FilaPestana[]>>;
  readonly adjuntos: readonly AdjuntoInstantanea[];
}

interface Instantanea {
  readonly sesion: Omit<RespuestaIngreso, 'testigo'>;
  readonly catalogos: Readonly<Record<string, readonly OpcionCatalogo[]>>;
  readonly municipios: readonly (OpcionCatalogo & { readonly idDepartamento: number })[];
  readonly personal: readonly PersonalEnListado[];
  readonly entidades: readonly EntidadEnListado[];
  readonly herramientas: readonly HerramientaEnListado[];
  readonly normatividad: readonly NormatividadEnListado[];
  readonly jornadas: readonly JornadaInstantanea[];
}

const instantanea = instantaneaCruda as unknown as Instantanea;

// ── Estado en memoria ──────────────────────────────────────────────────────

interface Adjunto {
  readonly listado: AdjuntoEnListado;
  readonly contenido: Uint8Array;
  readonly mime: string;
  vigente: boolean;
}

interface Jornada {
  detalle: JornadaDetalle;
  readonly filas: Record<PestanaConDatos, FilaPestana[]>;
  readonly adjuntos: Adjunto[];
}

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const catalogos = copia(instantanea.catalogos);
const municipios = copia(instantanea.municipios);
const personal: PersonalEnListado[] = copia([...instantanea.personal]);
const entidades: EntidadEnListado[] = copia([...instantanea.entidades]);
const herramientas: HerramientaEnListado[] = copia([...instantanea.herramientas]);
const normatividad = copia(instantanea.normatividad);

/** El correo y el teléfono no vienen en el listado de personal completo; se guardan aparte. */
const jornadas = new Map<number, Jornada>();
let siguienteId = 1000;
const nuevoId = (): number => (siguienteId += 1);

function base64ABytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

for (const j of instantanea.jornadas) {
  const filas = {} as Record<PestanaConDatos, FilaPestana[]>;
  for (const p of Object.keys(ESQUEMA_POR_PESTANA) as PestanaConDatos[]) {
    filas[p] = copia([...(j.pestanas[p] ?? [])]);
  }
  jornadas.set(j.detalle.id, {
    detalle: copia(j.detalle),
    filas,
    adjuntos: j.adjuntos.map((a) => {
      const { base64, ...listado } = a;
      return {
        listado,
        // Un adjunto grande no viaja en la instantánea: se descarga como un
        // PDF mínimo, y la demostración lo dice en el nombre del archivo.
        contenido: base64 === null ? new TextEncoder().encode('%PDF-1.4\n') : base64ABytes(base64),
        mime: 'application/pdf',
        vigente: true,
      };
    }),
  });
}

/** Código de la unidad en el patrón observado del código de actividad (Q1). */
const CODIGO_UNIDAD = instantanea.jornadas[0]?.detalle.codigoActividad.split('R')[0] ?? '2813304';

// ── Sesión (R1, R3, R4) ────────────────────────────────────────────────────

const CLAVE_DEMO = 'Desarrollo2026*';
const captchas = new Map<string, { respuesta: string; expira: number }>();
const sesiones = new Map<string, { expira: number }>();

function aleatorio(largo: number, alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

// ── Respuestas ─────────────────────────────────────────────────────────────

interface Detalle {
  readonly campo: string;
  readonly mensaje: string;
}

class ErrorDemo extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
    readonly detalles?: unknown,
  ) {
    super(mensaje);
  }
}

const json = (estado: number, cuerpo: unknown): Response =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });

const sinContenido = (): Response => new Response(null, { status: 204 });

function invalido(
  mensaje: string,
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ErrorDemo {
  const detalles: Detalle[] = issues.map((i) => ({
    campo: i.path.map(String).join('.'),
    mensaje: i.message,
  }));
  return new ErrorDemo(400, CODIGOS_ERROR.DATOS_INVALIDOS, mensaje, detalles);
}

function errorDeCampo(codigo: string, mensaje: string, campo: string, detalle: string): ErrorDemo {
  return new ErrorDemo(400, codigo, mensaje, [{ campo, mensaje: detalle }]);
}

const noEncontrada = (): ErrorDemo =>
  new ErrorDemo(404, CODIGOS_ERROR.RECURSO_NO_ENCONTRADO, 'No se encontró la jornada.');

// ── Utilidades de dominio ──────────────────────────────────────────────────

const opcion = (catalogo: string, id: number | undefined): OpcionCatalogo | undefined =>
  id === undefined ? undefined : catalogos[catalogo]?.find((o) => o.id === id);

const nombreMunicipio = (id: number | undefined): string | null =>
  id === undefined ? null : (municipios.find((m) => m.id === id)?.nombre ?? null);

/** Campo de pestaña → catálogo del que sale su nombre. */
const CATALOGO_DE_CAMPO: Readonly<Record<string, string>> = {
  idTipoOperacion: 'tipo_operacion',
  idServicioPrestado: 'servicio_prestado',
  idGrupoPoblacional: 'grupo_poblacional',
  idMedioDifusion: 'medio_difusion',
  idMedioUtilizado: 'medio_utilizado',
  idTipoRecurso: 'tipo_recurso',
  idTipoBienDonado: 'tipo_bien_donado',
};

/** Campos que no admiten dos filas con el mismo valor en una jornada (la `clave` del mapa de pestañas). */
const CLAVE_DE_PESTANA: Readonly<Record<PestanaConDatos, readonly string[]>> = {
  TIPO_OPERACION: ['idTipoOperacion'],
  ENTIDADES_SERVICIOS: ['idEntidad'],
  SERVICIOS_PRESTADOS: ['idServicioPrestado'],
  POBLACION_BENEFICIADA: ['idGrupoPoblacional'],
  ENTIDADES_APOYADAS: ['idEntidad'],
  MEDIOS_DIFUSION: ['idMedioDifusion'],
  MEDIOS_UTILIZADOS: ['idMedioUtilizado'],
  RECURSOS_UTILIZADOS: ['idTipoRecurso'],
  BIENES_DONADOS: [],
  RESUMEN: [],
};

function pestanasConDatos(j: Jornada): PestanaActividad[] {
  const con: PestanaActividad[] = [];
  for (const p of Object.keys(j.filas) as PestanaConDatos[]) {
    if (j.filas[p].length > 0) con.push(p);
  }
  if (j.adjuntos.some((a) => a.vigente)) con.push('ARCHIVOS_ADJUNTOS');
  return con;
}

function recalcular(j: Jornada): void {
  j.detalle = {
    ...j.detalle,
    registroCompleto: evaluarPestanas(pestanasConDatos(j)).registroCompleto,
  };
}

function aListado(j: Jornada): JornadaEnListado {
  const d = j.detalle;
  const con = pestanasConDatos(j);
  return {
    id: d.id,
    codigoActividad: d.codigoActividad,
    unidad: d.unidad,
    descripcion: d.descripcion,
    fechaInicio: d.fechaInicio,
    fechaEjecucion: d.fechaEjecucion,
    lugar: d.lugar,
    municipio: d.municipio,
    tipoJornada: d.tipoJornada,
    participoEjc: d.participoEjc,
    participoFac: d.participoFac,
    poblacionAfectaTropa: d.poblacionAfectaTropa,
    registroCompleto: d.registroCompleto,
    pestanasFaltantes: PESTANAS_ACTIVIDAD.filter((p) => !con.includes(p)),
    latitudDecimal: d.latitudDecimal,
    longitudDecimal: d.longitudDecimal,
  };
}

function jornadaDe(id: number): Jornada {
  const j = jornadas.get(id);
  if (j === undefined) throw noEncontrada();
  return j;
}

/** Semejanza por trigramas, como `similarity()` de pg_trgm. */
function trigramas(texto: string): Set<string> {
  const conjunto = new Set<string>();
  for (const palabra of normalizarTexto(texto).toLowerCase().split(/\s+/u).filter(Boolean)) {
    const relleno = `  ${palabra} `;
    for (let i = 0; i < relleno.length - 2; i += 1) conjunto.add(relleno.slice(i, i + 3));
  }
  return conjunto;
}

function semejanza(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes += 1;
  return comunes / (ta.size + tb.size - comunes);
}

/** R12 — lo que `file-type` reconoce por el contenido, para las extensiones del manual. */
function detectarMime(bytes: Uint8Array): string | null {
  const empieza = (...firma: number[]): boolean => firma.every((b, i) => bytes[i] === b);
  const texto = (desde: number, largo: number): string =>
    String.fromCharCode(...bytes.slice(desde, desde + largo));
  if (empieza(0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
  if (empieza(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (empieza(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (empieza(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (empieza(0xd0, 0xcf, 0x11, 0xe0)) return 'application/x-cfb';
  if (empieza(0x30, 0x26, 0xb2, 0x75)) return 'video/x-ms-asf';
  if (texto(0, 4) === 'RIFF' && texto(8, 3) === 'AVI') return 'video/x-msvideo';
  if (texto(4, 4) === 'ftyp') return 'video/mp4';
  if (texto(0, 3) === 'ID3' || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))
    return 'audio/mpeg';
  if (empieza(0x50, 0x4b, 0x03, 0x04)) {
    const cabeza = texto(0, Math.min(bytes.length, 65536));
    if (cabeza.includes('word/'))
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (cabeza.includes('xl/'))
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (cabeza.includes('ppt/'))
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'application/zip';
  }
  return null;
}

async function resumenSha256(bytes: Uint8Array): Promise<string> {
  const copiaBytes = new Uint8Array(bytes);
  const hash = await crypto.subtle.digest('SHA-256', copiaBytes.buffer);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

const NOMBRE_CATEGORIA: Readonly<Record<string, string>> = {
  IMAGEN: 'Imagen',
  DOCUMENTO: 'Documento',
  AUDIO: 'Audio',
  VIDEO: 'Video',
};

// ── Exportación (misma tabla que la API) ───────────────────────────────────

function siNo(valor: boolean | null): string {
  if (valor === null) return '';
  return valor ? 'SÍ' : 'NO';
}

function csvJornadas(filas: readonly JornadaEnListado[]): Blob {
  const columnas: readonly [string, (f: JornadaEnListado) => string][] = [
    ['Código', (f) => f.codigoActividad],
    ['Unidad', (f) => f.unidad],
    ['Tipo de jornada', (f) => f.tipoJornada ?? ''],
    ['Participó EJC', (f) => siNo(f.participoEjc)],
    ['Participó ARC', () => 'SÍ'],
    ['Participó FAC', (f) => siNo(f.participoFac)],
    ['Población afecta', (f) => siNo(f.poblacionAfectaTropa)],
    ['Fecha ejecución', (f) => formatearFechaDdMmAaaa(f.fechaEjecucion)],
    ['Lugar', (f) => f.lugar],
    ['Municipio', (f) => f.municipio ?? ''],
    ['Descripción', (f) => f.descripcion],
    ['Latitud', (f) => f.latitudDecimal.toFixed(6)],
    ['Longitud', (f) => f.longitudDecimal.toFixed(6)],
    ['Registro completo', (f) => (f.registroCompleto ? 'SÍ' : 'NO')],
    ['Pestañas faltantes', (f) => f.pestanasFaltantes.join(', ')],
  ];
  const escapar = (v: string): string => (/[",\r\n]/u.test(v) ? `"${v.replace(/"/gu, '""')}"` : v);
  const lineas = [columnas.map(([t]) => escapar(t)).join(',')];
  for (const f of filas) lineas.push(columnas.map(([, celda]) => escapar(celda(f))).join(','));
  return new Blob(['﻿', lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

// ── Rutas ──────────────────────────────────────────────────────────────────

type Manejador = (p: {
  readonly params: readonly string[];
  readonly consulta: URLSearchParams;
  readonly cuerpo: unknown;
  readonly formulario: FormData | null;
}) => Promise<Response> | Response;

interface Ruta {
  readonly metodo: string;
  readonly patron: RegExp;
  readonly publica?: boolean;
  readonly manejar: Manejador;
}

function listarJornadas(consulta: URLSearchParams): { filas: JornadaEnListado[]; total: number } {
  const filtro = filtroJornadas.safeParse(Object.fromEntries(consulta));
  if (!filtro.success) throw invalido('Filtros inválidos.', filtro.error.issues);
  const f = filtro.data;
  const texto = (f.texto ?? '').toLowerCase();
  const todas = [...jornadas.values()]
    .map(aListado)
    .filter((j) => f.desde === undefined || j.fechaInicio >= f.desde)
    .filter((j) => f.hasta === undefined || j.fechaInicio <= f.hasta)
    .filter((j) => f.soloCompletas !== true || j.registroCompleto)
    .filter(
      (j) =>
        texto === '' ||
        j.descripcion.toLowerCase().includes(texto) ||
        j.codigoActividad.toLowerCase().includes(texto),
    )
    .sort((a, b) =>
      a.fechaInicio === b.fechaInicio ? b.id - a.id : a.fechaInicio < b.fechaInicio ? 1 : -1,
    );
  const desde = (f.pagina - 1) * f.porPagina;
  return { filas: todas.slice(desde, desde + f.porPagina), total: todas.length };
}

const RUTAS: readonly Ruta[] = [
  // ── Autenticación ──
  {
    metodo: 'POST',
    patron: /^\/autenticacion\/reto$/u,
    publica: true,
    manejar: () => {
      const a = 2 + Math.floor(Math.random() * 18);
      const b = 1 + Math.floor(Math.random() * 9);
      const suma = Math.random() < 0.5;
      const idCaptcha = aleatorio(24);
      const expira = Date.now() + CAPTCHA_TTL_SEGUNDOS * 1000;
      captchas.set(idCaptcha, { respuesta: String(suma ? a + b : a - b), expira });
      return json(201, {
        idCaptcha,
        textoReto: `${a} ${suma ? '+' : '-'} ${b} = ?`,
        expiraEnUtc: new Date(expira).toISOString(),
      });
    },
  },
  {
    metodo: 'POST',
    patron: /^\/autenticacion\/ingreso$/u,
    publica: true,
    manejar: ({ cuerpo }) => {
      const datos = solicitudIngreso.safeParse(cuerpo);
      // R4: un solo mensaje, sea cual sea la causa.
      const rechazo = new ErrorDemo(
        401,
        CODIGOS_ERROR.CREDENCIALES_INVALIDAS,
        MENSAJE_CREDENCIALES_INVALIDAS,
      );
      if (!datos.success) throw rechazo;
      const reto = captchas.get(datos.data.idCaptcha);
      // R3: el reto se consume aunque falle.
      captchas.delete(datos.data.idCaptcha);
      if (
        reto === undefined ||
        reto.expira < Date.now() ||
        reto.respuesta !== datos.data.respuestaCaptcha.trim()
      ) {
        throw rechazo;
      }
      if (
        datos.data.credencial !== instantanea.sesion.credencial ||
        datos.data.clave !== CLAVE_DEMO
      ) {
        throw rechazo;
      }
      const testigo = aleatorio(
        43,
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      );
      const expira = Date.now() + SESION_TTL_SEGUNDOS * 1000;
      sesiones.set(testigo, { expira });
      const respuesta: RespuestaIngreso = {
        ...instantanea.sesion,
        testigo,
        expiraEnUtc: new Date(expira).toISOString(),
      };
      return json(200, respuesta);
    },
  },
  {
    metodo: 'GET',
    patron: /^\/autenticacion\/sesion$/u,
    manejar: () =>
      json(200, {
        credencial: instantanea.sesion.credencial,
        expiraEnUtc: new Date(Date.now() + SESION_TTL_SEGUNDOS * 1000).toISOString(),
        roles: instantanea.sesion.roles,
        permisos: instantanea.sesion.permisos,
      }),
  },
  {
    metodo: 'POST',
    patron: /^\/autenticacion\/salida$/u,
    publica: true,
    manejar: () => sinContenido(),
  },

  // ── Catálogos ──
  {
    metodo: 'GET',
    patron: /^\/catalogos\/([a-z_]+)$/u,
    manejar: ({ params, consulta }) => {
      const nombre = params[0] ?? '';
      if (nombre === 'municipio') {
        const depto = Number(consulta.get('idDepartamento'));
        return json(
          200,
          municipios
            .filter((m) => m.idDepartamento === depto)
            .map(({ id, codigo, nombre: n }) => ({ id, codigo, nombre: n }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        );
      }
      const opciones = catalogos[nombre];
      if (opciones === undefined) {
        throw new ErrorDemo(400, CODIGOS_ERROR.DATOS_INVALIDOS, 'No existe ese catálogo.');
      }
      return json(200, opciones);
    },
  },

  // ── Personal ──
  {
    metodo: 'GET',
    patron: /^\/personal$/u,
    manejar: ({ consulta }) => {
      const texto = normalizarTexto(consulta.get('texto') ?? '');
      const filas = personal.filter(
        (p) =>
          texto === '' ||
          normalizarTexto(`${p.nombres} ${p.apellidos}`).includes(texto) ||
          p.numeroDocumento.startsWith(texto),
      );
      return json(200, { filas, total: filas.length });
    },
  },
  {
    metodo: 'POST',
    patron: /^\/personal$/u,
    manejar: ({ cuerpo }) => {
      const datos = crearPersonal.safeParse(cuerpo);
      if (!datos.success) throw invalido('No se pudo registrar el tripulante.', datos.error.issues);
      const tipo = opcion('tipo_documento_identidad', datos.data.idTipoDocumentoIdentidad);
      if (
        personal.some(
          (p) =>
            p.tipoDocumento === tipo?.codigo && p.numeroDocumento === datos.data.numeroDocumento,
        )
      ) {
        throw new ErrorDemo(
          409,
          CODIGOS_ERROR.CONFLICTO,
          'Ya existe un tripulante con ese tipo y número de documento. ' +
            'Búsquelo en el listado antes de volver a registrarlo.',
        );
      }
      const id = nuevoId();
      personal.push({
        id,
        numeroDocumento: datos.data.numeroDocumento,
        tipoDocumento: tipo?.codigo ?? '',
        nombres: datos.data.nombres,
        apellidos: datos.data.apellidos,
        grado: opcion('grado', datos.data.idGrado)?.nombre ?? null,
        escalafon: opcion('escalafon', datos.data.idEscalafon)?.nombre ?? null,
        unidad: instantanea.sesion.unidad.sigla,
        correo: datos.data.correo ?? null,
        telefono: datos.data.telefono ?? null,
      });
      return json(201, { id });
    },
  },

  // ── Entidades ──
  {
    metodo: 'GET',
    patron: /^\/entidades\/semejantes$/u,
    manejar: ({ consulta }) => json(200, buscarSemejantes(consulta.get('nombre') ?? '')),
  },
  {
    metodo: 'GET',
    patron: /^\/entidades$/u,
    manejar: ({ consulta }) => {
      const texto = normalizarTexto(consulta.get('texto') ?? '');
      const filas = entidades
        .filter(
          (e) =>
            texto === '' ||
            normalizarTexto(e.nombre).includes(texto) ||
            (e.nit ?? '').startsWith(texto),
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return json(200, { filas, total: filas.length });
    },
  },
  {
    metodo: 'POST',
    patron: /^\/entidades$/u,
    manejar: ({ cuerpo }) => {
      const datos = crearEntidad.safeParse(cuerpo);
      if (!datos.success) throw invalido('No se pudo registrar la entidad.', datos.error.issues);
      if (!datos.data.confirmoNoEsDuplicado) {
        const bloqueantes = buscarSemejantes(datos.data.nombre).candidatas.filter(
          (c) => c.mismoNombre || c.semejanza >= UMBRAL_BLOQUEO_ENTIDAD,
        );
        if (bloqueantes.length > 0) {
          throw new ErrorDemo(
            409,
            CODIGOS_ERROR.CONFLICTO,
            bloqueantes.length === 1
              ? `Ya existe «${bloqueantes[0]?.nombre ?? ''}», que puede ser la misma ` +
                  'entidad. Revísela; si de verdad es distinta, confirme y vuelva a guardar.'
              : `Existen ${bloqueantes.length} entidades que pueden ser la misma. ` +
                  'Revíselas; si de verdad es distinta, confirme y vuelva a guardar.',
            bloqueantes,
          );
        }
      }
      const id = nuevoId();
      entidades.push({
        id,
        nombre: datos.data.nombre,
        tipo: opcion('tipo_entidad', datos.data.idTipoEntidad)?.nombre ?? '',
        nit: datos.data.nit ?? null,
        municipio: nombreMunicipio(datos.data.idMunicipio),
        contacto: datos.data.contacto ?? null,
        telefono: datos.data.telefono ?? null,
        unidad: instantanea.sesion.unidad.sigla,
      });
      return json(201, { id });
    },
  },

  // ── Herramientas AID ──
  {
    metodo: 'GET',
    patron: /^\/herramientas$/u,
    manejar: ({ consulta }) => {
      const texto = (consulta.get('texto') ?? '').trim();
      const filas = herramientas.filter(
        (h) =>
          texto === '' ||
          normalizarTexto(h.nombre).includes(normalizarTexto(texto)) ||
          h.codigo.startsWith(texto),
      );
      return json(200, { filas, total: filas.length });
    },
  },
  {
    metodo: 'POST',
    patron: /^\/herramientas$/u,
    manejar: ({ cuerpo }) => {
      const datos = crearHerramienta.safeParse(cuerpo);
      if (!datos.success)
        throw invalido('No se pudo registrar la herramienta AID.', datos.error.issues);
      const d = datos.data;
      const tipo = opcion('tipo_herramienta_aid', d.idTipoHerramientaAid);
      if (tipo === undefined) {
        throw errorDeCampo(
          CODIGOS_ERROR.DATOS_INVALIDOS,
          'El tipo de herramienta no es válido.',
          'idTipoHerramientaAid',
          'Elija uno de los tipos de la lista.',
        );
      }
      const estado = opcion('estado_herramienta_aid', d.idEstadoHerramienta);
      if (estado === undefined) {
        throw errorDeCampo(
          CODIGOS_ERROR.DATOS_INVALIDOS,
          'El estado de la herramienta no es válido.',
          'idEstadoHerramienta',
          'Elija activa o inactiva.',
        );
      }
      if (estado.codigo === 'INACTIVA' && (d.descripcion ?? '').trim() === '') {
        throw errorDeCampo(
          CODIGOS_ERROR.DATOS_INVALIDOS,
          'Una herramienta inactiva necesita observaciones.',
          'descripcion',
          'Diga por qué está inactiva y qué gestión se hizo para ponerla en funcionamiento o darla de baja.',
        );
      }
      const responsable = personal.find((p) => p.id === d.idPersonalResponsable);
      if (responsable === undefined) {
        throw errorDeCampo(
          CODIGOS_ERROR.MAESTRO_REQUERIDO,
          'El responsable tiene que estar inscrito en Personal.',
          'idPersonalResponsable',
          'Elija a alguien registrado en Tripulantes A.I. › Personal. Si no está, regístrelo primero.',
        );
      }
      if (herramientas.some((h) => h.codigo === d.codigo)) {
        throw new ErrorDemo(
          409,
          CODIGOS_ERROR.CONFLICTO,
          'Ya existe una herramienta AID con ese código.',
        );
      }
      const id = nuevoId();
      herramientas.unshift({
        id,
        codigo: d.codigo,
        nombre: d.nombre,
        tipo: tipo.nombre,
        municipio: nombreMunicipio(d.idMunicipio),
        fechaRegistro: new Date().toISOString().slice(0, 10),
        unidad: instantanea.sesion.unidad.sigla,
        latitudDecimal: aDecimal(
          d.latitudGrados,
          d.latitudMinutos,
          d.latitudSegundos,
          d.latitudHemisferio,
        ),
        longitudDecimal: aDecimal(
          d.longitudGrados,
          d.longitudMinutos,
          d.longitudSegundos,
          d.longitudHemisferio,
        ),
        estado: estado.nombre,
        fechaPotenciacion: d.fechaPotenciacion,
        responsable: {
          nombre: [responsable.grado, responsable.nombres, responsable.apellidos]
            .filter(Boolean)
            .join(' '),
          documento: `${responsable.tipoDocumento} ${responsable.numeroDocumento}`,
          correo: responsable.correo,
          telefono: responsable.telefono,
        },
      });
      return json(201, { id });
    },
  },

  // ── Normatividad ──
  {
    metodo: 'GET',
    patron: /^\/normatividad$/u,
    manejar: () => json(200, { filas: normatividad, total: normatividad.length }),
  },

  // ── Jornadas ──
  {
    metodo: 'GET',
    patron: /^\/jornadas$/u,
    manejar: ({ consulta }) => json(200, listarJornadas(consulta)),
  },
  {
    metodo: 'GET',
    patron: /^\/jornadas\/exportacion\/([a-z]+)$/u,
    manejar: ({ params, consulta }) => {
      if ((params[0] ?? '').toUpperCase() !== 'CSV') {
        throw new ErrorDemo(
          501,
          CODIGOS_ERROR.DATOS_INVALIDOS,
          'En la demostración solo se exporta CSV. El archivo de Excel lo genera el servidor real.',
        );
      }
      consulta.set('porPagina', '500');
      consulta.set('pagina', '1');
      return new Response(csvJornadas(listarJornadas(consulta).filas), {
        status: 200,
        headers: { 'Content-Type': 'text/csv;charset=utf-8' },
      });
    },
  },
  {
    metodo: 'POST',
    patron: /^\/jornadas$/u,
    manejar: ({ cuerpo }) => {
      const datos = crearJornada.safeParse(cuerpo);
      if (!datos.success) throw invalido('No se pudo registrar la jornada.', datos.error.issues);
      const d = datos.data;
      const tipo = opcion('tipo_jornada', d.idTipoJornada);
      if (tipo === undefined) {
        throw errorDeCampo(
          CODIGOS_ERROR.DATOS_INVALIDOS,
          'El tipo de jornada no es válido.',
          'idTipoJornada',
          'Elija binacional, conjunta o estratégica.',
        );
      }
      const [anio, mes] = d.fechaEjecucion.split('-');
      const codigoActividad = `${CODIGO_UNIDAD}R${Number(mes)}${anio ?? ''}${aleatorio(5)}`;
      const id = nuevoId();
      const municipio = municipios.find((m) => m.id === d.idMunicipio);
      const filas = {} as Record<PestanaConDatos, FilaPestana[]>;
      for (const p of Object.keys(ESQUEMA_POR_PESTANA) as PestanaConDatos[]) filas[p] = [];
      jornadas.set(id, {
        filas,
        adjuntos: [],
        detalle: {
          id,
          codigoActividad,
          unidad: instantanea.sesion.unidad.sigla,
          descripcion: d.descripcion,
          fechaInicio: d.fechaInicio,
          fechaFin: d.fechaFin ?? null,
          fechaEjecucion: d.fechaEjecucion,
          lugar: d.lugar,
          observaciones: d.observaciones ?? null,
          idMunicipio: municipio?.id ?? null,
          idDepartamento: municipio?.idDepartamento ?? null,
          municipio: municipio?.nombre ?? null,
          idTipoJornada: tipo.id,
          tipoJornada: tipo.nombre,
          participoEjc: d.participoEjc,
          participoFac: d.participoFac,
          poblacionAfectaTropa: d.poblacionAfectaTropa,
          latitudGrados: d.latitudGrados,
          latitudMinutos: d.latitudMinutos,
          latitudSegundos: d.latitudSegundos,
          latitudHemisferio: d.latitudHemisferio,
          longitudGrados: d.longitudGrados,
          longitudMinutos: d.longitudMinutos,
          longitudSegundos: d.longitudSegundos,
          longitudHemisferio: d.longitudHemisferio,
          latitudDecimal: aDecimal(
            d.latitudGrados,
            d.latitudMinutos,
            d.latitudSegundos,
            d.latitudHemisferio,
          ),
          longitudDecimal: aDecimal(
            d.longitudGrados,
            d.longitudMinutos,
            d.longitudSegundos,
            d.longitudHemisferio,
          ),
          coami: [...d.coami],
          registroCompleto: false,
        },
      });
      return json(201, { id, codigoActividad });
    },
  },
  {
    metodo: 'GET',
    patron: /^\/jornadas\/(\d+)$/u,
    manejar: ({ params }) => json(200, jornadaDe(Number(params[0])).detalle),
  },
  {
    metodo: 'PATCH',
    patron: /^\/jornadas\/(\d+)$/u,
    manejar: ({ params, cuerpo }) => {
      const j = jornadaDe(Number(params[0]));
      const datos = actualizarJornada.safeParse(cuerpo);
      if (!datos.success) throw invalido('No se pudo modificar la jornada.', datos.error.issues);
      const d = datos.data;
      let tipo: OpcionCatalogo | undefined;
      if (d.idTipoJornada !== undefined) {
        tipo = opcion('tipo_jornada', d.idTipoJornada);
        if (tipo === undefined) {
          throw errorDeCampo(
            CODIGOS_ERROR.DATOS_INVALIDOS,
            'El tipo de jornada no es válido.',
            'idTipoJornada',
            'Elija binacional, conjunta o estratégica.',
          );
        }
      }
      const municipio =
        d.idMunicipio === undefined ? undefined : municipios.find((m) => m.id === d.idMunicipio);
      const antes = j.detalle;
      const gms = {
        latitudGrados: d.latitudGrados ?? antes.latitudGrados,
        latitudMinutos: d.latitudMinutos ?? antes.latitudMinutos,
        latitudSegundos: d.latitudSegundos ?? antes.latitudSegundos,
        latitudHemisferio: d.latitudHemisferio ?? antes.latitudHemisferio,
        longitudGrados: d.longitudGrados ?? antes.longitudGrados,
        longitudMinutos: d.longitudMinutos ?? antes.longitudMinutos,
        longitudSegundos: d.longitudSegundos ?? antes.longitudSegundos,
        longitudHemisferio: d.longitudHemisferio ?? antes.longitudHemisferio,
      };
      j.detalle = {
        ...antes,
        ...gms,
        descripcion: d.descripcion ?? antes.descripcion,
        fechaInicio: d.fechaInicio ?? antes.fechaInicio,
        fechaFin: d.fechaFin ?? antes.fechaFin,
        fechaEjecucion: d.fechaEjecucion ?? antes.fechaEjecucion,
        lugar: d.lugar ?? antes.lugar,
        observaciones: d.observaciones ?? antes.observaciones,
        ...(municipio !== undefined
          ? {
              idMunicipio: municipio.id,
              idDepartamento: municipio.idDepartamento,
              municipio: municipio.nombre,
            }
          : {}),
        ...(tipo !== undefined ? { idTipoJornada: tipo.id, tipoJornada: tipo.nombre } : {}),
        participoEjc: d.participoEjc ?? antes.participoEjc,
        participoFac: d.participoFac ?? antes.participoFac,
        poblacionAfectaTropa: d.poblacionAfectaTropa ?? antes.poblacionAfectaTropa,
        coami: d.coami ?? antes.coami,
        latitudDecimal: aDecimal(
          gms.latitudGrados,
          gms.latitudMinutos,
          gms.latitudSegundos,
          gms.latitudHemisferio,
        ),
        longitudDecimal: aDecimal(
          gms.longitudGrados,
          gms.longitudMinutos,
          gms.longitudSegundos,
          gms.longitudHemisferio,
        ),
      };
      return sinContenido();
    },
  },
  {
    metodo: 'GET',
    patron: /^\/jornadas\/(\d+)\/pestanas$/u,
    manejar: ({ params }) => {
      const j = jornadaDe(Number(params[0]));
      const estado = evaluarPestanas(pestanasConDatos(j));
      return json(200, {
        registroCompleto: j.detalle.registroCompleto,
        faltantes: estado.faltantes,
        completas: estado.completas,
      });
    },
  },
  {
    metodo: 'GET',
    patron: /^\/jornadas\/(\d+)\/pestanas\/([A-Z_]+)$/u,
    manejar: ({ params }) => {
      const j = jornadaDe(Number(params[0]));
      const pestana = params[1] ?? '';
      if (!esPestanaConDatos(pestana)) {
        throw new ErrorDemo(
          400,
          CODIGOS_ERROR.DATOS_INVALIDOS,
          `«${pestana}» no es una pestaña de datos.`,
        );
      }
      return json(200, j.filas[pestana]);
    },
  },
  {
    metodo: 'POST',
    patron: /^\/jornadas\/(\d+)\/pestanas\/([A-Z_]+)$/u,
    manejar: ({ params, cuerpo }) => {
      const j = jornadaDe(Number(params[0]));
      const pestana = params[1] ?? '';
      if (!esPestanaConDatos(pestana)) {
        throw new ErrorDemo(
          400,
          CODIGOS_ERROR.DATOS_INVALIDOS,
          `«${pestana}» no es una pestaña de datos.`,
        );
      }
      const datos = ESQUEMA_POR_PESTANA[pestana].safeParse(cuerpo);
      if (!datos.success) throw invalido('Datos inválidos para la pestaña.', datos.error.issues);
      const campos: Record<string, string | number | null> = {};
      const nombres: Record<string, string> = {};
      for (const [campo, valor] of Object.entries(datos.data as Record<string, unknown>)) {
        campos[campo] = typeof valor === 'number' || typeof valor === 'string' ? valor : null;
        if (typeof valor !== 'number') continue;
        const catalogo = CATALOGO_DE_CAMPO[campo];
        const nombre =
          catalogo !== undefined
            ? opcion(catalogo, valor)?.nombre
            : campo === 'idEntidad' || campo === 'idEntidadDonante'
              ? entidades.find((e) => e.id === valor)?.nombre
              : undefined;
        if (catalogo !== undefined || campo === 'idEntidad' || campo === 'idEntidadDonante') {
          if (nombre === undefined) {
            throw errorDeCampo(
              CODIGOS_ERROR.DATOS_INVALIDOS,
              'Datos inválidos para la pestaña.',
              campo,
              'Elija una opción de la lista.',
            );
          }
          nombres[campo] = nombre;
        }
      }
      const clave = CLAVE_DE_PESTANA[pestana];
      if (
        clave.length > 0 &&
        j.filas[pestana].some((f) => clave.every((c) => f.campos[c] === campos[c]))
      ) {
        throw new ErrorDemo(
          409,
          CODIGOS_ERROR.CONFLICTO,
          `Esa entrada ya está registrada en la pestaña ${pestana}. ` +
            'Modifique la existente en lugar de añadirla de nuevo.',
        );
      }
      // RESUMEN es uno a uno: registrar otra vez lo reemplaza.
      if (pestana === 'RESUMEN') j.filas.RESUMEN.length = 0;
      const id = pestana === 'RESUMEN' ? j.detalle.id : nuevoId();
      j.filas[pestana].push({ id, campos, nombres });
      recalcular(j);
      return json(201, { id });
    },
  },
  {
    metodo: 'DELETE',
    patron: /^\/jornadas\/(\d+)\/pestanas\/([A-Z_]+)\/(\d+)$/u,
    manejar: ({ params }) => {
      const j = jornadaDe(Number(params[0]));
      const pestana = params[1] ?? '';
      if (!esPestanaConDatos(pestana)) {
        throw new ErrorDemo(
          400,
          CODIGOS_ERROR.DATOS_INVALIDOS,
          `«${pestana}» no es una pestaña de datos.`,
        );
      }
      const indice = j.filas[pestana].findIndex((f) => f.id === Number(params[2]));
      if (indice === -1)
        throw new ErrorDemo(404, CODIGOS_ERROR.RECURSO_NO_ENCONTRADO, 'No se encontró esa fila.');
      j.filas[pestana].splice(indice, 1);
      recalcular(j);
      return sinContenido();
    },
  },

  // ── Adjuntos (R11, R12) ──
  {
    metodo: 'GET',
    patron: /^\/jornadas\/(\d+)\/adjuntos\/cuota$/u,
    manejar: ({ params }) => {
      const j = jornadaDe(Number(params[0]));
      return json(200, {
        ...calcularCuota(j.adjuntos.filter((a) => a.vigente).map((a) => a.listado.pesoBytes)),
        cuotaTotalBytes: CUOTA_BYTES_POR_ACTIVIDAD,
      });
    },
  },
  {
    metodo: 'GET',
    patron: /^\/jornadas\/(\d+)\/adjuntos$/u,
    manejar: ({ params }) =>
      json(
        200,
        jornadaDe(Number(params[0]))
          .adjuntos.filter((a) => a.vigente)
          .map((a) => a.listado),
      ),
  },
  {
    metodo: 'GET',
    patron: /^\/jornadas\/(\d+)\/adjuntos\/(\d+)$/u,
    manejar: ({ params }) => {
      const a = jornadaDe(Number(params[0])).adjuntos.find(
        (x) => x.listado.id === Number(params[1]) && x.vigente,
      );
      if (a === undefined)
        throw new ErrorDemo(404, CODIGOS_ERROR.RECURSO_NO_ENCONTRADO, 'No se encontró el adjunto.');
      return new Response(new Blob([new Uint8Array(a.contenido)], { type: a.mime }), {
        status: 200,
      });
    },
  },
  {
    metodo: 'DELETE',
    patron: /^\/jornadas\/(\d+)\/adjuntos\/(\d+)$/u,
    manejar: ({ params }) => {
      const j = jornadaDe(Number(params[0]));
      const a = j.adjuntos.find((x) => x.listado.id === Number(params[1]) && x.vigente);
      if (a === undefined)
        throw new ErrorDemo(404, CODIGOS_ERROR.RECURSO_NO_ENCONTRADO, 'No se encontró el adjunto.');
      a.vigente = false;
      recalcular(j);
      return sinContenido();
    },
  },
  {
    metodo: 'POST',
    patron: /^\/jornadas\/(\d+)\/adjuntos$/u,
    manejar: async ({ params, formulario }) => {
      const j = jornadaDe(Number(params[0]));
      const archivo = formulario?.get('archivo');
      if (!(archivo instanceof File)) {
        throw new ErrorDemo(
          400,
          CODIGOS_ERROR.DATOS_INVALIDOS,
          'No se recibió ningún archivo en el campo «archivo».',
        );
      }
      const fase = Number(formulario?.get('faseDocumental'));
      if (!(FASES_DOCUMENTALES as readonly number[]).includes(fase)) {
        throw new ErrorDemo(400, CODIGOS_ERROR.DATOS_INVALIDOS, 'La fase documental es 1, 2 o 3.');
      }
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      if (bytes.byteLength === 0)
        throw new ErrorDemo(400, CODIGOS_ERROR.DATOS_INVALIDOS, 'El archivo está vacío.');
      const extension = extensionDe(archivo.name);
      if (extension === '') {
        throw new ErrorDemo(
          415,
          CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
          'El archivo no tiene extensión.',
        );
      }
      if (!extensionPermitida(extension)) {
        throw new ErrorDemo(
          415,
          CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
          `La extensión «${extension}» no está permitida.`,
        );
      }
      const mime = detectarMime(bytes);
      if (mime === null) {
        throw new ErrorDemo(
          415,
          CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
          'No se pudo reconocer el contenido del archivo. Verifique que no esté dañado.',
        );
      }
      if (
        !mimeCoincideConExtension(extension, mime) &&
        !(MIME_ESPERADO_POR_EXTENSION[extension] ?? []).includes(mime)
      ) {
        throw new ErrorDemo(
          415,
          CODIGOS_ERROR.TIPO_ARCHIVO_NO_PERMITIDO,
          `El contenido del archivo no corresponde a la extensión «${extension}». Se detectó «${mime}».`,
        );
      }
      const cuota = calcularCuota(
        j.adjuntos.filter((a) => a.vigente).map((a) => a.listado.pesoBytes),
      );
      if (bytes.byteLength > cuota.bytesDisponibles) {
        throw new ErrorDemo(
          413,
          CODIGOS_ERROR.CUOTA_ADJUNTOS_AGOTADA,
          `La actividad ya usa ${formatearBytes(cuota.bytesUsados)} de los ` +
            `${formatearBytes(CUOTA_BYTES_POR_ACTIVIDAD)} disponibles. ` +
            `Este archivo pesa ${formatearBytes(bytes.byteLength)} y no cabe. ` +
            'La cuota de 10 MB es del total de la actividad, no de cada archivo.',
          { cuota },
        );
      }
      const categoria = categoriaDeExtension(extension) ?? 'DOCUMENTO';
      const id = nuevoId();
      j.adjuntos.push({
        listado: {
          id,
          nombreArchivo: archivo.name,
          categoria: NOMBRE_CATEGORIA[categoria] ?? categoria,
          pesoBytes: bytes.byteLength,
          faseDocumental: fase,
          cargadoEn: new Date().toISOString(),
        },
        contenido: bytes,
        mime,
        vigente: true,
      });
      recalcular(j);
      return json(201, {
        id,
        nombreArchivo: archivo.name,
        extension,
        categoria,
        mimeDetectado: mime,
        pesoBytes: bytes.byteLength,
        hashSha256: await resumenSha256(bytes),
        faseDocumental: fase,
        cuota: calcularCuota(j.adjuntos.filter((a) => a.vigente).map((a) => a.listado.pesoBytes)),
      });
    },
  },
];

function buscarSemejantes(nombre: string): {
  candidatas: EntidadSemejante[];
  umbralAviso: number;
  umbralBloqueo: number;
} {
  const buscado = nombre.trim();
  const base = { umbralAviso: UMBRAL_SEMEJANZA_ENTIDAD, umbralBloqueo: UMBRAL_BLOQUEO_ENTIDAD };
  if (buscado.length < 3) return { candidatas: [], ...base };
  const candidatas = entidades
    .map((e) => ({
      ...e,
      semejanza: Math.round(semejanza(e.nombre, buscado) * 1000) / 1000,
      mismoNombre: normalizarTexto(e.nombre) === normalizarTexto(buscado),
    }))
    .filter((c) => c.mismoNombre || c.semejanza >= UMBRAL_SEMEJANZA_ENTIDAD)
    .sort((a, b) => Number(b.mismoNombre) - Number(a.mismoNombre) || b.semejanza - a.semejanza)
    .slice(0, 8)
    .map(({ contacto: _c, telefono: _t, ...resto }) => resto);
  return { candidatas, ...base };
}

// ── Entrada: el sustituto de `fetch` ───────────────────────────────────────

/** Una pausa corta, para que la interfaz se vea como con una red de verdad. */
const latencia = (): Promise<void> => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

export async function fetchDemo(entrada: string, opciones: RequestInit = {}): Promise<Response> {
  await latencia();
  const url = new URL(entrada, 'http://demo.local');
  const ruta = url.pathname.replace(/^\/api/u, '');
  const metodo = (opciones.method ?? 'GET').toUpperCase();

  try {
    const coincidente = RUTAS.find((r) => r.metodo === metodo && r.patron.test(ruta));
    if (coincidente === undefined) {
      throw new ErrorDemo(
        404,
        CODIGOS_ERROR.RECURSO_NO_ENCONTRADO,
        'Esa función no está en la demostración.',
      );
    }

    // R1: sesión de 10 minutos, deslizante.
    if (coincidente.publica !== true) {
      const cabeceras = new Headers(opciones.headers);
      const testigo = cabeceras.get(CABECERA_TESTIGO) ?? '';
      const sesion = sesiones.get(testigo);
      if (sesion === undefined || sesion.expira < Date.now()) {
        sesiones.delete(testigo);
        throw new ErrorDemo(
          401,
          CODIGOS_ERROR.SESION_EXPIRADA,
          'La sesión expiró por inactividad. Ingrese de nuevo.',
        );
      }
      sesion.expira = Date.now() + SESION_TTL_SEGUNDOS * 1000;
    }

    const cuerpo =
      typeof opciones.body === 'string' ? (JSON.parse(opciones.body) as unknown) : undefined;
    const formulario = opciones.body instanceof FormData ? opciones.body : null;
    const params = coincidente.patron.exec(ruta)?.slice(1) ?? [];
    return await coincidente.manejar({ params, consulta: url.searchParams, cuerpo, formulario });
  } catch (error: unknown) {
    const idCorrelacion = aleatorio(12).toLowerCase();
    if (error instanceof ErrorDemo) {
      return json(error.estado, {
        codigo: error.codigo,
        mensaje: error.message,
        ...(error.detalles !== undefined ? { detalles: error.detalles } : {}),
        idCorrelacion,
      });
    }
    return json(500, {
      codigo: CODIGOS_ERROR.INTERNO,
      mensaje: 'Ocurrió un error interno en la demostración.',
      idCorrelacion,
    });
  }
}
