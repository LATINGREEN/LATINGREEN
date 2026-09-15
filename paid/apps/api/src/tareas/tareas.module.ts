import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SeguridadModule } from '../seguridad/seguridad.module';
import { TareasService } from './tareas.service';

@Module({
  imports: [ScheduleModule.forRoot(), SeguridadModule],
  providers: [TareasService],
})
export class TareasModule {}
