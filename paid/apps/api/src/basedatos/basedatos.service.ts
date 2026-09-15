import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';
import { crearPool, enTransaccionConContexto, enTransaccionDeSistema } from '@paid/db';
import type { ContextoSesion } from '@paid/db';

/**
 * Acceso a la base de datos.
 *
 * ⚠️ R7/P11. Este servicio es la unica via por la que el resto de la
 * aplicacion habla con la base, y lo es a proposito: toda consulta de dominio
 * tiene que ir dentro de una transaccion que fije el contexto de sesion con
 * `SET LOCAL` en su primera sentencia. Si alguien obtiene un cliente por otro
 * camino, RLS no tendra a quien mirar y la bitacora quedara sin usuario.
 *
 * El cliente de la transaccion en curso viaja por `AsyncLocalStorage` y no
 * como parametro. La razon es que un parametro se puede olvidar —y el sintoma
 * de olvidarlo seria una consulta que se salta RLS, que es exactamente el
 * fallo que no se ve en una revision de codigo—. Con `AsyncLocalStorage`, el
 * codigo que pida el cliente fuera de una transaccion recibe un error claro en
 * lugar de una conexion sin contexto.
 */
@Injectable()
export class BaseDatosService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly almacen = new AsyncLocalStorage<{
    readonly cliente: PoolClient;
    readonly contexto: ContextoSesion;
  }>();

  constructor(@Inject(ConfigService) configuracion: ConfigService) {
    const url = configuracion.get<string>('DATABASE_URL');
    if (url === undefined || url === '') {
      throw new Error('Falta DATABASE_URL.');
    }
    this.pool = crearPool({
      url,
      maximoConexiones: configuracion.get<number>('DATABASE_POOL_MAX') ?? 10,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Ejecuta `trabajo` dentro de una transaccion con el contexto de R7 fijado
   * en la primera sentencia, y deja el cliente disponible para todo lo que se
   * llame dentro.
   */
  async enTransaccion<T>(
    contexto: ContextoSesion,
    trabajo: () => Promise<T>,
  ): Promise<T> {
    return enTransaccionConContexto(this.pool, contexto, async (cliente) =>
      this.almacen.run({ cliente, contexto }, trabajo),
    );
  }

  /**
   * Transaccion SIN contexto de sesion. Solo para lo que ocurre ANTES de haber
   * una sesion —el propio flujo de ingreso— y para tareas del sistema.
   *
   * No la uses para atender una peticion autenticada: RLS no filtraria nada.
   * Las tablas que toca el ingreso (`seg.*`) no tienen RLS por esa misma
   * razon: no se puede exigir contexto para averiguar quien eres.
   */
  async enTransaccionDeSistema<T>(
    trabajo: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    return enTransaccionDeSistema(this.pool, trabajo);
  }

  /** Cliente de la transaccion en curso. Falla si no hay transaccion. */
  get cliente(): PoolClient {
    const almacenado = this.almacen.getStore();
    if (almacenado === undefined) {
      throw new Error(
        'No hay transaccion en curso. Toda consulta de dominio va dentro de ' +
          'BaseDatosService.enTransaccion, que fija el contexto de sesion con ' +
          'SET LOCAL (R7). Sin el, RLS no filtra y la bitacora queda sin usuario.',
      );
    }
    return almacenado.cliente;
  }

  /** Contexto de la transaccion en curso, si hay una. */
  get contextoActual(): ContextoSesion | undefined {
    return this.almacen.getStore()?.contexto;
  }

  /** Solo para pruebas y para la sonda de salud. */
  get poolInterno(): Pool {
    return this.pool;
  }
}
