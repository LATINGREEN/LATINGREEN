import { Module } from '@nestjs/common';
import { AdjuntosService } from '../adjuntos/adjuntos.service';
import { ExportacionService } from '../exportacion/exportacion.service';
import { GeneradorCodigoObservado } from '../comun/generador-codigo';
import { JornadasController } from './jornadas.controller';
import { JornadasService } from './jornadas.service';

@Module({
  controllers: [JornadasController],
  providers: [JornadasService, AdjuntosService, ExportacionService, GeneradorCodigoObservado],
  exports: [JornadasService, AdjuntosService, ExportacionService],
})
export class JornadasModule {}
