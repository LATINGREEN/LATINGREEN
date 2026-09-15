import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { FiltroExcepciones } from './comun/filtro-excepciones';

/**
 * Arranque de la API.
 *
 * Nada aqui llama a un servicio externo (A.2.1): la aplicacion corre en la
 * Intranet ARC y no hay internet en tiempo de ejecucion.
 */
async function arrancar(): Promise<void> {
  // Todo instante se almacena en UTC (A.2.5).
  process.env['TZ'] = 'UTC';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new FiltroExcepciones());

  const prefijo = process.env['API_PREFIJO'] ?? '/api';
  app.setGlobalPrefix(prefijo);

  const puerto = Number(process.env['API_PUERTO'] ?? 3000);
  await app.listen(puerto, '0.0.0.0');
}

void arrancar();
