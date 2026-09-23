import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  CODIGOS_ERROR,
  CUOTA_BYTES_POR_ACTIVIDAD,
  FASES_DOCUMENTALES,
  actualizarJornada,
  crearJornada,
  esPestanaConDatos,
  filtroJornadas,
} from '@paid/schema';
import type { EstadoCuota, FaseDocumental, FormatoExportacion } from '@paid/schema';
import { RequierePermiso } from '../seguridad/requiere-permiso.decorator';
import { AdjuntosService } from '../adjuntos/adjuntos.service';
import { ExportacionService } from '../exportacion/exportacion.service';
import { JornadasService } from './jornadas.service';

/**
 * Jornadas de Apoyo al Desarrollo: la rebanada vertical de la Fase 3.
 *
 * Ninguna consulta lleva `WHERE id_unidad = ...`: RLS ya filtra por el
 * contexto que fijó el interceptor (R6/R7). Añadirlo sería redundante, y si
 * RLS faltara sería la única defensa, que es lo que R6 prohíbe expresamente.
 */
@Controller('jornadas')
export class JornadasController {
  constructor(
    private readonly jornadas: JornadasService,
    private readonly adjuntos: AdjuntosService,
    private readonly exportacion: ExportacionService,
  ) {}

  @RequierePermiso('JORNADA.CONSULTAR')
  @Get()
  async listar(@Query() consulta: unknown) {
    const filtro = filtroJornadas.safeParse(consulta);
    if (!filtro.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'Filtros inválidos.',
        detalles: filtro.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        })),
      });
    }
    return this.jornadas.listar(filtro.data);
  }

  @RequierePermiso('JORNADA.CREAR')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() cuerpo: unknown) {
    const datos = crearJornada.safeParse(cuerpo);
    if (!datos.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No se pudo registrar la jornada.',
        detalles: datos.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        })),
      });
    }
    return this.jornadas.crear(datos.data);
  }

  @RequierePermiso('JORNADA.EDITAR')
  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cuerpo: unknown,
  ): Promise<void> {
    const datos = actualizarJornada.safeParse(cuerpo);
    if (!datos.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No se pudo modificar la jornada.',
        detalles: datos.error.issues.map((i) => ({
          campo: i.path.join('.'),
          mensaje: i.message,
        })),
      });
    }
    await this.jornadas.actualizar(id, datos.data);
  }

  /** Los datos generales, para diligenciar con el clavegrama a la vista. */
  @RequierePermiso('JORNADA.CONSULTAR')
  @Get(':id')
  async detalle(@Param('id', ParseIntPipe) id: number) {
    return this.jornadas.detalle(id);
  }

  /** Las filas ya registradas en una pestaña, con sus nombres legibles. */
  @RequierePermiso('JORNADA.CONSULTAR')
  @Get(':id/pestanas/:pestana')
  async filasPestana(
    @Param('id', ParseIntPipe) id: number,
    @Param('pestana') pestana: string,
  ) {
    if (!esPestanaConDatos(pestana)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: `«${pestana}» no es una pestaña de datos.`,
      });
    }
    return this.jornadas.filasPestana(id, pestana);
  }

  /** R19 — qué pestañas faltan. Lo que la interfaz pinta como aviso. */
  @RequierePermiso('JORNADA.CONSULTAR')
  @Get(':id/pestanas')
  async estadoPestanas(@Param('id', ParseIntPipe) id: number) {
    return this.jornadas.estadoPestanas(id);
  }

  /**
   * Una sola ruta para las diez pestañas de datos, resuelta por
   * `MAPA_PESTANAS`. El motivo está en `pestanas.mapa.ts`: Q4 sigue sin
   * responder y las tablas son estructuralmente iguales.
   */
  @RequierePermiso('JORNADA.EDITAR')
  @Post(':id/pestanas/:pestana')
  @HttpCode(HttpStatus.CREATED)
  async agregarFilaPestana(
    @Param('id', ParseIntPipe) id: number,
    @Param('pestana') pestana: string,
    @Body() cuerpo: unknown,
  ) {
    if (!esPestanaConDatos(pestana)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje:
          `«${pestana}» no es una pestaña de datos. Los archivos adjuntos van ` +
          'por su propia ruta, porque hay que leer su contenido.',
      });
    }
    return this.jornadas.agregarFilaPestana(id, pestana, cuerpo);
  }

  @RequierePermiso('JORNADA.EDITAR')
  @Delete(':id/pestanas/:pestana/:idFila')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarFilaPestana(
    @Param('id', ParseIntPipe) id: number,
    @Param('pestana') pestana: string,
    @Param('idFila', ParseIntPipe) idFila: number,
  ): Promise<void> {
    if (!esPestanaConDatos(pestana)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: `«${pestana}» no es una pestaña de datos.`,
      });
    }
    await this.jornadas.eliminarFilaPestana(id, pestana, idFila);
  }

  /**
   * R11 — el consumo acumulado, **antes** de que el usuario intente subir.
   *
   * Existe como endpoint propio y no como dato de la carga precisamente por
   * eso: el usuario tiene que poder ver qué le queda sin gastar un intento.
   */
  @RequierePermiso('ADJUNTO.CONSULTAR')
  @Get(':id/adjuntos/cuota')
  async cuota(@Param('id', ParseIntPipe) id: number): Promise<
    EstadoCuota & { cuotaTotalBytes: number }
  > {
    const cuota = await this.adjuntos.consultarCuota(id);
    return { ...cuota, cuotaTotalBytes: CUOTA_BYTES_POR_ACTIVIDAD };
  }

  @RequierePermiso('ADJUNTO.CARGAR')
  @Post(':id/adjuntos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('archivo', {
      // El límite de multer es la cuota COMPLETA de la actividad, no un límite
      // por archivo: un archivo que por sí solo la supera no puede caber, así
      // que se rechaza antes de leerlo entero. La regla agregada de R11 la
      // aplica después `AdjuntosService`, y el disparador de la base al final.
      limits: { fileSize: CUOTA_BYTES_POR_ACTIVIDAD, files: 1 },
    }),
  )
  async cargarAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: { originalname: string; buffer: Buffer } | undefined,
    @Body('faseDocumental') faseCruda: unknown,
  ) {
    if (archivo === undefined) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'No se recibió ningún archivo en el campo «archivo».',
      });
    }
    const fase = Number(faseCruda);
    if (!(FASES_DOCUMENTALES as readonly number[]).includes(fase)) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'La fase documental es 1, 2 o 3.',
      });
    }
    return this.adjuntos.cargar(
      id,
      { nombreArchivo: archivo.originalname, contenido: archivo.buffer },
      fase as FaseDocumental,
    );
  }

  /** Los soportes vigentes, para que la persona vea lo que ya adjuntó. */
  @RequierePermiso('ADJUNTO.CONSULTAR')
  @Get(':id/adjuntos')
  async listarAdjuntos(@Param('id', ParseIntPipe) id: number) {
    return this.adjuntos.listar(id);
  }

  @RequierePermiso('ADJUNTO.CONSULTAR')
  @Get(':id/adjuntos/:idAdjunto')
  async descargarAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Param('idAdjunto', ParseIntPipe) idAdjunto: number,
    @Res() respuesta: Response,
  ): Promise<void> {
    const adjunto = await this.adjuntos.leer(id, idAdjunto);
    respuesta
      .status(HttpStatus.OK)
      .setHeader('Content-Type', adjunto.mime)
      // `attachment` y no `inline`: un HTML o un SVG servido en línea desde el
      // mismo origen podría ejecutar guion. Los adjuntos se descargan.
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(adjunto.nombre)}"`,
      )
      .send(adjunto.contenido);
  }

  /** R14 — baja lógica. El binario no se destruye. */
  @RequierePermiso('ADJUNTO.CARGAR')
  @Delete(':id/adjuntos/:idAdjunto')
  @HttpCode(HttpStatus.NO_CONTENT)
  async darDeBajaAdjunto(
    @Param('id', ParseIntPipe) id: number,
    @Param('idAdjunto', ParseIntPipe) idAdjunto: number,
  ): Promise<void> {
    await this.adjuntos.darDeBaja(id, idAdjunto);
  }

  /** Exportación XLSX y CSV, con registro en `aud.exportacion`. */
  @RequierePermiso('EXPORTACION.GENERAR')
  @Get('exportacion/:formato')
  async exportar(
    @Param('formato') formatoCrudo: string,
    @Query() consulta: unknown,
    @Res() respuesta: Response,
  ): Promise<void> {
    const formato = formatoCrudo.toUpperCase();
    if (formato !== 'XLSX' && formato !== 'CSV') {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'El formato es XLSX o CSV.',
      });
    }

    const filtro = filtroJornadas.safeParse(consulta);
    if (!filtro.success) {
      throw new BadRequestException({
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'Filtros inválidos.',
      });
    }

    // Se exporta lo que el filtro seleccione, hasta el tope de la página. Una
    // exportación que silenciosamente recorta a 50 filas es peor que una que
    // falla: el consolidado saldría incompleto sin avisar.
    const { filas } = await this.jornadas.listar({ ...filtro.data, porPagina: 500, pagina: 1 });

    const archivo = await this.exportacion.exportarJornadas(
      formato as FormatoExportacion,
      filas,
      filtro.data as unknown as Record<string, unknown>,
    );

    respuesta
      .status(HttpStatus.OK)
      .setHeader('Content-Type', archivo.tipoMime)
      .setHeader('Content-Disposition', `attachment; filename="${archivo.nombreArchivo}"`)
      .setHeader('X-Paid-Filas-Exportadas', String(archivo.cantidadFilas))
      .send(archivo.contenido);
  }
}
