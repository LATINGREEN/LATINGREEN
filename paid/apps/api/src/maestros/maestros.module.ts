import { Module } from '@nestjs/common';
import { CatalogosController } from './catalogos.controller';
import { EntidadesController } from './entidades.controller';
import { HerramientasController } from './herramientas.controller';
import { NormatividadController } from './normatividad.controller';
import { PersonalController } from './personal.controller';

/**
 * Los tres maestros de precedencia de R8 —Personal, Entidades A.I. y
 * Herramientas AID—, la Normatividad A.I. y la lectura de los catalogos de
 * `ref`.
 *
 * Van juntos porque son lo que la Fase 4 llama «maestros» y porque comparten
 * la misma forma: listar con busqueda, crear con validacion Zod compartida,
 * traducir el 23505 a un mensaje que diga que hacer.
 */
@Module({
  controllers: [
    CatalogosController,
    PersonalController,
    EntidadesController,
    HerramientasController,
    NormatividadController,
  ],
})
export class MaestrosModule {}
