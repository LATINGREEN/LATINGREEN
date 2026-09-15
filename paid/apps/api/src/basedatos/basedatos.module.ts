import { Global, Module } from '@nestjs/common';
import { BaseDatosService } from './basedatos.service';

@Global()
@Module({
  providers: [BaseDatosService],
  exports: [BaseDatosService],
})
export class BaseDatosModule {}
