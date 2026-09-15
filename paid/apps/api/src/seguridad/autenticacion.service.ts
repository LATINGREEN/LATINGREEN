import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTENTOS_ANTES_DE_BLOQUEO, MENSAJE_CREDENCIALES_INVALIDAS } from '@paid/schema';
import type { RespuestaIngreso, RetoCaptcha, SolicitudIngreso } from '@paid/schema';
import type { PoolClient } from 'pg';
import { BaseDatosService } from '../basedatos/basedatos.service';
import { CaptchaService } from './captcha.service';
import { ClaveService } from './clave.service';
import { RedService } from './red.service';
import { SesionService } from './sesion.service';

/**
 * El flujo de ingreso (PROMPT.md Fase 2, punto 1):
 *
 *   reto de captcha -> validacion de red -> captcha -> credencial ->
 *   estado y vigencia -> sesion
 *
 * ⚠️ R4 gobierna todo este archivo. `seg.intento_autenticacion` distingue OCHO
 * causas para el analisis forense, pero **la pantalla siempre dice lo mismo**:
 * «Credenciales invalidas». La distincion vive en la base, no en la interfaz.
 *
 * En la practica eso significa que este servicio nunca devuelve un motivo al
 * llamante: devuelve la sesion, o nada. El motivo se escribe en la base y se
 * queda ahi.
 */
export type ResultadoIntento =
  | 'EXITOSO'
  | 'CLAVE_INVALIDA'
  | 'USUARIO_INEXISTENTE'
  | 'CAPTCHA_INVALIDO'
  | 'USUARIO_BLOQUEADO'
  | 'USUARIO_INACTIVO'
  | 'RED_NO_AUTORIZADA'
  | 'CLAVE_EXPIRADA';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FilaUsuario {
  readonly id: string;
  readonly credencial: string;
  readonly hash_clave: string;
  readonly id_unidad: string;
  readonly activo: boolean;
  readonly bloqueado_en: Date | null;
  readonly intentos_fallidos: number;
  readonly clave_expira_en: Date | null;
  readonly estado: string;
}

@Injectable()
export class AutenticacionService {
  private readonly avisoSegundos: number;

  constructor(
    @Inject(ConfigService) configuracion: ConfigService,
    private readonly baseDatos: BaseDatosService,
    private readonly captcha: CaptchaService,
    private readonly clave: ClaveService,
    private readonly red: RedService,
    private readonly sesion: SesionService,
  ) {
    this.avisoSegundos = configuracion.get<number>('SESION_AVISO_SEGUNDOS') ?? 480;
  }

  /** Paso 1 del flujo: emitir el reto. Tambien exige red autorizada (R2). */
  async emitirReto(direccionIp: string): Promise<RetoCaptcha | null> {
    return this.baseDatos.enTransaccionDeSistema(async (cliente) => {
      if (!(await this.red.estaAutorizada(cliente, direccionIp))) {
        await this.registrarIntento(cliente, {
          credencial: '(reto)',
          resultado: 'RED_NO_AUTORIZADA',
          idUsuario: null,
          direccionIp,
          agenteUsuario: null,
          idCaptcha: null,
        });
        return null;
      }
      return this.captcha.emitir(cliente, direccionIp);
    });
  }

  /**
   * El ingreso completo.
   *
   * Devuelve la sesion o `null`. **Nunca** el motivo: ver R4.
   */
  async ingresar(
    solicitud: SolicitudIngreso,
    direccionIp: string,
    agenteUsuario: string | null,
  ): Promise<{ testigo: string; respuesta: RespuestaIngreso } | null> {
    return this.baseDatos.enTransaccionDeSistema(async (cliente) => {
      const anotar = (resultado: ResultadoIntento, idUsuario: number | null) =>
        this.registrarIntento(cliente, {
          credencial: solicitud.credencial,
          resultado,
          idUsuario,
          direccionIp,
          agenteUsuario,
          idCaptcha: solicitud.idCaptcha,
        });

      // ── Paso 2: validacion de red (R2) ──────────────────────────────────
      if (!(await this.red.estaAutorizada(cliente, direccionIp))) {
        await anotar('RED_NO_AUTORIZADA', null);
        return null;
      }

      // ── Paso 3: captcha (R3) ────────────────────────────────────────────
      //
      // Se valida ANTES de mirar la credencial, y se marca consumido pase lo
      // que pase. Asi un atacante no puede probar mil claves con un solo
      // captcha resuelto.
      const captchaValido = await this.captcha.validarYConsumir(
        cliente,
        solicitud.idCaptcha,
        solicitud.respuestaCaptcha,
      );
      if (!captchaValido) {
        await anotar('CAPTCHA_INVALIDO', null);
        return null;
      }

      // ── Paso 4: credencial ──────────────────────────────────────────────
      const usuario = await this.buscarUsuario(cliente, solicitud.credencial);

      // ⚠️ R4. La verificacion de la clave se ejecuta EN LOS DOS CAMINOS. Si
      // el camino del usuario inexistente respondiera sin verificar nada, el
      // tiempo de respuesta delataria que credenciales existen. Con el resumen
      // ficticio el trabajo criptografico es identico.
      const resumenAVerificar = usuario?.hash_clave ?? this.clave.resumenFicticio;
      const claveCoincide = await this.clave.verificar(resumenAVerificar, solicitud.clave);

      if (usuario === undefined) {
        await anotar('USUARIO_INEXISTENTE', null);
        return null;
      }
      const idUsuario = Number(usuario.id);

      // ── Paso 5: estado y vigencia ───────────────────────────────────────
      //
      // El bloqueo se comprueba ANTES de aceptar la clave: una cuenta
      // bloqueada no entra ni con la clave correcta.
      if (usuario.bloqueado_en !== null) {
        await anotar('USUARIO_BLOQUEADO', idUsuario);
        return null;
      }
      if (!usuario.activo || usuario.estado !== 'ACTIVO') {
        await anotar('USUARIO_INACTIVO', idUsuario);
        return null;
      }

      if (!claveCoincide) {
        await this.contarFalloYBloquearSiProcede(cliente, idUsuario);
        await anotar('CLAVE_INVALIDA', idUsuario);
        return null;
      }

      if (usuario.clave_expira_en !== null && usuario.clave_expira_en <= new Date()) {
        await anotar('CLAVE_EXPIRADA', idUsuario);
        return null;
      }

      // ── Paso 6: sesion ──────────────────────────────────────────────────
      await cliente.query(
        `UPDATE seg.usuario
            SET intentos_fallidos = 0, ultimo_ingreso_en = now()
          WHERE id = $1`,
        [idUsuario],
      );

      const { testigo, sesion } = await this.sesion.abrir(cliente, {
        idUsuario,
        idUnidad: Number(usuario.id_unidad),
        credencial: usuario.credencial,
        direccionIp,
        agenteUsuario,
      });

      await anotar('EXITOSO', idUsuario);

      // Igual que en `sesion.abrir`: sin contexto, RLS oculta `org.unidad`.
      const unidad = await cliente.query<{ sigla: string; nombre: string }>(
        'SELECT sigla, nombre FROM seg.unidad_para_ingreso($1)',
        [Number(usuario.id_unidad)],
      );

      return {
        testigo,
        respuesta: {
          testigo,
          credencial: usuario.credencial,
          unidad: {
            id: Number(usuario.id_unidad),
            sigla: unidad.rows[0]?.sigla ?? '',
            nombre: unidad.rows[0]?.nombre ?? '',
          },
          roles: [...sesion.roles],
          permisos: [...sesion.permisos],
          expiraEnUtc: sesion.expiraEnUtc,
          avisoEnSegundos: this.avisoSegundos,
        },
      };
    });
  }

  private async buscarUsuario(
    cliente: PoolClient,
    credencial: string,
  ): Promise<FilaUsuario | undefined> {
    const resultado = await cliente.query<FilaUsuario>(
      `SELECT u.id, u.credencial, u.hash_clave, u.id_unidad, u.activo,
              u.bloqueado_en, u.intentos_fallidos, u.clave_expira_en,
              e.codigo AS estado
         FROM seg.usuario u
         JOIN ref.estado_registro e ON e.id = u.id_estado_registro
        WHERE u.credencial = $1`,
      [credencial],
    );
    return resultado.rows[0];
  }

  /** Bloqueo a los 5 intentos (Fase 2, punto 2). */
  private async contarFalloYBloquearSiProcede(
    cliente: PoolClient,
    idUsuario: number,
  ): Promise<void> {
    await cliente.query(
      `UPDATE seg.usuario
          SET intentos_fallidos = intentos_fallidos + 1,
              bloqueado_en = CASE
                WHEN intentos_fallidos + 1 >= $2 THEN now()
                ELSE bloqueado_en
              END
        WHERE id = $1`,
      [idUsuario, INTENTOS_ANTES_DE_BLOQUEO],
    );
  }

  /** R4: una fila por intento, con su causa. Ocho posibles. */
  private async registrarIntento(
    cliente: PoolClient,
    datos: {
      credencial: string;
      resultado: ResultadoIntento;
      idUsuario: number | null;
      direccionIp: string;
      agenteUsuario: string | null;
      idCaptcha: string | null;
    },
  ): Promise<void> {
    /*
     * El captcha se referencia solo si el identificador TIENE FORMA de UUID.
     * Comparar un texto arbitrario contra una columna `uuid` aborta la
     * transaccion, y entonces el intento no queda registrado — que es
     * justamente lo que R4 quiere conservar.
     */
    const idCaptcha = RE_UUID.test(datos.idCaptcha ?? '') ? datos.idCaptcha : null;
    await cliente.query(
      `INSERT INTO seg.intento_autenticacion
         (credencial_intentada, id_resultado, id_usuario, direccion_ip,
          agente_usuario, id_captcha)
       VALUES ($1,
         (SELECT id FROM ref.resultado_intento_autenticacion WHERE codigo = $2),
         $3, $4, $5,
         (SELECT id FROM seg.captcha WHERE id::text = $6))`,
      [
        datos.credencial.slice(0, 60),
        datos.resultado,
        datos.idUsuario,
        datos.direccionIp,
        datos.agenteUsuario,
        idCaptcha,
      ],
    );
  }

  /** Lo unico que la interfaz puede decir, sea cual sea la causa (R4). */
  get mensajeUnico(): string {
    return MENSAJE_CREDENCIALES_INVALIDAS;
  }
}
