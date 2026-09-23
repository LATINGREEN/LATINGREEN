import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ZONA_HORARIA_PRESENTACION, formatearFechaDdMmAaaa } from '@paid/schema';
import type { FormatoExportacion, JornadaEnListado } from '@paid/schema';
import { BaseDatosService } from '../basedatos/basedatos.service';

/**
 * Exportación XLSX y CSV (PROMPT.md Fase 3, punto 4), con registro en
 * `aud.exportacion`.
 *
 * `exceljs` y generación propia de CSV, como fija A.1: «Nada que llame a un
 * servicio.»
 */
export interface ResultadoExportacion {
  readonly contenido: Buffer;
  readonly nombreArchivo: string;
  readonly tipoMime: string;
  readonly cantidadFilas: number;
}

/**
 * Las columnas del listado del manual (lámina 19), en su orden: tipo de
 * jornada y participación de EJC, ARC y FAC van después de la unidad.
 */
const COLUMNAS = [
  { clave: 'codigoActividad', titulo: 'Código', ancho: 22 },
  { clave: 'unidad', titulo: 'Unidad', ancho: 12 },
  { clave: 'tipoJornada', titulo: 'Tipo de jornada', ancho: 16 },
  { clave: 'participoEjc', titulo: 'Participó EJC', ancho: 14 },
  { clave: 'participoArc', titulo: 'Participó ARC', ancho: 14 },
  { clave: 'participoFac', titulo: 'Participó FAC', ancho: 14 },
  { clave: 'poblacionAfectaTropa', titulo: 'Población afecta', ancho: 16 },
  { clave: 'fechaEjecucion', titulo: 'Fecha ejecución', ancho: 16 },
  { clave: 'lugar', titulo: 'Lugar', ancho: 30 },
  { clave: 'municipio', titulo: 'Municipio', ancho: 22 },
  { clave: 'descripcion', titulo: 'Descripción', ancho: 60 },
  { clave: 'latitudDecimal', titulo: 'Latitud', ancho: 12 },
  { clave: 'longitudDecimal', titulo: 'Longitud', ancho: 12 },
  { clave: 'registroCompleto', titulo: 'Registro completo', ancho: 18 },
  { clave: 'pestanasFaltantes', titulo: 'Pestañas faltantes', ancho: 40 },
] as const;

function siNo(valor: boolean | null): string {
  if (valor === null) return '';
  return valor ? 'SÍ' : 'NO';
}

@Injectable()
export class ExportacionService {
  constructor(private readonly baseDatos: BaseDatosService) {}

  /**
   * Valor de una celda, ya formateado para presentación.
   *
   * ⚠️ A.2.4/A.2.5. Las fechas salen como `dd/mm/aaaa` y los decimales con
   * PUNTO. No se dejan como `Date` ni como número «para que Excel los
   * interprete»: Excel los interpreta según la configuración regional de quien
   * abre el archivo, y el mismo consolidado leído en dos equipos distintos
   * daría fechas distintas. Se exporta texto ya resuelto.
   */
  private celda(fila: JornadaEnListado, clave: string): string {
    switch (clave) {
      case 'fechaEjecucion':
        return formatearFechaDdMmAaaa(fila.fechaEjecucion);
      case 'registroCompleto':
        return fila.registroCompleto ? 'SÍ' : 'NO';
      // R9: la ARC siempre participa; la base lo impone con un CHECK.
      case 'participoArc':
        return 'SÍ';
      // Una celda vacía, no «NO»: en las jornadas anteriores a la migración
      // 0015 el dato no se registró, y un «NO» sería una afirmación falsa en
      // el consolidado.
      case 'participoEjc':
        return siNo(fila.participoEjc);
      case 'participoFac':
        return siNo(fila.participoFac);
      case 'poblacionAfectaTropa':
        return siNo(fila.poblacionAfectaTropa);
      case 'tipoJornada':
        return fila.tipoJornada ?? '';
      case 'pestanasFaltantes':
        return fila.pestanasFaltantes.join(', ');
      case 'latitudDecimal':
        return fila.latitudDecimal.toFixed(6);
      case 'longitudDecimal':
        return fila.longitudDecimal.toFixed(6);
      case 'municipio':
        return fila.municipio ?? '';
      default: {
        const valor = (fila as unknown as Record<string, unknown>)[clave];
        return valor === null || valor === undefined ? '' : String(valor);
      }
    }
  }

  private generarCsv(filas: readonly JornadaEnListado[]): Buffer {
    /*
     * Escapado de CSV a mano, que es lo que A.1 pide («generación propia de
     * CSV»). Las tres reglas de RFC 4180 que importan: comillas dobles
     * alrededor del campo si contiene coma, comillas o salto de línea; y las
     * comillas internas se duplican.
     *
     * La descripción es un clavegrama y lleva saltos de línea, así que este
     * escapado no es teórico: sin él, cada clavegrama rompería el archivo.
     */
    const escapar = (valor: string): string =>
      /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

    const lineas: string[] = [COLUMNAS.map((c) => escapar(c.titulo)).join(',')];
    for (const fila of filas) {
      lineas.push(COLUMNAS.map((c) => escapar(this.celda(fila, c.clave))).join(','));
    }

    /*
     * BOM UTF-8 al principio. Sin él, Excel en Windows abre el CSV en la
     * codificación regional y «Población Beneficiada» se lee «PoblaciÃ³n». El
     * BOM es lo que hace que un CSV con tildes y eñes sea utilizable por el
     * destinatario real de estos archivos.
     */
    return Buffer.concat([
      Buffer.from('﻿', 'utf8'),
      Buffer.from(lineas.join('\r\n'), 'utf8'),
    ]);
  }

  private async generarXlsx(filas: readonly JornadaEnListado[]): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'PAID — Plataforma de Acción Integral y Desarrollo';
    libro.created = new Date();

    const hoja = libro.addWorksheet('Jornadas de Apoyo', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    hoja.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));

    const encabezado = hoja.getRow(1);
    encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    encabezado.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00305E' }, // azul institucional
    };

    for (const fila of filas) {
      const agregada = hoja.addRow(
        Object.fromEntries(COLUMNAS.map((c) => [c.clave, this.celda(fila, c.clave)])),
      );
      // R19: el listado señala los registros incompletos, y la exportación
      // también. Un consolidado que no distingue lo completo de lo incompleto
      // es el que descuadra el RAO sin avisar.
      if (!fila.registroCompleto) {
        agregada.getCell('registroCompleto').font = { color: { argb: 'FF8A1C1C' }, bold: true };
      }
      agregada.getCell('descripcion').alignment = { wrapText: true, vertical: 'top' };
    }

    hoja.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNAS.length } };

    const arreglo = await libro.xlsx.writeBuffer();
    return Buffer.from(arreglo);
  }

  /**
   * Genera el archivo **y registra la exportación**.
   *
   * El registro no es opcional: en un sistema clasificado, quién se llevó qué
   * datos y cuándo es parte del expediente. Y va con los filtros, porque
   * «exportó jornadas» sin ellos no dice cuántas ni de quién.
   */
  async exportarJornadas(
    formato: FormatoExportacion,
    filas: readonly JornadaEnListado[],
    filtros: Record<string, unknown>,
  ): Promise<ResultadoExportacion> {
    const contexto = this.baseDatos.contextoActual;
    if (contexto === undefined) {
      throw new Error('Sin contexto de sesión: no se puede registrar la exportación.');
    }

    const contenido =
      formato === 'XLSX' ? await this.generarXlsx(filas) : this.generarCsv(filas);

    const marca = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-');

    await this.baseDatos.cliente.query(
      `INSERT INTO aud.exportacion
         (id_usuario, id_unidad, modulo, formato, filtros, cantidad_filas,
          direccion_ip, id_sesion)
       VALUES ($1, $2, 'JORNADAS', $3, $4, $5, $6, $7)`,
      [
        contexto.idUsuario,
        contexto.idUnidad,
        formato,
        JSON.stringify(filtros),
        filas.length,
        contexto.direccionIp,
        contexto.idSesion,
      ],
    );

    return {
      contenido,
      nombreArchivo: `jornadas-${marca}.${formato.toLowerCase()}`,
      tipoMime:
        formato === 'XLSX'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
      cantidadFilas: filas.length,
    };
  }

  /** La zona en la que se presentan los instantes. Documentada en el archivo. */
  get zonaPresentacion(): string {
    return ZONA_HORARIA_PRESENTACION;
  }
}
