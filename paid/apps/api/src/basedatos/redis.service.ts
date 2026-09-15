import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis lleva el TTL vivo de las sesiones (R1). `seg.sesion` conserva el
 * registro durable con el motivo de cierre.
 *
 * Reparto deliberado: Redis es rapido y volatil, y la tabla es durable y
 * auditable. Si Redis se reinicia, las sesiones se cierran —lo que es lo
 * seguro— y el registro de que existieron no se pierde.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly registro = new Logger(RedisService.name);
  private readonly cliente: Redis;

  constructor(@Inject(ConfigService) configuracion: ConfigService) {
    const clave = configuracion.get<string>('REDIS_PASSWORD');
    this.cliente = new Redis({
      host: configuracion.get<string>('REDIS_HOST') ?? 'localhost',
      port: configuracion.get<number>('REDIS_PORT') ?? 6379,
      ...(clave !== undefined && clave !== '' ? { password: clave } : {}),
      // Red cerrada: sin reintentos infinitos que enmascaren una caida.
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.cliente.on('error', (error: Error) => {
      this.registro.error({ error: error.message }, 'Error de Redis');
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente.quit().catch(() => undefined);
  }

  /** Guarda un valor con TTL en segundos. */
  async guardar(clave: string, valor: string, ttlSegundos: number): Promise<void> {
    await this.cliente.set(clave, valor, 'EX', ttlSegundos);
  }

  async leer(clave: string): Promise<string | null> {
    return this.cliente.get(clave);
  }

  /**
   * Desplaza el TTL. Es el mecanismo de la expiracion DESLIZANTE de R1:
   * cada peticion autenticada devuelve el contador a los 10 minutos.
   *
   * Devuelve `false` si la clave ya no existe, que es como se detecta una
   * sesion vencida.
   */
  async desplazarTtl(clave: string, ttlSegundos: number): Promise<boolean> {
    const resultado = await this.cliente.expire(clave, ttlSegundos);
    return resultado === 1;
  }

  async ttlRestante(clave: string): Promise<number> {
    return this.cliente.ttl(clave);
  }

  async borrar(clave: string): Promise<void> {
    await this.cliente.del(clave);
  }

  get instancia(): Redis {
    return this.cliente;
  }
}
