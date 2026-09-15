import { Controller, Get } from '@nestjs/common';

export interface RespuestaSalud {
  readonly estado: 'sano';
  readonly servicio: string;
  /** Instante en UTC (A.2.5). La presentacion en America/Bogota es del cliente. */
  readonly instanteUtc: string;
  readonly version: string;
}

/**
 * Sonda de salud para `docker compose` y para el balanceador de la Intranet.
 * No toca la base a proposito: una sonda que depende de la base convierte una
 * lentitud de consulta en un contenedor reiniciado.
 */
@Controller('salud')
export class SaludController {
  @Get()
  obtener(): RespuestaSalud {
    return {
      estado: 'sano',
      servicio: 'paid-api',
      instanteUtc: new Date().toISOString(),
      version: '0.0.0',
    };
  }
}
